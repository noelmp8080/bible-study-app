import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { getBibleStatus, subscribeBible, getChapter, getPassage, kjvChapter, kjvText } from "../lib/bible.js";

/** "idle" | "loading" | "ready" | "error" for the local KJV. */
export const useBibleStatus = () => useSyncExternalStore(subscribeBible, getBibleStatus);

/**
 * Verses of one chapter as [{ verse, text }].
 * KJV is read synchronously once the local Bible is ready, so turning the page
 * never shows a loading state; other translations load per chapter.
 */
export function useChapter(translation, book, chapter) {
  const status = useBibleStatus();
  const key = `${translation}|${book}|${chapter}`;
  const local = useMemo(() => {
    if (translation !== "KJV" || status !== "ready") return null;
    return kjvChapter(book, chapter)?.map((text, i) => ({ verse: i + 1, text })) || null;
  }, [translation, book, chapter, status]);
  const [remote, setRemote] = useState({ key: null, verses: null, error: null });
  useEffect(() => {
    if (local) return undefined;
    let alive = true;
    getChapter(translation, book, chapter).then(
      (verses) => alive && setRemote({ key, verses, error: null }),
      (err) => alive && setRemote({ key, verses: null, error: err.message || "Could not load this chapter." }),
    );
    return () => { alive = false; };
  }, [key, local, translation, book, chapter]);
  if (local) return { verses: local, error: null, loading: false };
  const current = remote.key === key;
  return { verses: current ? remote.verses : null, error: current ? remote.error : null, loading: !current };
}

/**
 * Plain text of a passage in a given translation.
 * Returns { text, translation } where translation is the one actually used
 * (KJV when the requested one is not available offline).
 */
export function usePassage(translation, book, chapter, start, end) {
  const status = useBibleStatus();
  const key = `${translation}|${book}|${chapter}|${start}|${end}`;
  const [remote, setRemote] = useState({ key: null, text: "", translation });
  useEffect(() => {
    if (translation === "KJV" || !book) return undefined;
    let alive = true;
    getPassage(translation, book, chapter, start, end).then(
      (p) => alive && setRemote({ key, text: p.text, translation: p.translation }),
      () => alive && setRemote({ key, text: "", translation }),
    );
    return () => { alive = false; };
  }, [key, translation, book, chapter, start, end]);
  if (!book) return { text: "", translation, loading: false };
  if (translation === "KJV") return { text: status === "ready" ? kjvText(book, chapter, start, end) : "", translation, loading: status !== "ready" };
  if (remote.key === key) return { text: remote.text, translation: remote.translation, loading: false };
  return { text: "", translation, loading: true };
}
