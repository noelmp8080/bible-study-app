import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import Icon from "../../components/Icon.jsx";
import { DICTIONARY } from "./dictionary.js";
import { useVerseSearch } from "./useVerseSearch.js";
import { useTable } from "../../hooks/useData.js";
import { usePrefs } from "../../hooks/usePrefs.js";
import { useBibleStatus } from "../../hooks/useBible.js";
import { BOOKS, OT_BOOK_COUNT, readPath } from "../../lib/books.js";
import { kjvChapter, refExists, verseIndex } from "../../lib/bible.js";
import { plainText } from "../../lib/verseText.js";
import { formatRef, parseReference } from "../../lib/refs.js";
import { highlightPattern, normalize, parseQuery } from "../../lib/searchQuery.js";
import { shortDate } from "../../lib/format.js";

const PAGE = 50;
const SCOPES = [["verses", "Verses"], ["notes", "My notes"], ["dictionary", "Dictionary"]];
const EXAMPLES = ["grace", "\"living water\"", "faith hope charity", "rom 8:28", "1 cor 13"];

/** Text with every matched word wrapped in an accent-coloured <strong>. */
function Hits({ text, pattern }) {
  if (!pattern) return text;
  const parts = text.split(pattern);
  return parts.map((part, i) => (i % 2 ? <strong key={i} className="hit">{part}</strong> : part));
}

function VerseResults({ query, translation }) {
  const [testament, setTestament] = useState("all");
  const [shown, setShown] = useState(PAGE);
  const bible = useBibleStatus();
  const search = useVerseSearch(query, true);
  const sentinel = useRef(null);
  const flat = bible === "ready" ? verseIndex() : null;

  const view = useMemo(() => {
    if (!search.current || !search.indices || !flat) return null;
    const keep = testament === "all" ? null : testament === "ot";
    const counts = new Map();
    const list = [];
    for (const i of search.indices) {
      const b = flat.book[i];
      if (keep !== null && (b < OT_BOOK_COUNT) !== keep) continue;
      list.push(i);
      counts.set(b, (counts.get(b) || 0) + 1);
    }
    let top = null;
    for (const [b, n] of counts) if (!top || n > top[1]) top = [b, n];
    return { list, top };
  }, [search, flat, testament]);

  // Start again from the first page whenever the query or filter changes.
  const pageKey = `${search.key}|${testament}`;
  const [pageFor, setPageFor] = useState(pageKey);
  if (pageFor !== pageKey) { setPageFor(pageKey); setShown(PAGE); }

  useEffect(() => {
    const node = sentinel.current;
    if (!node || !view || shown >= view.list.length) return undefined;
    const io = new IntersectionObserver((entries) => { if (entries.some((e) => e.isIntersecting)) setShown((n) => n + PAGE); }, { rootMargin: "400px" });
    io.observe(node);
    return () => io.disconnect();
  }, [view, shown]);

  const pattern = useMemo(() => highlightPattern(search.parsed), [search.parsed]);
  const total = search.current ? search.ot + search.nt : null;

  if (bible !== "ready") return <p className="empty" role="status">{bible === "error" ? "The Bible text has not been saved to this device yet. Connect once to download it." : "Preparing the Bible for search…"}</p>;
  if (search.error) return <p className="notice error" role="alert">{search.error}</p>;

  return (
    <>
      <div className="stack-sm" style={{ gap: 10, marginBottom: 10 }}>
        <div className="row" role="group" aria-label="Filter by testament" style={{ gap: 8, flexWrap: "wrap" }}>
          {[["all", "All", total], ["ot", "Old", search.current ? search.ot : null], ["nt", "New", search.current ? search.nt : null]].map(([id, label, n]) => (
            <button key={id} type="button" className="pill" aria-pressed={testament === id} onClick={() => setTestament(id)}>
              {label}{n !== null ? ` · ${n.toLocaleString()}` : ""}
            </button>
          ))}
        </div>
        <div className="muted" style={{ fontSize: 12 }} role="status" aria-live="polite">
          {!view ? "Searching…" : view.list.length === 0 ? "No verses match." : (
            <>
              {view.list.length.toLocaleString()} verse{view.list.length === 1 ? "" : "s"}
              {testament === "ot" ? " in the Old Testament" : testament === "nt" ? " in the New Testament" : ""} · KJV
              {view.top ? ` · most in ${BOOKS[view.top[0]][0]} (${view.top[1]})` : ""}
            </>
          )}
          {translation !== "KJV" && " · search uses the KJV text stored on this device"}
        </div>
      </div>
      {view && (
        <div className="stack-sm">
          {view.list.slice(0, shown).map((i) => {
            const book = BOOKS[flat.book[i]][0], chapter = flat.chapter[i], verse = flat.verse[i];
            return (
              <Link key={i} className="result" to={readPath(book, chapter, verse)}>
                <span className="refline">{book} {chapter}:{verse}</span>
                <span className="scripture"><Hits text={plainText(kjvChapter(book, chapter)[verse - 1])} pattern={pattern} /></span>
              </Link>
            );
          })}
          {shown < view.list.length && (
            <div ref={sentinel}>
              <button type="button" className="btn btn-outline btn-block" onClick={() => setShown((n) => n + PAGE)}>
                Show more ({(view.list.length - shown).toLocaleString()} left)
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}

function NoteResults({ query }) {
  const notes = useTable("notes");
  const parsed = useMemo(() => parseQuery(query), [query]);
  const pattern = useMemo(() => highlightPattern(parsed), [parsed]);
  const hits = useMemo(() => {
    const needles = [...parsed.phrases, ...parsed.words].map((n) => ` ${n} `);
    return notes.filter((n) => {
      const hay = ` ${normalize([n.title, n.text, (n.tags || []).join(" "), n.ref].join(" "))} `;
      return needles.every((needle) => hay.includes(needle));
    }).sort((a, b) => String(b.updated_at || b.created_at).localeCompare(String(a.updated_at || a.created_at)));
  }, [notes, parsed]);
  return (
    <>
      <div className="muted" style={{ fontSize: 12, marginBottom: 10 }} role="status">{hits.length} of {notes.length} note{notes.length === 1 ? "" : "s"} match (title, text and tags)</div>
      <div className="stack-sm">
        {hits.map((n) => (
          <Link key={n.id} className="result" to={`/notes/${n.id}`}>
            <span className="refline">{n.ref || "Note"} · {shortDate(n.updated_at || n.created_at)}</span>
            <span style={{ display: "block", fontWeight: 600, marginBottom: 4 }}><Hits text={n.title || "Untitled"} pattern={pattern} /></span>
            <span className="muted2" style={{ display: "block", fontSize: 13.5, lineHeight: 1.6 }}><Hits text={(n.text || "").slice(0, 260)} pattern={pattern} /></span>
          </Link>
        ))}
      </div>
    </>
  );
}

function Dictionary({ query }) {
  const [open, setOpen] = useState(null);
  const q = query.trim().toLowerCase();
  const entries = Object.entries(DICTIONARY).filter(([word, e]) => !q || word.toLowerCase().includes(q) || e.def.toLowerCase().includes(q) || e.type.toLowerCase().includes(q));
  return (
    <>
      <div className="muted" style={{ fontSize: 12, marginBottom: 10 }} role="status">{entries.length} of {Object.keys(DICTIONARY).length} terms</div>
      <div className="grid2">
        {entries.map(([word, entry]) => (
          <div key={word} className="card" style={{ padding: 0 }}>
            <button type="button" aria-expanded={open === word} onClick={() => setOpen(open === word ? null : word)}
              style={{ width: "100%", minHeight: 56, padding: "12px 14px", background: "none", border: "none", textAlign: "left", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
              <span>
                <span className="display" style={{ display: "block", fontSize: 19, color: "var(--accent)" }}>{word}</span>
                <span className="muted" style={{ display: "block", fontSize: 11, fontWeight: 600, letterSpacing: ".08em", textTransform: "uppercase", marginTop: 3 }}>{entry.type}</span>
              </span>
              <Icon name={open === word ? "chevUp" : "chevDown"} size={15} stroke={2} />
            </button>
            {open === word && <p style={{ fontSize: 13.5, lineHeight: 1.7, padding: "10px 14px 14px", borderTop: "1px solid var(--border)" }}>{entry.def}</p>}
          </div>
        ))}
      </div>
    </>
  );
}

/** Spec A4: offline full-text search with reference detection and three scopes. */
export default function SearchScreen() {
  const [prefs] = usePrefs();
  const [params, setParams] = useSearchParams();
  const query = params.get("q") || "";
  const scope = SCOPES.some(([id]) => id === params.get("in")) ? params.get("in") : "verses";
  const [text, setText] = useState(query);
  const bible = useBibleStatus();

  const update = (next) => {
    const p = {};
    const q = next.q ?? query, s = next.in ?? scope;
    if (q) p.q = q;
    if (s !== "verses") p.in = s;
    setParams(p, { replace: true });
  };
  const onChange = (value) => { setText(value); update({ q: value }); };

  const reference = useMemo(() => {
    const r = parseReference(query);
    return r && (bible !== "ready" || refExists(r)) ? r : null;
  }, [query, bible]);

  return (
    <div className="screen">
      <header className="page-head">
        <div className="eyebrow">Whole Bible · works offline</div>
        <h1 className="display">Search</h1>
        <form className="row" style={{ gap: 8, marginTop: 12 }} role="search" onSubmit={(e) => { e.preventDefault(); update({ q: text }); }}>
          <label className="sr-only" htmlFor="search-q">Search words or a reference</label>
          <input id="search-q" className="input" type="search" value={text} onChange={(e) => onChange(e.target.value)}
            placeholder="Words, a “quoted phrase”, or a reference" autoComplete="off" autoCorrect="off" autoCapitalize="none" spellCheck={false} />
          <button type="submit" className="icon-btn solid" aria-label="Search"><Icon name="search" size={18} /></button>
        </form>
        <div className="seg" role="group" aria-label="Search in" style={{ marginTop: 12, maxWidth: 520 }}>
          {SCOPES.map(([id, label]) => <button key={id} type="button" aria-pressed={scope === id} onClick={() => update({ in: id })}>{label}</button>)}
        </div>
      </header>
      <div className="screen-scroll">
        <main className="pad wrap" style={{ paddingTop: 10 }}>
          {reference && scope === "verses" && (
            <Link className="result" style={{ borderColor: "var(--accent)", marginBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}
              to={readPath(reference.book, reference.chapter, reference.verseStart || undefined)}>
              <span><span className="refline">Go to {formatRef(reference)}</span>
                <span className="muted2" style={{ fontSize: 13 }}>Open this {reference.verseStart ? "verse" : "chapter"} in the reader</span></span>
              <Icon name="arrowRight" size={17} />
            </Link>
          )}
          {scope === "dictionary" ? <Dictionary query={query} />
            : !query.trim() ? (
              <div className="empty">
                <p>{scope === "notes" ? "Search the titles, text and tags of your notes." : "Search every verse on this device. Several words must all appear in the verse; put a phrase in quotes."}</p>
                {scope === "verses" && (
                  <div className="row" style={{ flexWrap: "wrap", justifyContent: "center", gap: 8, marginTop: 14 }}>
                    {EXAMPLES.map((ex) => <button key={ex} type="button" className="pill" onClick={() => onChange(ex)}>{ex}</button>)}
                  </div>
                )}
              </div>
            )
            : scope === "notes" ? <NoteResults query={query} />
            : reference ? null /* a reference is a jump, not a word search */
            : !parseQuery(query).empty ? <VerseResults query={query} translation={prefs.translation} /> : null}
        </main>
      </div>
    </div>
  );
}
