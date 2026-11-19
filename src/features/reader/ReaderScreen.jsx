import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useNavigate, useParams, useSearchParams } from "react-router";
import Icon from "../../components/Icon.jsx";
import Sheet from "../../components/Sheet.jsx";
import SyncStatus from "../../components/SyncStatus.jsx";
import { BookPicker, ChapterPicker } from "../../components/Pickers.jsx";
import VerseList from "./VerseList.jsx";
import { VerseToolbar, VerseSheet } from "./VerseActions.jsx";
import { useVerseActions } from "./useVerseActions.js";
import { useReadAloud, canSpeak } from "./useReadAloud.js";
import StudyPanel from "../study/StudyPanel.jsx";
import PlanBlock, { MarkReadButton } from "../plans/PlanBlock.jsx";
import AddToThreadSheet from "../threads/AddToThreadSheet.jsx";
import { useTable } from "../../hooks/useData.js";
import { usePrefs } from "../../hooks/usePrefs.js";
import { useChapter } from "../../hooks/useBible.js";
import { useBreakpoint } from "../../hooks/useBreakpoint.js";
import { useReadSet } from "../../hooks/usePlan.js";
import { useToast } from "../../hooks/useToast.js";
import { put, remove } from "../../lib/store.js";
import { TRANSLATIONS, bookFromSlug, chapterWord, isValidChapter, nextChapter, prevChapter, readPath } from "../../lib/books.js";
import { verseRuns } from "../../lib/refs.js";
import { noteLink } from "../../lib/notes.js";

/** Centre a verse inside the scripture column without scrolling anything else on the page. */
function centreVerse(box, verse, smooth) {
  const el = box?.querySelector(`#v${verse}`);
  if (!el) return;
  const delta = el.getBoundingClientRect().top - box.getBoundingClientRect().top - (box.clientHeight - el.offsetHeight) / 2;
  box.scrollBy({ top: delta, behavior: smooth ? "smooth" : "auto" });
}

/** /read → the last place the user was reading. */
export function ReadRedirect() {
  const [prefs] = usePrefs();
  const at = prefs.current_verse ? `?at=${prefs.current_verse}` : "";
  return <Navigate to={readPath(prefs.current_book, prefs.current_chapter) + at} replace />;
}

/** /read/:book/:chapter[/:verse] — a verse in the path opens with that verse selected. */
export default function ReaderScreen() {
  const params = useParams();
  const [search] = useSearchParams();
  const book = bookFromSlug(params.book);
  const chapter = Number(params.chapter);
  if (!book || !isValidChapter(book, chapter)) return <Navigate to="/read" replace />;
  const verse = Number(params.verse) || null;
  const at = Number(search.get("at")) || null;
  // Keyed so that selection and scroll state start fresh for each chapter.
  return <Reader key={`${book}|${chapter}|${verse || ""}`} book={book} chapter={chapter} initialVerse={verse} scrollVerse={verse || at} />;
}

function Reader({ book, chapter, initialVerse, scrollVerse }) {
  const [prefs, setPrefs] = usePrefs();
  const { isPhone, isDesktop, isWide } = useBreakpoint();
  const navigate = useNavigate();
  const toast = useToast();
  const translation = prefs.translation;
  const otherTranslation = translation === "KJV" ? "ASV" : "KJV";

  const [selection, setSelection] = useState(() => new Set(initialVerse ? [initialVerse] : []));
  const [compare, setCompare] = useState(false);
  const [overlay, setOverlay] = useState(null); // book | chapter | translation | thread | study
  const [pickedBook, setPickedBook] = useState(null);

  const main = useChapter(translation, book, chapter);
  const second = useChapter(compare ? otherTranslation : translation, book, chapter);
  const readSet = useReadSet();

  // ── This chapter's highlights, bookmarks, notes and memory verses ──────────
  const allHighlights = useTable("highlights");
  const allBookmarks = useTable("bookmarks");
  const allNotes = useTable("notes");
  const allMemory = useTable("memory_verses");
  const highlights = useMemo(
    () => new Map(allHighlights.filter((h) => h.book === book && h.chapter === chapter).map((h) => [h.verse, h])),
    [allHighlights, book, chapter]);
  const { verseBookmarks, chapterBookmark } = useMemo(() => {
    const here = allBookmarks.filter((b) => b.book === book && b.chapter === chapter);
    return { verseBookmarks: new Map(here.filter((b) => b.verse).map((b) => [b.verse, b])), chapterBookmark: here.find((b) => !b.verse) || null };
  }, [allBookmarks, book, chapter]);
  const chapterNotes = useMemo(
    () => allNotes.map((note) => ({ note, link: noteLink(note) })).filter((x) => x.link?.book === book && x.link.chapter === chapter),
    [allNotes, book, chapter]);
  const noteCounts = useMemo(() => {
    const counts = new Map();
    for (const { link } of chapterNotes) if (link.verseStart) counts.set(link.verseStart, (counts.get(link.verseStart) || 0) + 1);
    return counts;
  }, [chapterNotes]);
  const memoryCount = allMemory.filter((m) => m.book === book && m.chapter === chapter).length;

  // ── Selection ─────────────────────────────────────────────────────────────
  const lastVerse = useRef(scrollVerse || null); // last selected or topmost visible verse
  const toggle = useCallback((n) => {
    lastVerse.current = n;
    setSelection((prev) => { const next = new Set(prev); if (next.has(n)) next.delete(n); else next.add(n); return next; });
  }, []);
  const clear = useCallback(() => setSelection(new Set()), []);
  const actions = useVerseActions({ book, chapter, translation, verses: main.verses, selection, highlights, bookmarks: verseBookmarks, onDone: clear });
  const picked = actions.picked;
  const passages = verseRuns(picked).map(([a, b]) => ({ book, chapter, verseStart: a, verseEnd: b }));

  // ── Navigation between chapters ───────────────────────────────────────────
  const prev = prevChapter(book, chapter);
  const next = nextChapter(book, chapter);
  const go = useCallback((target) => { if (target) navigate(readPath(target.book, target.chapter)); }, [navigate]);

  useEffect(() => {
    function onKey(e) {
      if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey || overlay) return;
      const el = e.target;
      if (el instanceof HTMLElement && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      if (e.key === "Escape" && selection.size) { clear(); return; }
      if (!isDesktop || document.querySelector('[role="dialog"]')) return;
      if (e.key === "ArrowLeft" && prev) { e.preventDefault(); go(prev); }
      if (e.key === "ArrowRight" && next) { e.preventDefault(); go(next); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [overlay, selection, isDesktop, prev, next, go, clear]);

  const touch = useRef(null);
  function onTouchStart(e) { const t = e.touches[0]; touch.current = { x: t.clientX, y: t.clientY, at: Date.now() }; }
  function onTouchEnd(e) {
    const start = touch.current; touch.current = null;
    if (!start) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x, dy = t.clientY - start.y;
    if (Math.abs(dx) < 80 || Math.abs(dy) > 50 || Date.now() - start.at > 600) return;
    go(dx < 0 ? next : prev);
  }

  // ── Reading position: saved on arrival, verse refined on the way out ──────
  const scrollRef = useRef(null);
  useEffect(() => {
    if (prefs.current_book !== book || prefs.current_chapter !== chapter) {
      setPrefs({ current_book: book, current_chapter: chapter, current_verse: scrollVerse || null });
    }
    return () => { if (lastVerse.current) setPrefs({ current_verse: lastVerse.current }); };
    // Runs once per chapter: the component is keyed by book and chapter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const didScroll = useRef(false);
  useEffect(() => {
    if (didScroll.current || !main.verses || !scrollVerse) return;
    didScroll.current = true;
    centreVerse(scrollRef.current, scrollVerse, false);
  }, [main.verses, scrollVerse]);

  // On a phone the action sheet covers the lower half: keep the verse just tapped above it.
  useEffect(() => {
    if (!isPhone || !selection.size) return undefined;
    const frame = requestAnimationFrame(() => {
      const verse = document.getElementById(`v${lastVerse.current}`);
      const sheet = document.querySelector(".sheet");
      if (!verse || !sheet || !scrollRef.current) return;
      const overlap = verse.getBoundingClientRect().bottom - (sheet.getBoundingClientRect().top - 12);
      if (overlap > 0) scrollRef.current.scrollBy({ top: overlap, behavior: "smooth" });
    });
    return () => cancelAnimationFrame(frame);
  }, [selection, isPhone]);

  const scrollTick = useRef(0);
  function onScroll() {
    if (selection.size) return;
    cancelAnimationFrame(scrollTick.current);
    scrollTick.current = requestAnimationFrame(() => {
      const box = scrollRef.current;
      if (!box) return;
      const top = box.getBoundingClientRect().top;
      for (const el of box.querySelectorAll(".verse[data-verse]")) {
        if (el.getBoundingClientRect().bottom > top + 8) { lastVerse.current = box.scrollTop < 40 ? null : Number(el.dataset.verse); break; }
      }
    });
  }

  // ── Read aloud ────────────────────────────────────────────────────────────
  const speech = useReadAloud(main.verses, {
    onVerse: (n) => centreVerse(scrollRef.current, n, true),
    onNotice: (message) => toast(message),
  });

  function toggleChapterBookmark() {
    if (chapterBookmark) {
      const row = remove("bookmarks", chapterBookmark.id);
      toast(`Removed bookmark on ${book} ${chapter}`, { action: { label: "Undo", run: () => row && put("bookmarks", row) } });
    } else {
      put("bookmarks", { book, chapter, verse: null });
      toast(`Bookmarked ${book} ${chapter}`);
    }
  }
  function openNotes(verse) {
    const here = chapterNotes.filter((x) => x.link.verseStart === verse);
    if (here.length === 1) navigate(`/notes/${here[0].note.id}`);
    else navigate(`/notes?at=${encodeURIComponent(`${book} ${chapter}:${verse}`)}`);
  }
  // A tap beside the phone sheet: on a verse it extends the selection, elsewhere it closes.
  function onSheetScrim(e) {
    const hit = document.elementsFromPoint(e.clientX, e.clientY).find((el) => el instanceof HTMLElement && el.dataset.verse);
    if (hit) toggle(Number(hit.dataset.verse)); else clear();
  }

  const bigSize = (base) => (book.length > 12 ? base * 0.44 : book.length > 8 ? base * 0.6 : base);
  const compareLabel = `Compare with ${otherTranslation}`;
  const toolbarAt = !isPhone && picked.length ? picked[picked.length - 1] : null;
  const tools = (
    <>
      <button type="button" className={`icon-btn${compare ? " on" : ""}`} aria-pressed={compare} aria-label={compareLabel} title={compareLabel}
        onClick={() => setCompare((c) => !c)} style={isDesktop ? { width: "auto", padding: "0 14px", gap: 7, fontSize: 12, fontWeight: 600 } : undefined}>
        <Icon name="compare" size={16} />{isDesktop && compareLabel}
      </button>
      <button type="button" className={`icon-btn${chapterBookmark ? " on" : ""}`} aria-pressed={!!chapterBookmark}
        aria-label={chapterBookmark ? "Remove bookmark from this chapter" : "Bookmark this chapter"} title="Bookmark this chapter" onClick={toggleChapterBookmark}>
        <Icon name="bookmark" size={17} fill={chapterBookmark ? "currentColor" : "none"} />
      </button>
      {canSpeak && (
        <button type="button" className={`icon-btn${speech.state !== "idle" ? " on" : ""}${speech.state === "loading" ? " pulse" : ""}`}
          aria-pressed={speech.state !== "idle"} aria-busy={speech.state === "loading"}
          aria-label={speech.state === "idle" ? "Read this chapter aloud" : speech.state === "loading" ? "Getting the voice ready. Stop reading aloud" : "Stop reading aloud"}
          title={speech.state === "loading" ? "Getting the voice ready…" : "Read aloud"}
          onClick={() => (speech.state === "idle" ? speech.play(picked[0]) : speech.stop())}>
          <Icon name="speaker" size={17} />
        </button>
      )}
    </>
  );

  return (
    <div className="screen">
      <header className="reader-head">
        <div className="row" style={{ minWidth: 0 }}>
          <Link className="reader-mark" to="/" aria-label="Today">B.</Link>
          {isDesktop && <SyncStatus />}
        </div>
        <div className="reader-tools">
          <button type="button" className="chip" aria-haspopup="dialog" onClick={() => setOverlay("book")}>{book}<Icon name="chevDown" size={12} stroke={2} /></button>
          <button type="button" className="chip" aria-haspopup="dialog" onClick={() => { setPickedBook(null); setOverlay("chapter"); }}>Ch. {chapter}<Icon name="chevDown" size={12} stroke={2} /></button>
          <div style={{ position: "relative" }} onKeyDown={(e) => { if (e.key === "Escape" && overlay === "translation") { e.stopPropagation(); setOverlay(null); } }}>
            <button type="button" className="chip chip-ink" aria-haspopup="menu" aria-expanded={overlay === "translation"} aria-label={`Translation: ${TRANSLATIONS[translation].label}`}
              onClick={() => setOverlay((o) => (o === "translation" ? null : "translation"))}>{translation}<Icon name="chevDown" size={12} stroke={2} /></button>
            {overlay === "translation" && (
              <>
                <div style={{ position: "fixed", inset: 0, zIndex: 210 }} onClick={() => setOverlay(null)} />
                <div className="menu" role="menu" aria-label="Translation">
                  {Object.entries(TRANSLATIONS).map(([id, meta]) => (
                    <button key={id} type="button" role="menuitemradio" aria-checked={id === translation}
                      onClick={() => { setOverlay(null); if (id !== translation) setPrefs({ translation: id }); }}>
                      <b>{id}</b><span>{meta.label} · {meta.era}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          {isDesktop && tools}
        </div>
      </header>
      {!isDesktop && <div className="reader-sub"><SyncStatus compact /><div className="row" style={{ gap: 0 }}>{tools}</div></div>}

      {speech.state !== "idle" && (
        <div className="listen-bar" role="group" aria-label="Read aloud">
          <button type="button" className="btn btn-sm" onClick={speech.state === "playing" ? speech.pause : speech.resume}>
            <Icon name={speech.state === "playing" ? "pause" : "play"} size={13} />{speech.state === "playing" ? "Pause" : "Resume"}
          </button>
          <button type="button" className="btn btn-sm btn-quiet" onClick={speech.stop}><Icon name="stop" size={13} />Stop</button>
          <span role="status">Reading verse {speech.verse}</span>
          <label className="row" style={{ marginLeft: "auto", gap: 6 }}>Speed
            <select value={speech.rate} onChange={(e) => { speech.setRate(Number(e.target.value)); }}>
              {[0.75, 1, 1.25, 1.5].map((r) => <option key={r} value={r}>{r}×</option>)}
            </select>
          </label>
        </div>
      )}

      <div className="reader-body">
        <aside className={`chapter-panel${prefs.chapter_panel_collapsed ? " collapsed" : ""}`} aria-label="Chapter">
          <div>
            <div className="eyebrow" style={{ marginBottom: 14 }}>Chapter {chapterWord(chapter)}</div>
            <div className="big" style={{ fontSize: bigSize(104) }}>{book}<br />{chapter}</div>
          </div>
          <PlanBlock book={book} chapter={chapter} />
          <section style={{ gap: 8 }}>
            <div className="label">In this chapter</div>
            <div className="count-row"><span>Highlights</span><b>{highlights.size}</b></div>
            <div className="count-row"><span>Notes</span><b>{chapterNotes.length}</b></div>
            <div className="count-row"><span>Memory verses</span><b>{memoryCount}</b></div>
          </section>
        </aside>

        <div className="reader-col">
          <button type="button" className="panel-toggle" onClick={() => setPrefs({ chapter_panel_collapsed: !prefs.chapter_panel_collapsed })}
            aria-label={prefs.chapter_panel_collapsed ? "Show chapter panel" : "Hide chapter panel"} aria-expanded={!prefs.chapter_panel_collapsed}
            title={prefs.chapter_panel_collapsed ? "Show chapter panel" : "Hide chapter panel"}>
            <Icon name="panel" size={17} />
          </button>
          <div className={`reader-scroll${isPhone && picked.length ? " under-sheet" : ""}`} ref={scrollRef} onScroll={onScroll} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
            <main className="reader-verses" aria-label={`${book} ${chapter}, ${TRANSLATIONS[translation].label}`}>
              <div className="chapter-title">
                <div className="eyebrow">Chapter {chapterWord(chapter)}</div>
                <h1 className="big" style={book.length > 12 ? { fontSize: "clamp(34px, 9vw, 64px)" } : undefined}>{book} {chapter}</h1>
              </div>

              {main.loading && <p className="empty" role="status">Loading scripture…</p>}
              {main.error && (
                <div className="notice error" role="alert" style={{ marginBottom: 18 }}>
                  <p>{main.error}</p>
                  {translation !== "KJV" && (
                    <button type="button" className="btn btn-sm btn-outline" style={{ marginTop: 10 }} onClick={() => setPrefs({ translation: "KJV" })}>Read in KJV instead</button>
                  )}
                </div>
              )}
              {compare && second.error && <p className="notice" style={{ marginBottom: 18 }}>{otherTranslation} could not be loaded for this chapter: {second.error}</p>}

              {main.verses && (
                <>
                  <VerseList verses={main.verses} label={`${translation} · ${TRANSLATIONS[translation].era}`}
                    other={compare && second.verses ? second.verses : null} otherLabel={`${otherTranslation} · ${TRANSLATIONS[otherTranslation].era}`}
                    selection={selection} highlights={highlights} bookmarks={verseBookmarks} noteCounts={noteCounts}
                    speakingVerse={speech.verse} onToggle={toggle} onOpenNotes={openNotes} toolbarAt={toolbarAt}
                    toolbar={<VerseToolbar actions={actions} onClear={clear} onThread={() => setOverlay("thread")} onStudy={() => setOverlay("study")} showStudy={!isWide} />} />
                  <div style={{ margin: "8px 0 14px" }}><MarkReadButton book={book} chapter={chapter} block={false} /></div>
                  <nav className="chapter-nav" aria-label="Chapters">
                    <button type="button" className="btn" disabled={!prev} onClick={() => go(prev)}>
                      <Icon name="arrowLeft" size={15} />{prev ? (prev.book === book ? "Previous" : `${prev.book} ${prev.chapter}`) : "Previous"}
                    </button>
                    <button type="button" className="btn" disabled={!next} onClick={() => go(next)}>
                      {next ? (next.book === book ? "Next" : `${next.book} ${next.chapter}`) : "Next"}<Icon name="arrowRight" size={15} />
                    </button>
                  </nav>
                </>
              )}
            </main>
          </div>
        </div>

        <aside className="study-panel open" aria-label="Study panel">
          <StudyPanel book={book} chapter={chapter} verses={picked} translation={translation} />
        </aside>
      </div>

      {overlay === "book" && (
        <BookPicker current={book} onClose={() => setOverlay(null)} onPick={(name) => { setPickedBook(name); setOverlay("chapter"); }} />
      )}
      {overlay === "chapter" && (
        <ChapterPicker book={pickedBook || book} current={(pickedBook || book) === book ? chapter : null} readSet={readSet}
          onClose={() => setOverlay(null)} onPick={(n) => { setOverlay(null); navigate(readPath(pickedBook || book, n)); }} />
      )}
      {overlay === "thread" && <AddToThreadSheet passages={passages} onClose={(added) => { setOverlay(null); if (added) clear(); }} />}
      {overlay === "study" && (
        <Sheet title={`Study · ${actions.reference}`} onClose={() => setOverlay(null)}>
          <div className="stack"><StudyPanel book={book} chapter={chapter} verses={picked} translation={translation} asSheet /></div>
        </Sheet>
      )}
      {isPhone && picked.length > 0 && !overlay && (
        <VerseSheet actions={actions} onClose={clear} onScrim={onSheetScrim} onThread={() => setOverlay("thread")} onStudy={() => setOverlay("study")}
          studyHint="Ask about this verse in context" />
      )}
    </div>
  );
}
