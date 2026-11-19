// Memory trainer: the four masking steps and the self-rated review schedule.
import { getRows, put, patch } from "./store.js";

export const STEPS = ["Read it through", "Every third word hidden", "Every other word hidden", "First letters only"];
export const MAX_INTERVAL = 120;

/**
 * Split text into words for a step (0–3). A hidden word keeps its first
 * letter and its punctuation; the other letters become dots.
 */
export function maskWords(text, step) {
  return String(text || "").split(/\s+/).filter(Boolean).map((word, i) => {
    const hide = step === 1 ? i % 3 === 2 : step === 2 ? i % 2 === 1 : step === 3;
    if (!hide) return { text: word, hidden: false };
    const m = word.match(/^([^A-Za-z]*)([A-Za-z])([A-Za-z']*)(.*)$/);
    return { text: m ? m[1] + m[2] + m[3].replace(/./g, "·") + m[4] : word, hidden: true };
  });
}

/**
 * Next interval in days for a rating.
 *   shaky    → 1 (resets)
 *   got_it   → 3
 *   by_heart → 7, then doubling on each further "by heart" (14, 28, …) up to 120
 */
export function nextInterval(row, rating) {
  if (rating === "shaky") return 1;
  if (rating === "got_it") return 3;
  const wasByHeart = row.last_result === "by_heart" && row.interval_days >= 7;
  return wasByHeart ? Math.min(MAX_INTERVAL, row.interval_days * 2) : 7;
}

export function describeInterval(days) {
  if (days === 1) return "again tomorrow";
  if (days === 7) return "in a week";
  if (days % 7 === 0 && days <= 28) return `in ${days / 7} weeks`;
  return `in ${days} days`;
}

/** Apply a rating: returns the updated row (due at the same clock time N days on). */
export function rate(row, rating, now = new Date()) {
  const interval_days = nextInterval(row, rating);
  const due = new Date(now.getTime() + interval_days * 86400000);
  return patch("memory_verses", row.id, { interval_days, due_at: due.toISOString(), last_result: rating });
}

export const isDue = (row, now = Date.now()) => new Date(row.due_at).getTime() <= now;
export const dueVerses = (rows, now = Date.now()) =>
  rows.filter((r) => isDue(r, now)).sort((a, b) => new Date(a.due_at) - new Date(b.due_at));

/** Add a passage to the queue, due immediately. Returns false if it is already there. */
export function addMemoryVerse({ book, chapter, verseStart, verseEnd, translation }) {
  const exists = getRows("memory_verses").some((r) =>
    r.book === book && r.chapter === chapter && r.verse_start === verseStart && r.verse_end === verseEnd);
  if (exists) return false;
  put("memory_verses", {
    book, chapter, verse_start: verseStart, verse_end: verseEnd, translation,
    interval_days: 0, due_at: new Date().toISOString(), last_result: null,
  });
  return true;
}
