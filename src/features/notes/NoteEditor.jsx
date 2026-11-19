import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router";
import Icon from "../../components/Icon.jsx";
import DrawingCanvas from "./DrawingCanvas.jsx";
import { useTable } from "../../hooks/useData.js";
import { usePrefs } from "../../hooks/usePrefs.js";
import { useMediaUrl } from "../../hooks/useMediaUrl.js";
import { useRecorder, canRecord } from "../../hooks/useRecorder.js";
import { useToast } from "../../hooks/useToast.js";
import { BUCKETS, mediaPath, newId, put, saveMedia } from "../../lib/store.js";
import { formatRef, parseReference } from "../../lib/refs.js";
import { noteLink } from "../../lib/notes.js";
import { readPath } from "../../lib/books.js";
import { clock } from "../../lib/format.js";
import { runTask } from "../../lib/ai.js";
import { migrateLegacyDrawing, migrateLegacyRecording } from "../../lib/legacyMedia.js";
import { deleteNoteWithUndo, deleteRecordingWithUndo, resizeImage } from "../../lib/noteActions.js";

/** /notes/new and /notes/:id */
export default function NoteEditor() {
  const { id } = useParams();
  const location = useLocation();
  const notes = useTable("notes");
  const note = id === "new" ? null : notes.find((n) => n.id === id);
  if (id !== "new" && !note) {
    return (
      <div className="screen"><div className="empty">
        <p>This note is not on this device. It may have been deleted.</p>
        <p style={{ marginTop: 12 }}><Link className="btn btn-outline" to="/notes">Back to notes</Link></p>
      </div></div>
    );
  }
  return <Editor key={id} note={note} startLink={location.state?.link || null} />;
}

function SavedRecording({ rec }) {
  const toast = useToast();
  const url = useMediaUrl(BUCKETS.recordings, rec.storage_path);
  const [failed, setFailed] = useState(false);
  // Recordings made before the upgrade are base64 in the row: move them to Storage on first open.
  useEffect(() => {
    if (rec.storage_path) return undefined;
    let alive = true;
    migrateLegacyRecording(rec).then((path) => { if (alive && !path) setFailed(true); });
    return () => { alive = false; };
  }, [rec]);
  return (
    <div className="card-quiet stack-sm">
      <div className="row-between">
        <span className="muted2" style={{ fontSize: 12 }}>{rec.label}{rec.duration > 0 ? ` · ${clock(rec.duration)}` : ""}</span>
        <button type="button" className="icon-btn bare" aria-label={`Delete recording ${rec.label}`} onClick={() => deleteRecordingWithUndo(rec.id, toast)}><Icon name="trash" size={16} /></button>
      </div>
      {url ? <audio controls src={url} style={{ width: "100%" }} onError={() => setFailed(true)} />
        : <p className="muted" style={{ fontSize: 12 }}>{failed ? "This audio is not available on this device right now." : "Loading audio…"}</p>}
      {url && failed && <p className="notice error">Playback failed. The recording may be in a format this browser cannot play.</p>}
    </div>
  );
}

function Editor({ note, startLink }) {
  const navigate = useNavigate();
  const toast = useToast();
  const [prefs] = usePrefs();
  const [noteId] = useState(() => note?.id || newId());
  const initialLink = useMemo(() => startLink || (note ? noteLink(note) : null), [startLink, note]);
  const initialRef = note?.ref || startLink?.ref || (initialLink ? formatRef(initialLink) : "");

  const [title, setTitle] = useState(note?.title || "");
  const [ref, setRef] = useState(initialRef);
  const [text, setText] = useState(note?.text || "");
  const [tags, setTags] = useState((note?.tags || []).join(", "));
  // undefined = unchanged, null = removed, { blob, url } = new file waiting for Save
  const [drawingEdit, setDrawingEdit] = useState(undefined);
  const [photoEdit, setPhotoEdit] = useState(undefined);
  const [showCanvas, setShowCanvas] = useState(false);
  const [staged, setStaged] = useState([]); // new recordings waiting for Save
  const [busy, setBusy] = useState(null);
  const [problem, setProblem] = useState(null);
  const photoInput = useRef(null);
  const recorder = useRecorder();

  const allRecordings = useTable("recordings");
  const saved = useMemo(
    () => allRecordings.filter((r) => r.note_id === noteId).sort((a, b) => String(a.created_at).localeCompare(String(b.created_at))),
    [allRecordings, noteId]);

  // The link follows the reference field when it parses; otherwise the passage the note was started from.
  const typed = parseReference(ref);
  const link = typed || (ref.trim() === initialRef.trim() ? initialLink : null);

  const savedDrawing = useMediaUrl(BUCKETS.drawings, drawingEdit === undefined ? note?.drawing_path : null);
  const savedPhoto = useMediaUrl(BUCKETS.photos, photoEdit === undefined ? note?.photo_path : null);
  const drawingUrl = drawingEdit?.url || savedDrawing;
  const photoUrl = photoEdit?.url || savedPhoto;
  const staging = (blob) => ({ blob, url: URL.createObjectURL(blob) });

  // A drawing saved before the upgrade is still inside the row: move it to Storage once.
  useEffect(() => { if (note && !note.drawing_path) migrateLegacyDrawing(note.id); }, [note]);
  // Preview URLs for files not saved yet are released when the editor closes.
  const previews = useRef([]);
  useEffect(() => { previews.current = [...staged.map((s) => s.url), drawingEdit?.url, photoEdit?.url].filter(Boolean); }, [staged, drawingEdit, photoEdit]);
  useEffect(() => () => previews.current.forEach((url) => URL.revokeObjectURL(url)), []);

  async function toggleRecording() {
    if (!recorder.recording) { await recorder.start(); return; }
    const result = await recorder.stop();
    if (!result) { setProblem("The recording was empty. Please try again."); return; }
    const label = new Date().toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
    setStaged((list) => [...list, { id: newId(), ...result, label, url: URL.createObjectURL(result.blob) }]);
  }

  async function onPhoto(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) setPhotoEdit(staging(await resizeImage(file)));
  }

  async function smartSummary() {
    setBusy("summary"); setProblem(null);
    try {
      const result = await runTask("summary", { ref: ref.trim() || `${prefs.current_book} ${prefs.current_chapter}`, translation: prefs.translation });
      setText((t) => (t.trim() ? `${t.trim()}\n\n${result.text}` : result.text));
    } catch (err) { setProblem(err.message); }
    setBusy(null);
  }

  async function save() {
    if (!title.trim() || busy) return;
    setBusy("save");
    let recordingResult = null;
    if (recorder.recording) recordingResult = await recorder.stop();
    const newRecordings = recordingResult
      ? [...staged, { id: newId(), ...recordingResult, label: new Date().toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) }]
      : staged;

    let drawing_path = note?.drawing_path || null;
    if (drawingEdit === null) drawing_path = null;
    else if (drawingEdit) { drawing_path = mediaPath(`${noteId}-drawing-${Date.now()}`, "png"); await saveMedia(BUCKETS.drawings, drawing_path, drawingEdit.blob); }
    let photo_path = note?.photo_path || null;
    if (photoEdit === null) photo_path = null;
    else if (photoEdit) { photo_path = mediaPath(`${noteId}-photo-${Date.now()}`, "jpg"); await saveMedia(BUCKETS.photos, photo_path, photoEdit.blob); }

    put("notes", {
      ...(note || {}),
      id: noteId,
      title: title.trim(),
      ref: ref.trim(),
      text: text.trim(),
      tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
      has_audio: saved.length + newRecordings.length > 0,
      has_image: !!photo_path,
      book: link?.book || null,
      chapter: link?.chapter || null,
      verse_start: link?.verseStart || null,
      verse_end: link?.verseEnd || link?.verseStart || null,
      drawing_path, photo_path,
      updated_at: new Date().toISOString(),
    });
    for (const r of newRecordings) {
      const storage_path = mediaPath(r.id, r.mime === "audio/webm" ? "webm" : "m4a");
      await saveMedia(BUCKETS.recordings, storage_path, r.blob);
      put("recordings", { id: r.id, note_id: noteId, label: r.label, duration: r.duration, mime_type: r.mime, storage_path });
    }
    toast(note ? "Note saved" : "Note added");
    navigate(-1);
  }

  const hasDrawing = !!drawingUrl || (drawingEdit === undefined && !!note?.drawing_path);
  const hasPhoto = !!photoUrl || (photoEdit === undefined && !!note?.photo_path);

  return (
    <div className="screen">
      <header className="page-head">
        <button type="button" className="back-link" onClick={() => navigate(-1)}><Icon name="chevLeft" size={14} stroke={2} />Back</button>
        <h1 className="display" style={{ fontSize: 40 }}>{note ? "Edit note" : "New study note"}</h1>
      </header>
      <div className="screen-scroll">
        <form className="pad wrap-narrow stack" onSubmit={(e) => { e.preventDefault(); save(); }}>
          <label className="field"><span>Title</span>
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Note title" autoComplete="off" required />
          </label>
          <label className="field"><span>Verse reference</span>
            <input className="input" value={ref} onChange={(e) => setRef(e.target.value)} placeholder="e.g. John 3:16 or Romans 8:28-30" autoComplete="off" autoCapitalize="words" />
          </label>
          {link && (
            <p className="muted2" style={{ fontSize: 12.5 }}>
              Linked to <Link to={readPath(link.book, link.chapter, link.verseStart || undefined)}>{formatRef(link)}</Link>. A marker will show on that verse in the reader.
            </p>
          )}
          <label className="field"><span>Notes</span>
            <textarea className="input" rows={8} value={text} onChange={(e) => setText(e.target.value)} placeholder="Write your study notes here" />
          </label>
          <label className="field"><span>Tags, separated by commas</span>
            <input className="input" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Grace, Faith" autoComplete="off" />
          </label>

          <div className="stack-sm">
            <div className="label">Attach</div>
            <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
              {canRecord && (
                <button type="button" className={`btn ${recorder.recording ? "btn-accent pulse" : ""}`} onClick={toggleRecording} aria-pressed={recorder.recording}>
                  <Icon name={recorder.recording ? "stop" : "mic"} size={15} />{recorder.recording ? `Stop · ${clock(recorder.seconds)}` : "Record"}
                </button>
              )}
              <button type="button" className="btn" onClick={() => photoInput.current?.click()}><Icon name="camera" size={15} />{hasPhoto ? "Retake photo" : "Snap photo"}</button>
              <input ref={photoInput} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={onPhoto} />
              <button type="button" className="btn" onClick={() => setShowCanvas((s) => !s)} aria-expanded={showCanvas}><Icon name="pencil" size={15} />{hasDrawing ? "Redraw" : "Draw"}</button>
              <button type="button" className="btn" onClick={smartSummary} disabled={busy === "summary"}><Icon name="ask" size={15} />{busy === "summary" ? "Summarising…" : "Smart summary"}</button>
            </div>
            {recorder.error && <p className="notice error" role="alert">{recorder.error}</p>}
          </div>

          {showCanvas && <DrawingCanvas onSave={(blob) => { setDrawingEdit(staging(blob)); setShowCanvas(false); }} onClose={() => setShowCanvas(false)} />}
          {drawingUrl && !showCanvas && (
            <figure style={{ margin: 0 }} className="stack-sm">
              <img src={drawingUrl} alt="Drawing attached to this note" style={{ border: "1px solid var(--border)", background: "#fff", maxHeight: 220, objectFit: "contain", width: "100%" }} />
              <div><button type="button" className="btn btn-sm btn-quiet" onClick={() => setDrawingEdit(null)}>Remove drawing</button></div>
            </figure>
          )}
          {photoUrl && (
            <figure style={{ margin: 0 }} className="stack-sm">
              <img src={photoUrl} alt="Attached to this note" style={{ border: "1px solid var(--border)", maxHeight: 320, objectFit: "contain", width: "100%" }} />
              <div><button type="button" className="btn btn-sm btn-quiet" onClick={() => setPhotoEdit(null)}>Remove photo</button></div>
            </figure>
          )}

          {(saved.length > 0 || staged.length > 0) && (
            <div className="stack-sm">
              <div className="label">Recordings</div>
              {saved.map((rec) => <SavedRecording key={rec.id} rec={rec} />)}
              {staged.map((rec) => (
                <div key={rec.id} className="card-quiet stack-sm">
                  <div className="row-between">
                    <span className="muted2" style={{ fontSize: 12 }}>{rec.label} · {clock(rec.duration)} · not saved yet</span>
                    <button type="button" className="icon-btn bare" aria-label="Discard this recording" onClick={() => setStaged((list) => list.filter((s) => s.id !== rec.id))}><Icon name="trash" size={16} /></button>
                  </div>
                  <audio controls src={rec.url} style={{ width: "100%" }} />
                </div>
              ))}
            </div>
          )}

          {problem && <p className="notice error" role="alert">{problem}</p>}
          {note && (
            <div><button type="button" className="btn btn-danger" onClick={() => { deleteNoteWithUndo(note.id, toast); navigate("/notes"); }}><Icon name="trash" size={15} />Delete note</button></div>
          )}
        </form>
      </div>
      <div className="foot">
        <button type="button" className="btn btn-accent btn-lg btn-block" disabled={!title.trim() || busy === "save"} onClick={save}>
          {busy === "save" ? "Saving…" : "Save note"}
        </button>
      </div>
    </div>
  );
}
