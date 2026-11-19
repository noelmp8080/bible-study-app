import { parseReference } from "./refs.js";

/**
 * The passage a note is linked to: { book, chapter, verseStart, verseEnd } or null.
 * New notes carry the link in columns; notes written before the upgrade only
 * have the free-text `ref`, which is parsed when it is a valid reference.
 */
export function noteLink(note) {
  if (note.book && note.chapter) {
    return { book: note.book, chapter: note.chapter, verseStart: note.verse_start || null, verseEnd: note.verse_end || note.verse_start || null };
  }
  return note.ref ? parseReference(note.ref) : null;
}

/** True when a note is attached to this verse of this chapter. */
export function noteCovers(link, book, chapter, verse) {
  return !!link && link.book === book && link.chapter === chapter && !!link.verseStart && verse >= link.verseStart && verse <= (link.verseEnd || link.verseStart);
}
