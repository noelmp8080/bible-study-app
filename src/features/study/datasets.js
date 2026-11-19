// Study datasets (cross-references and Strong's numbers) are static JSON files
// loaded on demand from /data/study/ and cached by the service worker.
//
// None are bundled yet: the spec requires the source and licence of each file
// to be approved and recorded first (see docs/study-datasets.md for the
// expected shapes). Until a manifest exists, `available()` is false and the
// study panel hides both data sections.
import { bookSlug } from "../../lib/books.js";

const base = () => `${import.meta.env.BASE_URL}data/study/`;
const cache = new Map();

async function getJSON(path) {
  if (cache.has(path)) return cache.get(path);
  const promise = fetch(base() + path)
    .then((r) => (r.ok && (r.headers.get("content-type") || "").includes("json") ? r.json() : null))
    .catch(() => null);
  cache.set(path, promise);
  return promise;
}

/** { xrefs: boolean, words: boolean } — which datasets are installed. */
export async function available() {
  const manifest = await getJSON("manifest.json");
  return { xrefs: !!manifest?.xrefs, words: !!manifest?.words };
}

/** Cross-references for a verse as reference strings, e.g. ["Romans 5:8", …]. */
export async function crossReferences(book, chapter, verse) {
  const data = await getJSON(`xrefs/${bookSlug(book)}.json`);
  return data?.[`${chapter}:${verse}`] || [];
}

/** Tagged words for a verse: [{ w: "loved", s: "G25" }, …]. */
export async function verseWords(book, chapter, verse) {
  const data = await getJSON(`words/${bookSlug(book)}.json`);
  return data?.[`${chapter}:${verse}`] || [];
}

/** Lexicon entry for a Strong's number: { lemma, translit, def }. */
export async function lexiconEntry(strongs) {
  const data = await getJSON(`lexicon-${strongs[0] === "H" ? "hebrew" : "greek"}.json`);
  return data?.[strongs] || null;
}
