import { BOOKS, chapterCount } from "./books.js";

// Common abbreviations. Anything not listed falls back to "unique prefix of a
// book name", so "rom" → Romans and "phile" → Philemon work without an entry.
const ALIASES = {
  gen: "Genesis", gn: "Genesis", ex: "Exodus", exo: "Exodus", exod: "Exodus", lev: "Leviticus", lv: "Leviticus",
  num: "Numbers", nm: "Numbers", deut: "Deuteronomy", dt: "Deuteronomy", josh: "Joshua", jos: "Joshua",
  judg: "Judges", jdg: "Judges", ru: "Ruth", rth: "Ruth",
  "1 sam": "1 Samuel", "2 sam": "2 Samuel", "1 sm": "1 Samuel", "2 sm": "2 Samuel",
  "1 kgs": "1 Kings", "2 kgs": "2 Kings", "1 ki": "1 Kings", "2 ki": "2 Kings",
  "1 chr": "1 Chronicles", "2 chr": "2 Chronicles", "1 chron": "1 Chronicles", "2 chron": "2 Chronicles",
  ezr: "Ezra", neh: "Nehemiah", est: "Esther", esth: "Esther", jb: "Job",
  ps: "Psalms", psa: "Psalms", psalm: "Psalms", pss: "Psalms", prov: "Proverbs", pr: "Proverbs", prv: "Proverbs",
  eccl: "Ecclesiastes", ecc: "Ecclesiastes", qoh: "Ecclesiastes",
  song: "Song of Solomon", sos: "Song of Solomon", "song of songs": "Song of Solomon", canticles: "Song of Solomon",
  isa: "Isaiah", is: "Isaiah", jer: "Jeremiah", lam: "Lamentations", ezek: "Ezekiel", ezk: "Ezekiel", eze: "Ezekiel",
  dan: "Daniel", dn: "Daniel", hos: "Hosea", jl: "Joel", am: "Amos", ob: "Obadiah", obad: "Obadiah",
  jon: "Jonah", mic: "Micah", nah: "Nahum", hab: "Habakkuk", zeph: "Zephaniah", zep: "Zephaniah",
  hag: "Haggai", zech: "Zechariah", zec: "Zechariah", mal: "Malachi",
  matt: "Matthew", mt: "Matthew", mk: "Mark", mrk: "Mark", lk: "Luke", luk: "Luke",
  jn: "John", jhn: "John", joh: "John", ac: "Acts", act: "Acts", rom: "Romans", rm: "Romans",
  "1 cor": "1 Corinthians", "2 cor": "2 Corinthians", "1 co": "1 Corinthians", "2 co": "2 Corinthians",
  gal: "Galatians", eph: "Ephesians", phil: "Philippians", php: "Philippians", col: "Colossians",
  "1 thess": "1 Thessalonians", "2 thess": "2 Thessalonians", "1 th": "1 Thessalonians", "2 th": "2 Thessalonians",
  "1 tim": "1 Timothy", "2 tim": "2 Timothy", "1 ti": "1 Timothy", "2 ti": "2 Timothy",
  tit: "Titus", phlm: "Philemon", philem: "Philemon", phm: "Philemon", heb: "Hebrews",
  jas: "James", jam: "James", jm: "James",
  "1 pet": "1 Peter", "2 pet": "2 Peter", "1 pt": "1 Peter", "2 pt": "2 Peter",
  "1 jn": "1 John", "2 jn": "2 John", "3 jn": "3 John", "1 jo": "1 John", "2 jo": "2 John", "3 jo": "3 John",
  jud: "Jude", rev: "Revelation", rv: "Revelation", revelations: "Revelation", apocalypse: "Revelation",
};
const LOWER = BOOKS.map(([name]) => [name.toLowerCase(), name]);

/** Resolve a typed book name or abbreviation to a canonical name, or null. */
export function resolveBook(raw) {
  let s = String(raw || "").toLowerCase().replace(/\./g, "").replace(/\s+/g, " ").trim();
  if (!s) return null;
  // "1cor", "i cor", "ii kings", "1st john" → "1 cor", "2 kings", "1 john"
  s = s.replace(/^(iii|ii|i)\s+/, (m, r) => `${r.length} `)
       .replace(/^(\d)(?:st|nd|rd)?\s*/, "$1 ").trim();
  const exact = LOWER.find(([l]) => l === s);
  if (exact) return exact[1];
  if (ALIASES[s]) return ALIASES[s];
  if (s.replace(/^\d /, "").length < 2) return null;
  const prefixed = LOWER.filter(([l]) => l.startsWith(s));
  return prefixed.length ? prefixed[0][1] : null;
}

/**
 * Parse "john 3:16", "1 cor 13", "rom 8:28-30", "Ps 23.1".
 * Returns { book, chapter, verseStart, verseEnd } (verses null for a whole
 * chapter), or null when the text is not a reference. Only the chapter number
 * is range-checked here; use refExists (lib/bible.js) to check the verses.
 */
export function parseReference(input) {
  const s = String(input || "").trim().replace(/[–—]/g, "-");
  const m = s.match(/^((?:[1-3]|i{1,3})?\s*[a-z][a-z .]*?)\s*(\d{1,3})(?:(?:\s*[:.,]\s*|\s+)(\d{1,3})(?:\s*-\s*(\d{1,3}))?)?$/i);
  if (!m) return null;
  const book = resolveBook(m[1]);
  if (!book) return null;
  let chapter = Number(m[2]);
  let verseStart = m[3] ? Number(m[3]) : null;
  // One-chapter books are cited by verse alone: "Jude 24" means Jude 1:24.
  if (chapterCount(book) === 1 && chapter > 1 && verseStart === null) { verseStart = chapter; chapter = 1; }
  if (chapter < 1 || chapter > chapterCount(book)) return null;
  let verseEnd = m[4] ? Number(m[4]) : verseStart;
  if (verseStart !== null && verseStart < 1) return null;
  if (verseEnd !== null && verseEnd < verseStart) verseEnd = verseStart;
  return { book, chapter, verseStart, verseEnd };
}

/** "John 3", "John 3:16", "John 3:16–18". */
export function formatRef({ book, chapter, verseStart, verseEnd }) {
  if (!verseStart) return `${book} ${chapter}`;
  return `${book} ${chapter}:${verseStart}${verseEnd && verseEnd !== verseStart ? `–${verseEnd}` : ""}`;
}

/** Collapse sorted verse numbers into [[start, end], …] runs. */
export function verseRuns(verses) {
  const sorted = [...new Set(verses)].sort((a, b) => a - b);
  const runs = [];
  for (const v of sorted) {
    const last = runs[runs.length - 1];
    if (last && v === last[1] + 1) last[1] = v; else runs.push([v, v]);
  }
  return runs;
}

/** A selection as a reference: "John 3:16", "John 3:16–18", "John 3:16, 19". */
export function formatSelection(book, chapter, verses) {
  const runs = verseRuns(verses);
  if (!runs.length) return `${book} ${chapter}`;
  return `${book} ${chapter}:${runs.map(([a, b]) => (a === b ? a : `${a}–${b}`)).join(", ")}`;
}
