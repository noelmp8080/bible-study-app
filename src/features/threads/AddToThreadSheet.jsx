import { useState } from "react";
import { useNavigate } from "react-router";
import Sheet from "../../components/Sheet.jsx";
import Icon from "../../components/Icon.jsx";
import { useTable } from "../../hooks/useData.js";
import { put } from "../../lib/store.js";
import { useToast } from "../../hooks/useToast.js";
import { formatRef } from "../../lib/refs.js";
import { addLink } from "../../lib/threads.js";

/** "Add to thread" from the reader: pick an existing thread or start a new one. */
export default function AddToThreadSheet({ passages, onClose }) {
  const threads = useTable("threads");
  const links = useTable("thread_links");
  const [title, setTitle] = useState("");
  const toast = useToast();
  const navigate = useNavigate();
  const label = passages.map(formatRef).join(", ");

  function add(thread) {
    let current = links;
    for (const p of passages) current = [...current, addLink(thread.id, current, p)];
    toast(`Added ${label} to “${thread.title}”`, { action: { label: "Open", run: () => navigate(`/threads/${thread.id}`) } });
    onClose(true);
  }
  function create(e) {
    e.preventDefault();
    if (!title.trim()) return;
    add(put("threads", { title: title.trim() }));
  }

  return (
    <Sheet title="Add to a thread" onClose={() => onClose(false)}>
      <p className="muted2" style={{ fontSize: 13, marginBottom: 12 }}>{label}</p>
      {threads.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          {[...threads].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))).map((t) => (
            <button key={t.id} type="button" className="list-link" onClick={() => add(t)}>
              <span><strong>{t.title}</strong><small>{links.filter((l) => l.thread_id === t.id).length} passages</small></span>
              <Icon name="plus" size={16} stroke={2} />
            </button>
          ))}
        </div>
      )}
      <form className="stack-sm" onSubmit={create}>
        <label className="field">
          <span>Start a new thread</span>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="The idea you are tracing, e.g. The Lamb" />
        </label>
        <button type="submit" className="btn btn-accent" disabled={!title.trim()}>Create thread and add</button>
      </form>
    </Sheet>
  );
}
