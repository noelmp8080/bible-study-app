import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import Icon from "../../components/Icon.jsx";
import Sheet from "../../components/Sheet.jsx";
import { useTable } from "../../hooks/useData.js";
import { useBibleStatus } from "../../hooks/useBible.js";
import { useToast } from "../../hooks/useToast.js";
import { patch, put, remove } from "../../lib/store.js";
import { addLink, linksOf } from "../../lib/threads.js";
import { formatRef, parseReference } from "../../lib/refs.js";
import { kjvText, refExists } from "../../lib/bible.js";
import { readPath } from "../../lib/books.js";
import { runTask } from "../../lib/ai.js";

const linkRef = (l) => ({ book: l.book, chapter: l.chapter, verseStart: l.verse_start, verseEnd: l.verse_end });
const excerpt = (l) => { const t = kjvText(l.book, l.chapter, l.verse_start, l.verse_end); return t.length > 220 ? `${t.slice(0, 217)}…` : t; };

/** Parse and check a typed reference against the local Bible; a bare chapter means its first verse. */
function toPassage(text) {
  const r = parseReference(text);
  if (!r) return null;
  const passage = { ...r, verseStart: r.verseStart || 1, verseEnd: r.verseEnd || r.verseStart || 1 };
  return refExists(passage) ? passage : null;
}

function AddPassageSheet({ onAdd, onClose }) {
  const [ref, setRef] = useState("");
  const [label, setLabel] = useState("");
  const passage = toPassage(ref);
  return (
    <Sheet title="Add a passage" onClose={onClose}>
      <form className="stack" onSubmit={(e) => { e.preventDefault(); if (passage) onAdd({ ...passage, label: label.trim() }); }}>
        <label className="field"><span>Reference</span>
          <input className="input" data-autofocus value={ref} onChange={(e) => setRef(e.target.value)} placeholder="e.g. John 1:29 or Isa 53:4-6" autoComplete="off" />
        </label>
        {ref.trim() && (passage
          ? <p className="scripture" style={{ fontSize: 14.5, lineHeight: 1.6 }}><b className="refline">{formatRef(passage)}</b> {kjvText(passage.book, passage.chapter, passage.verseStart, passage.verseEnd).slice(0, 240)}</p>
          : <p className="muted" style={{ fontSize: 13 }} role="status">Not a passage in the Bible on this device yet. Keep typing, for example “Exodus 12:13”.</p>)}
        <label className="field"><span>Short label (optional)</span>
          <input className="input" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. The promise" maxLength={60} />
        </label>
        <button type="submit" className="btn btn-accent btn-lg" disabled={!passage}>Add to thread</button>
      </form>
    </Sheet>
  );
}

/** Spec B4: one thread, with ordering, AI suggestions and export to a lesson outline. */
export default function ThreadDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  useBibleStatus(); // re-render when the local Bible becomes available for excerpts
  const thread = useTable("threads").find((t) => t.id === id);
  const allLinks = useTable("thread_links");
  const links = useMemo(() => linksOf(id, allLinks), [id, allLinks]);
  const [sheet, setSheet] = useState(null); // add | rename
  const [editing, setEditing] = useState(null); // link id whose label is being edited
  const [labelDraft, setLabelDraft] = useState("");
  const [titleDraft, setTitleDraft] = useState("");
  const [suggestions, setSuggestions] = useState(null);
  const [busy, setBusy] = useState(null);
  const [problem, setProblem] = useState(null);
  const [drag, setDrag] = useState({ from: null, over: null });

  if (!thread) {
    return <div className="screen"><div className="empty"><p>This thread is not on this device.</p><p style={{ marginTop: 12 }}><Link className="btn btn-outline" to="/threads">All threads</Link></p></div></div>;
  }

  function move(from, to) {
    if (to < 0 || to >= links.length || from === to) return;
    const order = [...links];
    const [item] = order.splice(from, 1);
    order.splice(to, 0, item);
    order.forEach((l, i) => { if (l.position !== i) patch("thread_links", l.id, { position: i }); });
  }
  function drop(link) {
    remove("thread_links", link.id);
    toast(`Removed ${formatRef(linkRef(link))}`, { action: { label: "Undo", run: () => put("thread_links", link) } });
  }
  function add(passage) {
    addLink(id, allLinks, passage);
    setSheet(null);
    setSuggestions((list) => list?.filter((s) => formatRef(s.passage) !== formatRef(passage)) || null);
  }

  async function suggest() {
    setBusy("suggest"); setProblem(null); setSuggestions(null);
    try {
      const result = await runTask("thread_suggest", { title: thread.title, links: links.map((l) => ({ ref: formatRef(linkRef(l)), label: l.label || "" })) });
      const have = new Set(links.map((l) => formatRef(linkRef(l))));
      // Never show a reference the local Bible does not contain.
      const valid = (result?.suggestions || []).map((s) => ({ passage: toPassage(s.ref), reason: String(s.reason || "") }))
        .filter((s) => s.passage && !have.has(formatRef(s.passage))).slice(0, 3);
      setSuggestions(valid);
      if (!valid.length) setProblem("The AI had no usable suggestion this time. Try again, or add a passage yourself.");
    } catch (err) { setProblem(err.message); }
    setBusy(null);
  }

  async function outline() {
    if (!links.length) return;
    setBusy("outline"); setProblem(null);
    const passages = links.map((l) => ({ ref: formatRef(linkRef(l)), label: l.label || "", text: kjvText(l.book, l.chapter, l.verse_start, l.verse_end) }));
    let text, withPrompts = true;
    try { text = (await runTask("thread_outline", { title: thread.title, links: passages })).text; }
    catch {
      withPrompts = false;
      text = passages.map((p, i) => `${i + 1}. ${p.ref}${p.label ? ` — ${p.label}` : ""}\n“${p.text}”`).join("\n\n");
    }
    const note = put("notes", {
      title: `${thread.title}: lesson outline`, text, ref: passages[0].ref, tags: ["Thread"], has_audio: false, has_image: false,
      book: links[0].book, chapter: links[0].chapter, verse_start: links[0].verse_start, verse_end: links[0].verse_end, updated_at: new Date().toISOString(),
    });
    setBusy(null);
    toast(withPrompts ? "Lesson outline saved to your notes" : "Outline saved without discussion prompts (the AI was not available)", { action: { label: "Open", run: () => navigate(`/notes/${note.id}`) } });
  }

  return (
    <div className="screen">
      <div className="screen-scroll">
        <header className="page-head">
          <Link className="back-link" to="/threads"><Icon name="chevLeft" size={14} stroke={2} />Threads</Link>
          <div className="eyebrow">Thread · {links.length} passage{links.length === 1 ? "" : "s"}</div>
          <div className="head-row">
            <h1 className="display">{thread.title}</h1>
            <button type="button" className="btn btn-sm btn-quiet" style={{ minHeight: 44 }} onClick={() => { setTitleDraft(thread.title); setSheet("rename"); }}><Icon name="pencil" size={14} />Rename</button>
          </div>
          <p className="lede">One idea, followed through Scripture. Build it yourself, or let the AI propose the next link.</p>
        </header>
        <main className="pad wrap-narrow" style={{ paddingTop: 18 }}>
          <ol style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {links.map((l, i) => (
              <li key={l.id} className={`thread-link${drag.from === i ? " dragging" : ""}${drag.over === i && drag.from !== i ? " over" : ""}`}
                onDragOver={(e) => { if (drag.from !== null) { e.preventDefault(); if (drag.over !== i) setDrag((d) => ({ ...d, over: i })); } }}
                onDrop={(e) => { e.preventDefault(); if (drag.from !== null) move(drag.from, i); setDrag({ from: null, over: null }); }}>
                <span className="spine" aria-hidden="true"><i /><b /></span>
                <div className="main">
                  <Link className="open" to={readPath(l.book, l.chapter, l.verse_start)}>
                    <span className="row" style={{ alignItems: "baseline", gap: 10, marginBottom: 4, flexWrap: "wrap" }}>
                      <span className="refline">{formatRef(linkRef(l))}</span>
                      {l.label && <span className="muted" style={{ fontSize: 11 }}>{l.label}</span>}
                    </span>
                    <span className="scripture">{excerpt(l)}</span>
                  </Link>
                  {editing === l.id ? (
                    <form className="row" style={{ gap: 8, marginTop: 8 }} onSubmit={(e) => { e.preventDefault(); patch("thread_links", l.id, { label: labelDraft.trim() }); setEditing(null); }}>
                      <label className="sr-only" htmlFor={`label-${l.id}`}>Label for {formatRef(linkRef(l))}</label>
                      <input id={`label-${l.id}`} className="input" autoFocus value={labelDraft} maxLength={60} onChange={(e) => setLabelDraft(e.target.value)} placeholder="Short label" />
                      <button type="submit" className="btn">Save</button>
                    </form>
                  ) : (
                    <div className="thread-tools">
                      <button type="button" className="icon-btn bare drag-handle" draggable aria-label={`Drag to reorder ${formatRef(linkRef(l))}`} title="Drag to reorder"
                        onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", l.id); setDrag({ from: i, over: i }); }}
                        onDragEnd={() => setDrag({ from: null, over: null })}><Icon name="drag" size={18} /></button>
                      <button type="button" className="icon-btn bare" disabled={i === 0} aria-label={`Move ${formatRef(linkRef(l))} up`} onClick={() => move(i, i - 1)}><Icon name="arrowUp" size={16} /></button>
                      <button type="button" className="icon-btn bare" disabled={i === links.length - 1} aria-label={`Move ${formatRef(linkRef(l))} down`} onClick={() => move(i, i + 1)}><Icon name="arrowDown" size={16} /></button>
                      <button type="button" className="icon-btn bare" aria-label={`Edit the label of ${formatRef(linkRef(l))}`} onClick={() => { setLabelDraft(l.label || ""); setEditing(l.id); }}><Icon name="pencil" size={16} /></button>
                      <button type="button" className="icon-btn bare" aria-label={`Remove ${formatRef(linkRef(l))} from this thread`} onClick={() => drop(l)}><Icon name="trash" size={16} /></button>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ol>
          <div className="next-slot"><i aria-hidden="true" /><span>Next link: add one yourself, or ask for a suggestion</span></div>

          {suggestions?.length > 0 && (
            <section className="stack-sm" style={{ marginTop: 18 }} aria-label="Suggested next links">
              <div className="label">Suggested next links</div>
              {suggestions.map((s) => (
                <div key={formatRef(s.passage)} className="card stack-sm">
                  <div className="refline">{formatRef(s.passage)}</div>
                  <div className="scripture" style={{ fontSize: 14.5, lineHeight: 1.6 }}>{kjvText(s.passage.book, s.passage.chapter, s.passage.verseStart, s.passage.verseEnd).slice(0, 240)}</div>
                  {s.reason && <div className="muted2" style={{ fontSize: 13 }}>{s.reason}</div>}
                  <div className="row">
                    <button type="button" className="btn btn-sm btn-accent" style={{ minHeight: 44 }} onClick={() => add(s.passage)}>Add to thread</button>
                    <button type="button" className="btn btn-sm btn-quiet" style={{ minHeight: 44 }} onClick={() => setSuggestions((list) => list.filter((x) => x !== s))}>Dismiss</button>
                  </div>
                </div>
              ))}
            </section>
          )}
          {problem && <p className="notice error" role="alert" style={{ marginTop: 14 }}>{problem}</p>}
        </main>
      </div>
      <div className="foot" style={{ gap: 8 }}>
        <div className="btn-row">
          <button type="button" className="btn btn-outline btn-lg btn-wrap" onClick={() => setSheet("add")}>Add a passage</button>
          <button type="button" className="btn btn-lg btn-wrap" onClick={suggest} disabled={busy !== null}>{busy === "suggest" ? "Thinking…" : "Suggest the next link"}</button>
        </div>
        <button type="button" className="btn btn-accent btn-lg btn-wrap" onClick={outline} disabled={busy !== null || !links.length}>
          {busy === "outline" ? "Writing the outline…" : "Turn this thread into a lesson outline"}
        </button>
      </div>

      {sheet === "add" && <AddPassageSheet onAdd={add} onClose={() => setSheet(null)} />}
      {sheet === "rename" && (
        <Sheet title="Rename thread" onClose={() => setSheet(null)}>
          <form className="stack" onSubmit={(e) => { e.preventDefault(); if (titleDraft.trim()) { patch("threads", thread.id, { title: titleDraft.trim() }); setSheet(null); } }}>
            <label className="field"><span>Title</span><input className="input" data-autofocus value={titleDraft} onChange={(e) => setTitleDraft(e.target.value)} maxLength={80} /></label>
            <button type="submit" className="btn btn-accent btn-lg" disabled={!titleDraft.trim()}>Save</button>
          </form>
        </Sheet>
      )}
    </div>
  );
}
