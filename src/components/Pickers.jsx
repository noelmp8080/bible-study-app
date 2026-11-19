import Sheet from "./Sheet.jsx";
import { BOOKS_OT, BOOKS_NT, chapterCount } from "../lib/books.js";

/** Book list, opened near the picker chips at the top of the screen. */
export function BookPicker({ current, onPick, onClose }) {
  return (
    <Sheet title="Select book" position="top" onClose={onClose}>
      {[["Old Testament", BOOKS_OT], ["New Testament", BOOKS_NT]].map(([label, list]) => (
        <div key={label} style={{ marginBottom: 14 }}>
          <div className="label" style={{ marginBottom: 8 }}>{label}</div>
          <div className="book-grid">
            {list.map(([name]) => (
              <button key={name} type="button" aria-current={current === name ? "true" : undefined}
                data-autofocus={current === name ? "" : undefined} onClick={() => onPick(name)}>{name}</button>
            ))}
          </div>
        </div>
      ))}
    </Sheet>
  );
}

/** Chapter grid for one book. `readSet` (optional) marks chapters already read. */
export function ChapterPicker({ book, current, readSet, onPick, onClose }) {
  const chapters = Array.from({ length: chapterCount(book) }, (_, i) => i + 1);
  return (
    <Sheet title={`${book} — chapter`} position="top" onClose={onClose}>
      <div className="chapter-grid">
        {chapters.map((n) => {
          const read = readSet?.has(`${book}|${n}`);
          return (
            <button key={n} type="button" className={read ? "read" : undefined} aria-current={current === n ? "true" : undefined}
              aria-label={`Chapter ${n}${read ? ", read" : ""}`} data-autofocus={current === n ? "" : undefined} onClick={() => onPick(n)}>{n}</button>
          );
        })}
      </div>
    </Sheet>
  );
}
