import { BUCKETS, deleteMedia, getRow, getRows, put, remove } from "./store.js";

const UNDO_WINDOW = 8000;

/**
 * Delete a note (and its recordings) with a way back.
 * The rows go at once; the stored files are only removed after the undo
 * window has passed, so "Undo" restores everything.
 */
export function deleteNoteWithUndo(noteId, toast) {
  const note = remove("notes", noteId);
  if (!note) return;
  const recordings = getRows("recordings").filter((r) => r.note_id === noteId).map((r) => remove("recordings", r.id));
  let undone = false;
  toast(`Deleted “${note.title || "Untitled note"}”`, {
    duration: UNDO_WINDOW,
    action: { label: "Undo", run: () => { undone = true; put("notes", note); recordings.forEach((r) => r && put("recordings", r)); } },
  });
  setTimeout(() => {
    if (undone || getRow("notes", noteId)) return;
    deleteMedia(BUCKETS.drawings, note.drawing_path);
    deleteMedia(BUCKETS.photos, note.photo_path);
    recordings.forEach((r) => r && deleteMedia(BUCKETS.recordings, r.storage_path));
  }, UNDO_WINDOW + 500);
}

/** Delete one recording with undo. */
export function deleteRecordingWithUndo(recordingId, toast) {
  const rec = remove("recordings", recordingId);
  if (!rec) return;
  let undone = false;
  toast("Recording deleted", { duration: UNDO_WINDOW, action: { label: "Undo", run: () => { undone = true; put("recordings", rec); } } });
  setTimeout(() => { if (!undone && !getRow("recordings", recordingId)) deleteMedia(BUCKETS.recordings, rec.storage_path); }, UNDO_WINDOW + 500);
}

/** Scale an image file down to fit `max` pixels on its long side; returns a JPEG blob. */
export async function resizeImage(file, max = 1600) {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    return blob || file;
  } catch { return file; }
}
