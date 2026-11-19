import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import Icon from "../../components/Icon.jsx";
import { useTable } from "../../hooks/useData.js";
import { useToast } from "../../hooks/useToast.js";
import { useMediaUrl } from "../../hooks/useMediaUrl.js";
import { BUCKETS, put, remove } from "../../lib/store.js";
import { noteCovers, noteLink } from "../../lib/notes.js";
import { formatRef, parseReference } from "../../lib/refs.js";
import { bookIndex, readPath } from "../../lib/books.js";
import { shortDate } from "../../lib/format.js";
import { kjvText } from "../../lib/bible.js";
import { deleteNoteWithUndo } from "../../lib/noteActions.js";

function NoteCard({ note }) {
  const navigate = useNavigate();
  const toast = useToast();
  const link = noteLink(note);
  const drawing = useMediaUrl(BUCKETS.drawings, note.drawing_path);
  return (
    <article className="note-card">
      <button type="button" className="note-open" onClick={() => navigate(`/notes/${note.id}`)} aria-label={`Open note: ${note.title || "Untitled"}`}>
        <div className="row-between" style={{ alignItems: "flex-start", width: "100%" }}>
          <h3>{note.title || "Untitled"}</h3>
          <span className="muted" style={{ fontSize: 11, flexShrink: 0 }}>{shortDate(note.updated_at || note.created_at)}</span>
        </div>
        {note.text && <div className="body">{note.text}</div>}
        {drawing && <img src={drawing} alt="Drawing in this note" style={{ border: "1px solid var(--border)", background: "#fff", maxHeight: 140, objectFit: "contain", width: "100%" }} />}
      </button>
      {(link || note.ref) && (
        <div>
          {link ? <Link className="refline" to={readPath(link.book, link.chapter, link.verseStart || undefined)}>{note.ref || formatRef(link)}</Link>
            : <span className="refline">{note.ref}</span>}
        </div>
      )}
      {note.tags?.length > 0 && <div className="row" style={{ flexWrap: "wrap", gap: 5 }}>{note.tags.map((t) => <span key={t} className="tag">{t}</span>)}</div>}
      <div className="row" style={{ flexWrap: "wrap", gap: 6 }}>
        {note.has_audio && <span className="badge"><Icon name="mic" size={12} />Audio</span>}
        {note.photo_path && <span className="badge"><Icon name="image" size={12} />Photo</span>}
        {note.drawing_path && <span className="badge"><Icon name="pencil" size={12} />Drawing</span>}
        <button type="button" className="btn btn-sm btn-danger" style={{ marginLeft: "auto", minHeight: 44 }} onClick={() => deleteNoteWithUndo(note.id, toast)}
          aria-label={`Delete note: ${note.title || "Untitled"}`}><Icon name="trash" size={14} />Delete</button>
      </div>
    </article>
  );
}

function Bookmarks() {
  const bookmarks = useTable("bookmarks");
  const toast = useToast();
  const sorted = useMemo(() => [...bookmarks].sort((a, b) =>
    bookIndex(a.book) - bookIndex(b.book) || a.chapter - b.chapter || (a.verse || 0) - (b.verse || 0)), [bookmarks]);
  if (!sorted.length) return <p className="empty">No bookmarks yet. Use the bookmark button in the reader for a chapter, or Bookmark on a selected verse.</p>;
  return (
    <div className="stack-sm">
      {sorted.map((b) => (
        <div key={b.id} className="row" style={{ gap: 8, alignItems: "stretch" }}>
          <Link className="result grow" to={readPath(b.book, b.chapter, b.verse || undefined)}>
            <span className="refline">{b.book} {b.chapter}{b.verse ? `:${b.verse}` : " · whole chapter"}</span>
            <span className="scripture">{b.verse ? kjvText(b.book, b.chapter, b.verse) : kjvText(b.book, b.chapter, 1)}</span>
          </Link>
          <button type="button" className="icon-btn" style={{ height: "auto" }} aria-label={`Remove bookmark on ${b.book} ${b.chapter}${b.verse ? `:${b.verse}` : ""}`}
            onClick={() => { const row = remove("bookmarks", b.id); toast("Bookmark removed", { action: { label: "Undo", run: () => row && put("bookmarks", row) } }); }}>
            <Icon name="trash" size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}

export default function NotesScreen() {
  const notes = useTable("notes");
  const bookmarks = useTable("bookmarks");
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState("notes");
  const [menu, setMenu] = useState(false);
  const at = params.get("at");
  const target = at ? parseReference(at) : null;

  const list = useMemo(() => {
    const sorted = [...notes].sort((a, b) => String(b.updated_at || b.created_at).localeCompare(String(a.updated_at || a.created_at)));
    if (!target) return sorted;
    return sorted.filter((n) => noteCovers(noteLink(n), target.book, target.chapter, target.verseStart || 1));
  }, [notes, target]);

  return (
    <div className="screen">
      <header className="page-head">
        <div className="head-row">
          <div>
            <div className="eyebrow">{notes.length} note{notes.length === 1 ? "" : "s"} · {bookmarks.length} bookmark{bookmarks.length === 1 ? "" : "s"}</div>
            <h1 className="display">Notes</h1>
          </div>
          <div style={{ position: "relative" }} onKeyDown={(e) => { if (e.key === "Escape") setMenu(false); }}>
            <button type="button" className="btn btn-accent" aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu((m) => !m)}><Icon name="plus" size={15} stroke={2} />New</button>
            {menu && (
              <>
                <div style={{ position: "fixed", inset: 0, zIndex: 210 }} onClick={() => setMenu(false)} />
                <div className="menu" role="menu">
                  <Link role="menuitem" className="list-link" style={{ border: "none" }} to="/notes/new"><span><strong>Study note</strong><small>Text, drawing, photo, audio</small></span><Icon name="notes" size={17} /></Link>
                  <Link role="menuitem" className="list-link" style={{ border: "none" }} to="/sermon"><span><strong>Sermon mode</strong><small>Record and pin as you listen</small></span><Icon name="mic" size={17} /></Link>
                  <Link role="menuitem" className="list-link" style={{ border: "none" }} to="/threads"><span><strong>Thread</strong><small>Trace one idea through Scripture</small></span><Icon name="thread" size={17} /></Link>
                </div>
              </>
            )}
          </div>
        </div>
        <div className="seg" role="group" aria-label="Show" style={{ marginTop: 14, maxWidth: 420 }}>
          <button type="button" aria-pressed={tab === "notes"} onClick={() => setTab("notes")}>Notes</button>
          <button type="button" aria-pressed={tab === "bookmarks"} onClick={() => setTab("bookmarks")}>Bookmarks</button>
        </div>
      </header>
      <div className="screen-scroll">
        <main className="pad wrap">
          {tab === "bookmarks" ? <Bookmarks /> : (
            <>
              {target && (
                <div className="chat-context" style={{ marginBottom: 12 }}>
                  <span>Notes on <b>{formatRef(target)}</b></span>
                  <button type="button" className="btn btn-sm btn-quiet" onClick={() => setParams({})}>Show all notes</button>
                </div>
              )}
              {list.length === 0
                ? <p className="empty">{target ? "No notes on this verse." : "No notes yet. Choose New to begin your study journal, or select a verse in the reader and choose Add note."}</p>
                : <div className="grid2">{list.map((n) => <NoteCard key={n.id} note={n} />)}</div>}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
