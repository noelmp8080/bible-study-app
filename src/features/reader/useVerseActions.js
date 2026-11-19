import { useMemo } from "react";
import { useNavigate } from "react-router";
import { put, patch, remove } from "../../lib/store.js";
import { formatSelection, verseRuns } from "../../lib/refs.js";
import { plainText } from "../../lib/verseText.js";
import { copyText } from "../../lib/format.js";
import { addMemoryVerse } from "../../lib/memory.js";
import { useToast } from "../../hooks/useToast.js";

export const COLORS = ["gold", "rose", "sage", "sky"];
export const CARD_LIMIT = 400; // characters a verse card can hold (spec B3)

/**
 * Everything the verse toolbar (desktop/tablet) and verse sheet (phone) can
 * do with the current selection. Nothing here runs until the user picks an
 * action, so selecting a verse never writes to the database.
 */
export function useVerseActions({ book, chapter, translation, verses, selection, highlights, bookmarks, onDone }) {
  const navigate = useNavigate();
  const toast = useToast();

  return useMemo(() => {
    const picked = [...selection].sort((a, b) => a - b);
    const runs = verseRuns(picked);
    const reference = formatSelection(book, chapter, picked);
    const textOf = (n) => plainText(verses?.find((v) => v.verse === n)?.text || "");
    const fullText = picked.map(textOf).join(" ");
    const colors = new Set(picked.map((n) => highlights.get(n)?.color || null));
    const currentColor = colors.size === 1 ? [...colors][0] : undefined; // undefined = mixed
    const allBookmarked = picked.length > 0 && picked.every((n) => bookmarks.has(n));

    return {
      picked, reference, fullText, currentColor, allBookmarked,
      cardTooLong: fullText.length > CARD_LIMIT,

      /** Set a colour; choosing the colour the selection already has (or null) removes it. */
      setColor(color) {
        const clear = !color || currentColor === color;
        for (const n of picked) {
          const existing = highlights.get(n);
          if (clear) { if (existing) remove("highlights", existing.id); }
          else if (existing) { if (existing.color !== color) patch("highlights", existing.id, { color }); }
          else put("highlights", { book, chapter, verse: n, color });
        }
      },

      toggleBookmark() {
        for (const n of picked) {
          const existing = bookmarks.get(n);
          if (allBookmarked) { if (existing) remove("bookmarks", existing.id); }
          else if (!existing) put("bookmarks", { book, chapter, verse: n });
        }
        toast(allBookmarked ? "Bookmark removed" : `Bookmarked ${reference}`);
      },

      addNote() {
        navigate("/notes/new", { state: { link: { book, chapter, verseStart: picked[0], verseEnd: picked[picked.length - 1], ref: reference } } });
      },

      askAI() {
        navigate("/ask", { state: { context: { book, chapter, verses: picked, translation } } });
      },

      async copy() {
        const body = picked.length === 1 ? textOf(picked[0]) : picked.map((n) => `${n} ${textOf(n)}`).join(" ");
        const ok = await copyText(`“${body}” — ${reference} (${translation})`);
        toast(ok ? `Copied ${reference}` : "Copying is not available in this browser", { error: !ok });
        if (ok) onDone?.();
      },

      shareImage() {
        navigate("/card", { state: { card: { book, chapter, verses: picked, translation } } });
      },

      memorize() {
        let added = 0;
        for (const [a, b] of runs) if (addMemoryVerse({ book, chapter, verseStart: a, verseEnd: b, translation })) added++;
        toast(added ? `${reference} added to memory verses · due today` : `${reference} is already a memory verse`, {
          action: { label: "Review", run: () => navigate("/memory") },
        });
        onDone?.();
      },
    };
  }, [book, chapter, translation, verses, selection, highlights, bookmarks, navigate, toast, onDone]);
}
