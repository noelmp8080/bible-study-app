import { useCallback, useMemo } from "react";
import { useTable } from "./useData.js";
import { put, getRow } from "../lib/store.js";
import { BOOKS, TRANSLATIONS, isValidChapter } from "../lib/books.js";

export const PREF_DEFAULTS = {
  theme: "light",
  font_size: 17,
  translation: "KJV",
  chapter_panel_collapsed: false,
  current_book: "John",
  current_chapter: 3,
  current_verse: null,
  share_handle: "",
};
export const THEMES = ["light", "dark", "sepia"];

/** Preferences: one row per user, kept locally and synced like any other table. */
export function usePrefs() {
  const row = useTable("preferences")[0];
  const prefs = useMemo(() => {
    const p = { ...PREF_DEFAULTS };
    for (const key of Object.keys(PREF_DEFAULTS)) if (row?.[key] !== null && row?.[key] !== undefined) p[key] = row[key];
    if (!THEMES.includes(p.theme)) p.theme = "light";
    if (!TRANSLATIONS[p.translation]) p.translation = "KJV";
    p.font_size = Math.min(28, Math.max(12, Number(p.font_size) || 17));
    if (!BOOKS.some(([n]) => n === p.current_book) || !isValidChapter(p.current_book, p.current_chapter)) {
      p.current_book = "John"; p.current_chapter = 3; p.current_verse = null;
    }
    return p;
  }, [row]);
  const setPrefs = useCallback((changes) => {
    put("preferences", { ...(getRow("preferences", "me") || {}), ...changes, updated_at: new Date().toISOString() });
  }, []);
  return [prefs, setPrefs];
}
