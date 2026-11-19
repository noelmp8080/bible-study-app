import { Link } from "react-router";
import Icon from "../../components/Icon.jsx";
import { useActivePlan, useReadSet } from "../../hooks/usePlan.js";
import { put, remove } from "../../lib/store.js";
import { readingLabel } from "../../lib/plans.js";
import { chapterKey, readPath } from "../../lib/books.js";
import { useToast } from "../../hooks/useToast.js";

/** "Mark chapter read" / "Marked read" toggle. Writes reading_progress, which is what advances a plan. */
export function MarkReadButton({ book, chapter, block = true }) {
  const read = useReadSet().has(chapterKey(book, chapter));
  const toast = useToast();
  function toggle() {
    if (read) {
      const row = remove("reading_progress", chapterKey(book, chapter));
      toast(`${book} ${chapter} marked unread`, { action: { label: "Undo", run: () => row && put("reading_progress", row) } });
    } else {
      put("reading_progress", { book, chapter, read_at: new Date().toISOString() });
      toast(`${book} ${chapter} marked read`);
    }
  }
  return (
    <button type="button" className={`btn ${read ? "btn-outline" : "btn-accent"}${block ? " btn-block" : ""}`} aria-pressed={read} onClick={toggle}>
      <Icon name="check" size={15} stroke={2} />{read ? "Marked read · undo" : "Mark chapter read"}
    </button>
  );
}

/** Reading-plan section of the reader's chapter panel. */
export default function PlanBlock({ book, chapter }) {
  const { plan, state, name } = useActivePlan();
  if (!plan || !state) {
    return (
      <section>
        <div className="label">Reading plan</div>
        <p className="muted2" style={{ fontSize: 13, lineHeight: 1.5 }}>No plan yet. Reading still counts toward your Bible map.</p>
        <MarkReadButton book={book} chapter={chapter} />
        <Link className="btn btn-outline" to="/plans">Choose a plan</Link>
      </section>
    );
  }
  const inToday = state.reading.some((c) => c.book === book && c.chapter === chapter);
  const first = state.reading[0];
  return (
    <section>
      <div className="label">Reading plan</div>
      <div className="display" style={{ fontSize: 22, lineHeight: 1.2 }}>{name}</div>
      <div className="progress" role="img" aria-label={`Day ${state.dayNumber} of ${state.total}`}><div style={{ width: `${state.percent}%` }} /></div>
      <div className="muted" style={{ fontSize: 12 }}>
        Day {state.dayNumber} of {state.total} · {state.finished ? "plan finished" : state.doneToday ? "done for today" : inToday ? "today's reading" : (
          <>today: <Link to={readPath(first.book, first.chapter)}>{readingLabel(state.reading)}</Link></>
        )}
      </div>
      <MarkReadButton book={book} chapter={chapter} />
    </section>
  );
}
