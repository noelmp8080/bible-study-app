// Full-text search over the locally stored KJV, off the main thread.
// The Bible comes from IndexedDB (or the network on the very first run) through
// the same loader the app uses, so search works offline.
import { loadKJV } from "../../lib/bible.js";
import { BOOKS, OT_BOOK_COUNT } from "../../lib/books.js";
import { plainText } from "../../lib/verseText.js";
import { normalize } from "../../lib/searchQuery.js";

let index = null; // { text: string[], book: Uint8Array } in canonical verse order

async function build() {
  const kjv = await loadKJV();
  const text = [], book = [];
  BOOKS.forEach(([name], bi) => {
    for (const verses of kjv[name]) for (const v of verses) { text.push(` ${normalize(plainText(v))} `); book.push(bi); }
  });
  index = { text, book: Uint8Array.from(book) };
}
const ready = build().then(() => self.postMessage({ type: "ready" }), (err) => self.postMessage({ type: "error", message: err.message }));

self.onmessage = async (e) => {
  const { id, words, phrases } = e.data;
  await ready;
  if (!index) { self.postMessage({ type: "result", id, error: "The Bible text is not on this device yet." }); return; }
  const needles = [...phrases, ...words].map((n) => ` ${n} `);
  const hits = [];
  let ot = 0;
  for (let i = 0; i < index.text.length; i++) {
    const t = index.text[i];
    let ok = true;
    for (const n of needles) if (!t.includes(n)) { ok = false; break; }
    if (ok) { hits.push(i); if (index.book[i] < OT_BOOK_COUNT) ot++; }
  }
  const indices = Int32Array.from(hits);
  self.postMessage({ type: "result", id, indices, ot, nt: hits.length - ot }, [indices.buffer]);
};
