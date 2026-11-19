// Local Bible store.
//   KJV: fetched once from /data/kjv.json, compacted, kept in IndexedDB and in
//        memory, so every later read (and full-text search) works offline.
//   ASV: no bundled file yet, so each chapter is fetched from bible-api.com the
//        first time it is opened and then kept in IndexedDB.
import { openDB, idbGet, idbPut } from "./idb.js";
import { BOOKS, chapterCount } from "./books.js";
import { cleanVerse, plainText } from "./verseText.js";

export const BIBLE_DB = "bsa-bible";
export const KJV_KEY = "KJV";
const KJV_FORMAT = 2; // bump to force a re-import when the compact format changes

let dbPromise = null;
export function bibleDB() {
  dbPromise ||= openDB(BIBLE_DB, 1, (db) => {
    db.createObjectStore("texts");    // whole translations, key = translation id
    db.createObjectStore("chapters"); // single fetched chapters, key = "ASV|John|3"
  });
  return dbPromise;
}

/** Turn the repo's JSON shape into { [book]: string[][] } (chapters → verses). */
export function compactBible(json) {
  const out = {};
  for (const b of json.books) out[b.name] = b.chapters.map((c) => c.verses.map((v) => cleanVerse(v.text)));
  return out;
}

// ── KJV: load once, then synchronous access ───────────────────────────────────
let kjv = null;
let kjvPromise = null;
let status = "idle"; // idle | loading | ready | error
const listeners = new Set();
const setStatus = (s) => { status = s; listeners.forEach((fn) => fn()); };
export const getBibleStatus = () => status;
export function subscribeBible(fn) { listeners.add(fn); return () => listeners.delete(fn); }

export function loadKJV() {
  if (kjvPromise) return kjvPromise;
  setStatus("loading");
  kjvPromise = (async () => {
    const db = await bibleDB();
    const saved = await idbGet(db, "texts", KJV_KEY);
    if (saved?.format === KJV_FORMAT && saved.books) { kjv = saved.books; setStatus("ready"); return kjv; }
    const res = await fetch(`${import.meta.env.BASE_URL}data/kjv.json`);
    if (!res.ok) throw new Error(`Bible download failed (${res.status})`);
    kjv = compactBible(await res.json());
    await idbPut(db, "texts", { format: KJV_FORMAT, books: kjv }, KJV_KEY);
    setStatus("ready");
    return kjv;
  })().catch((err) => {
    kjvPromise = null; // allow a retry
    setStatus("error");
    throw err;
  });
  return kjvPromise;
}

export const kjvLoaded = () => kjv !== null;
/** Verses of a KJV chapter as marked strings, or null if not loaded / out of range. */
export const kjvChapter = (book, chapter) => kjv?.[book]?.[chapter - 1] || null;
/** Number of verses in a chapter (KJV versification), 0 if unknown. */
export const verseCount = (book, chapter) => kjvChapter(book, chapter)?.length || 0;
/** True when book/chapter/verse(s) exist in the local Bible. */
export function refExists({ book, chapter, verseStart, verseEnd }) {
  const n = verseCount(book, chapter);
  if (!n) return false;
  if (!verseStart) return true;
  return verseStart >= 1 && (verseEnd || verseStart) <= n;
}

// ── Any translation, async ────────────────────────────────────────────────────
function apiBookKey(name) { return name.toLowerCase().replace(/ /g, "+"); }
const memChapters = new Map();

async function fetchRemoteChapter(translation, book, chapter) {
  const key = `${translation}|${book}|${chapter}`;
  if (memChapters.has(key)) return memChapters.get(key);
  const db = await bibleDB();
  let verses = await idbGet(db, "chapters", key);
  if (!verses) {
    const res = await fetch(`https://bible-api.com/${apiBookKey(book)}+${chapter}?translation=${translation.toLowerCase()}`);
    if (!res.ok) throw new Error(`${translation} is not available offline for this chapter yet.`);
    const data = await res.json();
    if (!Array.isArray(data.verses) || !data.verses.length) throw new Error(`${translation} returned no text for ${book} ${chapter}.`);
    verses = [];
    for (const v of data.verses) verses[v.verse - 1] = String(v.text || "").replace(/\s+/g, " ").trim();
    for (let i = 0; i < verses.length; i++) verses[i] ||= "";
    await idbPut(db, "chapters", verses, key);
  }
  memChapters.set(key, verses);
  return verses;
}

/**
 * A chapter as [{ verse, text }]. `text` may contain KJV markup; pass it to
 * <VerseText> to render or plainText() to strip.
 */
export async function getChapter(translation, book, chapter) {
  if (chapter < 1 || chapter > chapterCount(book)) throw new Error(`${book} has no chapter ${chapter}.`);
  const list = translation === "KJV"
    ? (await loadKJV())[book][chapter - 1]
    : await fetchRemoteChapter(translation, book, chapter);
  return list.map((text, i) => ({ verse: i + 1, text }));
}

/**
 * Verses start..end of a chapter. If the requested translation cannot be
 * loaded (offline, not cached) this falls back to KJV and says so in
 * `translation`, so callers can label the text honestly.
 */
export async function getPassage(translation, book, chapter, start, end = start) {
  let used = translation, verses;
  try { verses = await getChapter(translation, book, chapter); }
  catch (err) {
    if (translation === "KJV") throw err;
    used = "KJV"; verses = await getChapter("KJV", book, chapter);
  }
  const picked = start ? verses.filter((v) => v.verse >= start && v.verse <= (end || start)) : verses;
  return { translation: used, verses: picked, text: picked.map((v) => plainText(v.text)).join(" ") };
}

/** Synchronous KJV passage text (plain), "" when the Bible is not loaded yet. */
export function kjvText(book, chapter, start, end = start) {
  const ch = kjvChapter(book, chapter);
  if (!ch) return "";
  return ch.slice((start || 1) - 1, end || (start ? start : ch.length)).map(plainText).join(" ");
}

/** Flat list of every verse position, for mapping search hits back to references. */
let flat = null;
export function verseIndex() {
  if (flat || !kjv) return flat;
  const book = [], chapter = [], verse = [];
  BOOKS.forEach(([name], bi) => {
    kjv[name].forEach((vs, ci) => vs.forEach((_, vi) => { book.push(bi); chapter.push(ci + 1); verse.push(vi + 1); }));
  });
  flat = { book: Uint8Array.from(book), chapter: Uint8Array.from(chapter), verse: Uint8Array.from(verse) };
  return flat;
}
