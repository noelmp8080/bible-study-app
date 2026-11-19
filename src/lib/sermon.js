import { BUCKETS, getRow, kvSet, mediaPath, patch, put, saveMedia } from "./store.js";
import { formatRef } from "./refs.js";
import { kjvText } from "./bible.js";
import { clock } from "./format.js";
import { runTask } from "./ai.js";

export const draftKey = (sessionId) => `sermon-draft:${sessionId}`;
export const pinRef = (pin) => ({ book: pin.book, chapter: pin.chapter, verseStart: pin.verse_start, verseEnd: pin.verse_end });
export const sortPins = (pins) => [...pins].sort((a, b) => a.offset_seconds - b.offset_seconds);
const SUMMARY_MARK = "\n\nSummary\n";
export const hasSummary = (note) => !!note?.text?.includes(SUMMARY_MARK);

function pinLine(pin) {
  const time = `[${clock(pin.offset_seconds)}]`;
  if (pin.kind === "ref") return `${time} ${formatRef(pinRef(pin))} — ${kjvText(pin.book, pin.chapter, pin.verse_start, pin.verse_end)}`;
  return `${time} ${pin.body?.trim() || "(marked moment)"}`;
}

/**
 * Finish a session: keep the audio (on this device first, uploaded when
 * online), write one study note with the pins in order, and link them all.
 * Works with no connection. `blob` is null for a session without audio.
 */
export async function finishSession(session, pins, { blob, mime, duration }) {
  const ordered = sortPins(pins);
  const path = blob ? mediaPath(`sermon-${session.id}`, mime === "audio/webm" ? "webm" : "m4a") : null;
  if (blob) await saveMedia(BUCKETS.recordings, path, blob);
  const firstRef = ordered.find((p) => p.kind === "ref");
  const note = put("notes", {
    title: `Sermon · ${session.title}`,
    text: ordered.length ? ordered.map(pinLine).join("\n") : "No pins were added during this recording.",
    ref: firstRef ? formatRef(pinRef(firstRef)) : "",
    tags: ["Sermon"], has_audio: !!blob, has_image: false,
    book: firstRef?.book || null, chapter: firstRef?.chapter || null,
    verse_start: firstRef?.verse_start || null, verse_end: firstRef?.verse_end || null,
    updated_at: new Date().toISOString(),
  });
  if (blob) put("recordings", { note_id: note.id, label: session.title, duration, mime_type: mime, storage_path: path });
  patch("sermon_sessions", session.id, { duration_seconds: duration, audio_path: path, mime_type: blob ? mime : null, note_id: note.id });
  await kvSet(draftKey(session.id), null);
  return note;
}

/**
 * Ask the Edge Function for a summary, key points and one action step drawn
 * only from the pins, and append them to the session's note. Throws AiError
 * when offline or the function is unavailable; the note is left as it was.
 */
export async function addSummary(session, pins) {
  const note = getRow("notes", session.note_id);
  if (!note || hasSummary(note)) return note;
  const ordered = sortPins(pins).filter((p) => p.kind === "ref" || p.body?.trim());
  if (!ordered.length) return note;
  const result = await runTask("sermon_summary", {
    title: session.title,
    pins: ordered.map((p) => ({
      time: clock(p.offset_seconds), kind: p.kind,
      ref: p.kind === "ref" ? formatRef(pinRef(p)) : null,
      text: p.kind === "ref" ? kjvText(p.book, p.chapter, p.verse_start, p.verse_end) : p.body,
    })),
  });
  const points = (result.key_points || []).map((k) => `• ${k}`).join("\n");
  const addition = `${SUMMARY_MARK}${result.summary || ""}\n\nKey points\n${points}\n\nThis week\n${result.action_step || ""}`;
  return patch("notes", note.id, { text: `${getRow("notes", note.id).text}${addition}`, updated_at: new Date().toISOString() });
}
