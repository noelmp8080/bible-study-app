import { Link, useNavigate } from "react-router";
import Icon from "../../components/Icon.jsx";
import { useTable } from "../../hooks/useData.js";
import { useToast } from "../../hooks/useToast.js";
import { canRecord } from "../../hooks/useRecorder.js";
import { put, remove } from "../../lib/store.js";
import { clock } from "../../lib/format.js";

/** /sermon — start a session or reopen an earlier one. The session itself is SermonScreen. */
export default function SermonList() {
  const sessions = useTable("sermon_sessions");
  const pins = useTable("sermon_pins");
  const navigate = useNavigate();
  const toast = useToast();
  const sorted = [...sessions].sort((a, b) => String(b.started_at).localeCompare(String(a.started_at)));

  function start() {
    const now = new Date();
    const session = put("sermon_sessions", {
      title: now.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" }),
      started_at: now.toISOString(), duration_seconds: null, audio_path: null, mime_type: null, note_id: null,
    });
    navigate(`/sermon/${session.id}`);
  }
  function drop(session) {
    const kept = pins.filter((p) => p.session_id === session.id);
    remove("sermon_sessions", session.id);
    kept.forEach((p) => remove("sermon_pins", p.id));
    toast(`Deleted session “${session.title}”. Its note is kept.`, { action: { label: "Undo", run: () => { put("sermon_sessions", session); kept.forEach((p) => put("sermon_pins", p)); } } });
  }

  return (
    <div className="screen">
      <header className="page-head">
        <Link className="back-link" to="/"><Icon name="chevLeft" size={14} stroke={2} />Today</Link>
        <div className="eyebrow">Sermon mode</div>
        <h1 className="display">Listen and pin</h1>
        <p className="lede">Record the message, pin verses and thoughts to the moment they were said, and finish with one study note. No signal needed.</p>
      </header>
      <div className="screen-scroll">
        <main className="pad wrap-narrow stack">
          <button type="button" className="btn btn-accent btn-lg" onClick={start}><Icon name="mic" size={16} />Start a new session</button>
          {!canRecord && <p className="notice">This browser cannot record audio. You can still pin verses and notes with a timer.</p>}
          {sorted.length > 0 && <div className="label">Earlier sessions</div>}
          <div className="stack-sm">
            {sorted.map((s) => {
              const count = pins.filter((p) => p.session_id === s.id).length;
              return (
                <div key={s.id} className="row" style={{ gap: 8, alignItems: "stretch" }}>
                  <Link className="result grow" to={`/sermon/${s.id}`}>
                    <span className="display" style={{ display: "block", fontSize: 22, lineHeight: 1.15 }}>{s.title}</span>
                    <span className="muted2" style={{ display: "block", fontSize: 13, marginTop: 4 }}>
                      {s.duration_seconds != null ? clock(s.duration_seconds) : "Not finished"} · {count} pin{count === 1 ? "" : "s"}
                    </span>
                  </Link>
                  <button type="button" className="icon-btn" style={{ height: "auto" }} aria-label={`Delete session ${s.title}`} onClick={() => drop(s)}><Icon name="trash" size={16} /></button>
                </div>
              );
            })}
          </div>
        </main>
      </div>
    </div>
  );
}
