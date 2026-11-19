import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import Icon from "../../components/Icon.jsx";
import { useTable } from "../../hooks/useData.js";
import { useRecorder } from "../../hooks/useRecorder.js";
import { useMediaUrl } from "../../hooks/useMediaUrl.js";
import { useOnline } from "../../hooks/useOnline.js";
import { useToast } from "../../hooks/useToast.js";
import { BUCKETS, kvGet, kvSet, patch, put, remove } from "../../lib/store.js";
import { formatRef, parseReference } from "../../lib/refs.js";
import { kjvText, refExists } from "../../lib/bible.js";
import { clock } from "../../lib/format.js";
import { addSummary, draftKey, finishSession, hasSummary, pinRef, sortPins } from "../../lib/sermon.js";

const BARS = 24;

function useWakeLock(active) {
  const [held, setHeld] = useState(false);
  useEffect(() => {
    if (!active || !("wakeLock" in navigator)) return undefined;
    let lock = null, alive = true;
    const acquire = () => navigator.wakeLock.request("screen").then((l) => {
      if (!alive) { l.release().catch(() => {}); return; }
      lock = l; setHeld(true);
      l.addEventListener("release", () => { if (alive) setHeld(false); });
    }).catch(() => {});
    const onVisible = () => { if (document.visibilityState === "visible") acquire(); };
    acquire();
    document.addEventListener("visibilitychange", onVisible);
    return () => { alive = false; document.removeEventListener("visibilitychange", onVisible); lock?.release().catch(() => {}); };
  }, [active]);
  return active && held;
}

function Pin({ pin, onSeek, canSeek }) {
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(pin.body || "");
  const time = clock(pin.offset_seconds);
  const isRef = pin.kind === "ref";
  function drop() {
    remove("sermon_pins", pin.id);
    toast("Pin removed", { action: { label: "Undo", run: () => put("sermon_pins", pin) } });
  }
  return (
    <article className="pin">
      <button type="button" className="time" disabled={!canSeek} onClick={() => onSeek(pin.offset_seconds)}
        aria-label={canSeek ? `Play from ${time}` : `Pinned at ${time}`}>{time}</button>
      <div className="grow">
        <div className="refline" style={isRef ? undefined : { color: "var(--muted)" }}>{isRef ? formatRef(pinRef(pin)) : pin.kind === "mark" && !pin.body ? "Marked moment" : "Your note"}</div>
        {isRef && <div className="scripture" style={{ marginTop: 4 }}>{kjvText(pin.book, pin.chapter, pin.verse_start, pin.verse_end)}</div>}
        {!isRef && !editing && pin.body && <div style={{ fontSize: 14, lineHeight: 1.55, marginTop: 4 }}>{pin.body}</div>}
        {!isRef && editing && (
          <form className="row" style={{ gap: 8, marginTop: 6 }} onSubmit={(e) => { e.preventDefault(); patch("sermon_pins", pin.id, { body: draft.trim() }); setEditing(false); }}>
            <label className="sr-only" htmlFor={`pin-${pin.id}`}>Note for {time}</label>
            <input id={`pin-${pin.id}`} className="input" autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="What was said here?" />
            <button type="submit" className="btn">Save</button>
          </form>
        )}
        <div className="row" style={{ gap: 4, marginTop: 4 }}>
          {!isRef && !editing && <button type="button" className="btn btn-sm btn-plain" style={{ minHeight: 44 }} onClick={() => { setDraft(pin.body || ""); setEditing(true); }}>{pin.body ? "Edit" : "Fill in"}</button>}
          <button type="button" className="btn btn-sm btn-plain" style={{ minHeight: 44 }} onClick={drop} aria-label={`Remove the pin at ${time}`}>Remove</button>
        </div>
      </div>
    </article>
  );
}

/** Spec B2. Always dark. Everything is written to this device first and synced later. */
export default function SermonScreen() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const online = useOnline();
  const session = useTable("sermon_sessions").find((s) => s.id === id);
  const allPins = useTable("sermon_pins");
  const notes = useTable("notes");
  const pins = useMemo(() => sortPins(allPins.filter((p) => p.session_id === id)), [allPins, id]);

  const recorder = useRecorder({ meter: true, bars: BARS, onProgress: (draft) => kvSet(draftKey(id), draft) });
  const [live, setLive] = useState(null); // { startedAt, audio } while a session is running
  const [seconds, setSeconds] = useState(0);
  const [entry, setEntry] = useState("");
  const [busy, setBusy] = useState(null);
  const [problem, setProblem] = useState(null);
  const [draft, setDraft] = useState(null);
  const audioRef = useRef(null);
  const wakeLock = useWakeLock(!!live);

  const finished = session?.duration_seconds != null;
  const audioUrl = useMediaUrl(BUCKETS.recordings, finished ? session.audio_path : null);
  const note = session?.note_id ? notes.find((n) => n.id === session.note_id) : null;

  useEffect(() => {
    if (!live) return undefined;
    const t = setInterval(() => setSeconds(Math.floor((Date.now() - live.startedAt) / 1000)), 500);
    return () => clearInterval(t);
  }, [live]);
  // An interrupted recording leaves its audio-so-far on the device.
  useEffect(() => { let alive = true; kvGet(draftKey(id)).then((d) => { if (alive && d?.blob) setDraft(d); }); return () => { alive = false; }; }, [id]);

  if (!session) {
    return <div className="screen sermon" data-theme="dark" style={{ height: "100dvh" }}><div className="empty"><p>This session is not on this device.</p><p style={{ marginTop: 12 }}><Link className="btn btn-outline" to="/sermon">Sermon mode</Link></p></div></div>;
  }

  const elapsed = () => (live ? Math.floor((Date.now() - live.startedAt) / 1000) : 0); // read at the moment of a tap

  async function start() {
    setProblem(null);
    const audio = await recorder.start();
    setSeconds(0);
    setLive({ startedAt: Date.now(), audio });
  }
  function addPin(kind, extra = {}) {
    put("sermon_pins", { session_id: id, offset_seconds: elapsed(), kind, book: null, chapter: null, verse_start: null, verse_end: null, body: "", ...extra });
  }
  function pinEntry(e) {
    e.preventDefault();
    const text = entry.trim();
    if (!text) return;
    const parsed = parseReference(text);
    const passage = parsed && { ...parsed, verseStart: parsed.verseStart || 1, verseEnd: parsed.verseEnd || parsed.verseStart || 1 };
    if (passage && refExists(passage)) addPin("ref", { book: passage.book, chapter: passage.chapter, verse_start: passage.verseStart, verse_end: passage.verseEnd });
    else addPin("note", { body: text });
    setEntry("");
  }
  async function finish(recording) {
    setBusy("save");
    const saved = await finishSession(session, pins, recording);
    setLive(null); setDraft(null);
    toast("Session saved as a study note", { action: { label: "Open note", run: () => navigate(`/notes/${saved.id}`) } });
    setBusy(null);
    if (navigator.onLine) summarise({ ...session, note_id: saved.id }, true);
  }
  async function stopAndSave() {
    const duration = elapsed();
    const result = live.audio ? await recorder.stop() : null;
    await finish(result || { blob: null, mime: null, duration });
  }
  async function summarise(target = session, quiet = false) {
    setBusy("summary"); setProblem(null);
    try { await addSummary(target, pins); if (!quiet) toast("Summary added to the note"); }
    catch (err) { if (!quiet) setProblem(err.message); }
    setBusy(null);
  }
  function seek(offset) {
    const el = audioRef.current;
    if (!el) return;
    el.currentTime = offset;
    el.play().catch(() => {});
  }

  const status = live ? (live.audio ? "Recording" : "Timing (no microphone)") : finished ? "Saved" : "Ready";
  return (
    <div className="screen sermon" data-theme="dark" style={{ height: "100dvh" }}>
      <header className="page-head stack" style={{ gap: 14, borderBottomColor: "var(--border-strong)" }}>
        <div className="row-between" style={{ alignItems: "flex-start" }}>
          <div>
            {!live && <Link className="back-link" to="/sermon"><Icon name="chevLeft" size={14} stroke={2} />Sermon mode</Link>}
            <div className="eyebrow">Sermon mode{wakeLock ? " · screen stays on" : ""}</div>
            <h1 className="display" style={{ fontSize: 38 }}>{session.title}</h1>
          </div>
          <div style={{ textAlign: "right" }}>
            <div className="tnum" style={{ fontSize: 26, fontWeight: 600, color: "var(--heading)" }} aria-label="Elapsed time">{clock(finished ? session.duration_seconds : seconds)}</div>
            <div className="row" role="status" style={{ justifyContent: "flex-end", gap: 6, fontSize: 11, fontWeight: 600, color: live ? "var(--accent)" : "var(--muted)", marginTop: 2 }}>
              {live?.audio && <span className="rec-dot pulse" />}{status}
            </div>
          </div>
        </div>
        {live && (
          <div className="levels" aria-hidden="true">
            {Array.from({ length: BARS }, (_, i) => {
              const v = recorder.levels[recorder.levels.length - BARS + i] ?? 0;
              return <i key={i} className={i >= BARS - 4 ? "live" : undefined} style={{ height: `${Math.max(3, Math.round(v * 34))}px` }} />;
            })}
          </div>
        )}
        <p className="muted" style={{ fontSize: 12 }}>
          {finished ? (online ? "Kept on this device and synced to your account." : "Kept on this device. It will sync when you are back online.")
            : "No signal needed. Everything is kept on this phone and syncs when you are back online."}
        </p>
      </header>

      <div className="screen-scroll">
        <main className="pad wrap-narrow stack" style={{ gap: 10, paddingTop: 14 }}>
          {!live && !finished && (
            <div className="stack">
              <button type="button" className="btn btn-accent btn-lg" onClick={start}><Icon name="mic" size={16} />Start recording</button>
              {draft && (
                <div className="notice">
                  <p>A recording from this session was interrupted. {clock(draft.duration)} of audio was kept on this device.</p>
                  <button type="button" className="btn btn-sm btn-outline" style={{ marginTop: 8, minHeight: 44 }} disabled={busy !== null} onClick={() => finish(draft)}>Save what was recorded</button>
                </div>
              )}
            </div>
          )}
          {recorder.error && <p className="notice error" role="alert">{recorder.error} Pins will still be timed.</p>}

          {finished && (
            <div className="stack-sm">
              {session.audio_path
                ? (audioUrl ? <audio ref={audioRef} controls src={audioUrl} style={{ width: "100%" }} /> : <p className="muted" role="status">Loading the recording…</p>)
                : <p className="muted">This session has no audio.</p>}
              <div className="row" style={{ flexWrap: "wrap" }}>
                {note && <Link className="btn btn-outline" to={`/notes/${note.id}`}><Icon name="notes" size={15} />Open the study note</Link>}
                {note && !hasSummary(note) && pins.length > 0 && (
                  <button type="button" className="btn" disabled={busy !== null || !online} onClick={() => summarise()}>
                    <Icon name="ask" size={15} />{busy === "summary" ? "Summarising…" : online ? "Add AI summary" : "Summary needs a connection"}
                  </button>
                )}
              </div>
            </div>
          )}

          {(live || finished) && (
            <form className="row" style={{ gap: 8 }} onSubmit={pinEntry}>
              <label className="sr-only" htmlFor="pin-entry">Reference or note</label>
              <input id="pin-entry" className="input" value={entry} onChange={(e) => setEntry(e.target.value)} placeholder="Type a reference or a thought…" autoComplete="off" disabled={!live} />
              <button type="submit" className="btn" style={{ fontWeight: 700 }} disabled={!live || !entry.trim()}>Pin</button>
            </form>
          )}

          {pins.length > 0 && <div className="label" style={{ marginTop: 4 }}>Pinned to the recording</div>}
          {pins.map((pin) => <Pin key={pin.id} pin={pin} canSeek={finished && !!audioUrl} onSeek={seek} />)}
          {problem && <p className="notice error" role="alert">{problem}</p>}
        </main>
      </div>

      {live && (
        <div className="foot" style={{ borderTopColor: "var(--border-strong)" }}>
          <p className="muted" style={{ fontSize: 12, lineHeight: 1.5 }}>When you stop, your pins become one study note with a summary, the key points and one thing to do this week.</p>
          <div className="btn-row">
            <button type="button" className="btn btn-outline btn-lg" onClick={() => addPin("mark")}>Mark this moment</button>
            <button type="button" className="btn btn-accent btn-lg" style={{ fontWeight: 700 }} disabled={busy !== null} onClick={stopAndSave}>{busy === "save" ? "Saving…" : "Stop and save"}</button>
          </div>
        </div>
      )}
    </div>
  );
}
