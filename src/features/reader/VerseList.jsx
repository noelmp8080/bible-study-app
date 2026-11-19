import Icon from "../../components/Icon.jsx";
import VerseText from "../../components/VerseText.jsx";

/**
 * One verse. The paragraph is the selectable control (a real keyboard target
 * with aria-pressed); note markers sit beside it as their own buttons.
 */
function Verse({ v, selected, color, bookmarked, noteCount, speaking, onToggle, onOpenNotes, children, idPrefix = "v" }) {
  const cls = `verse${selected ? " selected" : ""}${speaking ? " speaking" : ""}`;
  return (
    <div className={cls} data-hl={!selected && color ? color : undefined} data-verse={v.verse} id={`${idPrefix}${v.verse}`}>
      <div className="verse-main">
        <p role="button" tabIndex={0} aria-pressed={selected}
          onClick={() => onToggle(v.verse)}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onToggle(v.verse); } }}>
          <span className="vn">{String(v.verse).padStart(2, "0")}</span>
          <span className="vt"><VerseText text={v.text} /></span>
          {bookmarked && <span className="flag" title="Bookmarked"><Icon name="bookmark" size={13} /><span className="sr-only"> (bookmarked)</span></span>}
          {color && <span className="sr-only"> (highlighted {color})</span>}
        </p>
        {noteCount > 0 && (
          <div className="marks">
            <button type="button" className="note-marker" onClick={() => onOpenNotes(v.verse)}>
              <Icon name="notes" size={13} />{noteCount} note{noteCount === 1 ? "" : "s"}
            </button>
          </div>
        )}
      </div>
      {children}
    </div>
  );
}

/** The chapter text, single column or two verse-aligned columns in compare mode. */
export default function VerseList({ verses, other, otherLabel, label, selection, highlights, bookmarks, noteCounts, speakingVerse, onToggle, onOpenNotes, toolbar, toolbarAt }) {
  const row = (v) => (
    <Verse key={v.verse} v={v} selected={selection.has(v.verse)} color={highlights.get(v.verse)?.color}
      bookmarked={bookmarks.has(v.verse)} noteCount={noteCounts.get(v.verse) || 0} speaking={speakingVerse === v.verse}
      onToggle={onToggle} onOpenNotes={onOpenNotes}>
      {toolbarAt === v.verse ? toolbar : null}
    </Verse>
  );

  if (!other) return <div>{verses.map(row)}</div>;

  const otherByVerse = new Map(other.map((v) => [v.verse, v]));
  const count = Math.max(verses.length, other.length);
  const cells = [];
  for (let n = 1; n <= count; n++) {
    const a = verses.find((v) => v.verse === n);
    const b = otherByVerse.get(n);
    cells.push(a ? row(a) : <div key={`a${n}`} />);
    cells.push(b
      ? <Verse key={`b${n}`} v={b} idPrefix="o" selected={selection.has(n)} color={highlights.get(n)?.color} bookmarked={false}
          noteCount={0} speaking={false} onToggle={onToggle} onOpenNotes={onOpenNotes} />
      : <div key={`b${n}`} />);
  }
  return (
    <div className="compare">
      <div className="compare-head label">{label}</div>
      <div className="compare-head label">{otherLabel}</div>
      {cells}
    </div>
  );
}
