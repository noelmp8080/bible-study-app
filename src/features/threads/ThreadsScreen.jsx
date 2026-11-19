import { useState } from "react";
import { Link, useNavigate } from "react-router";
import Icon from "../../components/Icon.jsx";
import { useTable } from "../../hooks/useData.js";
import { useToast } from "../../hooks/useToast.js";
import { put, remove } from "../../lib/store.js";
import { linksOf } from "../../lib/threads.js";
import { formatRef } from "../../lib/refs.js";

/** The list of threads. The detail view (spec B4) is ThreadDetail. */
export default function ThreadsScreen() {
  const threads = useTable("threads");
  const links = useTable("thread_links");
  const [title, setTitle] = useState("");
  const navigate = useNavigate();
  const toast = useToast();
  const sorted = [...threads].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));

  function create(e) {
    e.preventDefault();
    if (!title.trim()) return;
    navigate(`/threads/${put("threads", { title: title.trim() }).id}`);
  }
  function drop(thread) {
    const kept = linksOf(thread.id, links);
    remove("threads", thread.id);
    kept.forEach((l) => remove("thread_links", l.id));
    toast(`Deleted “${thread.title}”`, { action: { label: "Undo", run: () => { put("threads", thread); kept.forEach((l) => put("thread_links", l)); } } });
  }

  return (
    <div className="screen">
      <header className="page-head">
        <Link className="back-link" to="/"><Icon name="chevLeft" size={14} stroke={2} />Today</Link>
        <div className="eyebrow">{threads.length} thread{threads.length === 1 ? "" : "s"}</div>
        <h1 className="display">Threads</h1>
        <p className="lede">A thread is a titled, ordered list of passages that trace one idea through Scripture.</p>
      </header>
      <div className="screen-scroll">
        <main className="pad wrap-narrow stack">
          <form className="row" style={{ gap: 8, alignItems: "flex-end" }} onSubmit={create}>
            <label className="field grow"><span>Start a new thread</span>
              <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="The idea you are tracing, e.g. The Lamb" />
            </label>
            <button type="submit" className="btn btn-accent" disabled={!title.trim()}>Create</button>
          </form>
          {sorted.length === 0 && <p className="empty">No threads yet. You can also select a verse in the reader and choose Add to thread.</p>}
          <div className="stack-sm">
            {sorted.map((t) => {
              const mine = linksOf(t.id, links);
              return (
                <div key={t.id} className="row" style={{ gap: 8, alignItems: "stretch" }}>
                  <Link className="result grow" to={`/threads/${t.id}`}>
                    <span className="display" style={{ display: "block", fontSize: 24, lineHeight: 1.1 }}>{t.title}</span>
                    <span className="muted2" style={{ display: "block", fontSize: 13, marginTop: 4 }}>
                      {mine.length ? `${mine.length} passage${mine.length === 1 ? "" : "s"} · ${formatRef({ book: mine[0].book, chapter: mine[0].chapter, verseStart: mine[0].verse_start, verseEnd: mine[0].verse_end })}${mine.length > 1 ? " → " + formatRef({ book: mine[mine.length - 1].book, chapter: mine[mine.length - 1].chapter, verseStart: mine[mine.length - 1].verse_start, verseEnd: mine[mine.length - 1].verse_end }) : ""}` : "No passages yet"}
                    </span>
                  </Link>
                  <button type="button" className="icon-btn" style={{ height: "auto" }} aria-label={`Delete thread ${t.title}`} onClick={() => drop(t)}><Icon name="trash" size={16} /></button>
                </div>
              );
            })}
          </div>
        </main>
      </div>
    </div>
  );
}
