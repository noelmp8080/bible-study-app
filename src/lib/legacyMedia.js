// Media saved before the upgrade lives inside table rows: drawings as a data
// URL in notes.drawing, recordings as base64 in recordings.audio_data. These
// helpers read that data on demand and move it to Storage, without deleting
// the old columns (nothing is dropped; a later migration can do that).
import { supabase } from "./supabase.js";
import { BUCKETS, currentUserId, getRow, mediaPath, patch, saveMedia } from "./store.js";

// WebM starts with 1A 45 DF A3; MP4 has "ftyp" at bytes 4–7.
function sniffMime(bytes, fallback) {
  if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) return "audio/webm";
  if (bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) return "audio/mp4";
  return fallback || "audio/mp4";
}

function base64ToBytes(base64) {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export function dataUrlToBlob(dataUrl) {
  const [head, body] = String(dataUrl).split(",");
  const type = /data:([^;]+)/.exec(head)?.[1] || "image/png";
  return new Blob([base64ToBytes(body)], { type });
}

/** Move a note's old inline drawing to Storage. Returns the new path, or null if there was none. */
export async function migrateLegacyDrawing(noteId) {
  if (!currentUserId() || !navigator.onLine) return null;
  const { data, error } = await supabase.from("notes").select("drawing").eq("id", noteId).maybeSingle();
  const dataUrl = data?.drawing?.dataUrl;
  if (error || !dataUrl) return null;
  const path = mediaPath(`${noteId}-drawing`, "png");
  await saveMedia(BUCKETS.drawings, path, dataUrlToBlob(dataUrl));
  if (getRow("notes", noteId)) patch("notes", noteId, { drawing_path: path });
  return path;
}

/** Move a recording's old base64 audio to Storage. Returns the new path, or null. */
export async function migrateLegacyRecording(recording) {
  if (!currentUserId() || !navigator.onLine) return null;
  const { data, error } = await supabase.from("recordings").select("audio_data,mime_type").eq("id", recording.id).maybeSingle();
  if (error || !data?.audio_data) return null;
  const raw = data.audio_data.startsWith("data:") ? data.audio_data.split(",")[1] : data.audio_data;
  let bytes;
  try { bytes = base64ToBytes(raw); } catch { return null; }
  const mime = sniffMime(bytes, data.mime_type);
  const path = mediaPath(recording.id, mime === "audio/webm" ? "webm" : "m4a");
  await saveMedia(BUCKETS.recordings, path, new Blob([bytes], { type: mime }));
  if (getRow("recordings", recording.id)) patch("recordings", recording.id, { storage_path: path, mime_type: mime });
  return path;
}
