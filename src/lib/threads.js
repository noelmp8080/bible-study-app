import { put } from "./store.js";

/** Append a passage to the end of a thread; returns the new link row. */
export function addLink(threadId, links, { book, chapter, verseStart, verseEnd, label = "" }) {
  const position = links.filter((l) => l.thread_id === threadId).reduce((m, l) => Math.max(m, l.position), -1) + 1;
  return put("thread_links", { thread_id: threadId, position, label, book, chapter, verse_start: verseStart, verse_end: verseEnd || verseStart });
}

/** Links of one thread in order. */
export function linksOf(threadId, links) {
  return links.filter((l) => l.thread_id === threadId).sort((a, b) => a.position - b.position);
}
