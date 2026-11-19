// The 66 books as [name, chapterCount]. These exact names are what every
// table stores in its `book` column, so never rename them.
export const BOOKS_OT = [
  ["Genesis",50],["Exodus",40],["Leviticus",27],["Numbers",36],["Deuteronomy",34],
  ["Joshua",24],["Judges",21],["Ruth",4],["1 Samuel",31],["2 Samuel",24],
  ["1 Kings",22],["2 Kings",25],["1 Chronicles",29],["2 Chronicles",36],
  ["Ezra",10],["Nehemiah",13],["Esther",10],["Job",42],["Psalms",150],
  ["Proverbs",31],["Ecclesiastes",12],["Song of Solomon",8],["Isaiah",66],
  ["Jeremiah",52],["Lamentations",5],["Ezekiel",48],["Daniel",12],
  ["Hosea",14],["Joel",3],["Amos",9],["Obadiah",1],["Jonah",4],
  ["Micah",7],["Nahum",3],["Habakkuk",3],["Zephaniah",3],["Haggai",2],
  ["Zechariah",14],["Malachi",4],
];
export const BOOKS_NT = [
  ["Matthew",28],["Mark",16],["Luke",24],["John",21],["Acts",28],
  ["Romans",16],["1 Corinthians",16],["2 Corinthians",13],["Galatians",6],
  ["Ephesians",6],["Philippians",4],["Colossians",4],["1 Thessalonians",5],
  ["2 Thessalonians",3],["1 Timothy",6],["2 Timothy",4],["Titus",3],
  ["Philemon",1],["Hebrews",13],["James",5],["1 Peter",5],["2 Peter",3],
  ["1 John",5],["2 John",1],["3 John",1],["Jude",1],["Revelation",22],
];
export const BOOKS = [...BOOKS_OT, ...BOOKS_NT];
export const TOTAL_CHAPTERS = BOOKS.reduce((n, [, c]) => n + c, 0); // 1,189
export const OT_BOOK_COUNT = BOOKS_OT.length;

const INDEX = new Map(BOOKS.map(([name], i) => [name, i]));
const COUNT = new Map(BOOKS);

export const TRANSLATIONS = {
  KJV: { label: "King James Version", era: "1611" },
  ASV: { label: "American Standard Version", era: "1901" },
};

export const bookIndex = (name) => (INDEX.has(name) ? INDEX.get(name) : -1);
export const chapterCount = (name) => COUNT.get(name) || 0;
export const isOT = (name) => bookIndex(name) > -1 && bookIndex(name) < OT_BOOK_COUNT;
export const isValidChapter = (book, chapter) =>
  Number.isInteger(chapter) && chapter >= 1 && chapter <= chapterCount(book);

export const bookSlug = (name) => name.toLowerCase().replace(/ /g, "-");
const SLUGS = new Map(BOOKS.map(([name]) => [bookSlug(name), name]));
export const bookFromSlug = (slug) => SLUGS.get(String(slug || "").toLowerCase()) || null;

/** URL of a chapter (optionally a verse) in the reader. */
export function readPath(book, chapter, verse) {
  return `/read/${bookSlug(book)}/${chapter}${verse ? `/${verse}` : ""}`;
}

/** The chapter after this one, crossing book boundaries; null after Revelation 22. */
export function nextChapter(book, chapter) {
  if (chapter < chapterCount(book)) return { book, chapter: chapter + 1 };
  const next = BOOKS[bookIndex(book) + 1];
  return next ? { book: next[0], chapter: 1 } : null;
}
/** The chapter before this one, crossing book boundaries; null before Genesis 1. */
export function prevChapter(book, chapter) {
  if (chapter > 1) return { book, chapter: chapter - 1 };
  const prev = BOOKS[bookIndex(book) - 1];
  return prev ? { book: prev[0], chapter: prev[1] } : null;
}

/** Every chapter in canonical order as {book, chapter}. */
export function allChapters() {
  const out = [];
  for (const [book, n] of BOOKS) for (let c = 1; c <= n; c++) out.push({ book, chapter: c });
  return out;
}
export const chapterKey = (book, chapter) => `${book}|${chapter}`;

const ONES = ["","One","Two","Three","Four","Five","Six","Seven","Eight","Nine","Ten","Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen","Seventeen","Eighteen","Nineteen"];
const TENS = ["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"];
/** 3 → "Three", 119 → "One Hundred Nineteen". Used in the "Chapter Three" eyebrow. */
export function chapterWord(n) {
  if (n < 20) return ONES[n];
  if (n < 100) { const t = Math.floor(n / 10), o = n % 10; return TENS[t] + (o ? "-" + ONES[o] : ""); }
  return "One Hundred" + (n > 100 ? " " + chapterWord(n - 100) : "");
}
