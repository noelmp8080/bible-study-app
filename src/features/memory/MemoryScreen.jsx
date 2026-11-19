import { useMemo, useState } from "react";
import { Link } from "react-router";
import Icon from "../../components/Icon.jsx";
import { useTable } from "../../hooks/useData.js";
import { usePassage } from "../../hooks/useBible.js";
import { useToast } from "../../hooks/useToast.js";
import { put, remove } from "../../lib/store.js";
import { STEPS, describeInterval, dueVerses, maskWords, nextInterval, rate } from "../../lib/memory.js";
import { formatRef } from "../../lib/refs.js";
import { readPath } from "../../lib/books.js";

const refOf = (row) => formatRef({ book: row.book, chapter: row.chapter, verseStart: row.verse_start, verseEnd: row.verse_end });

function Trainer({ row, position, total, onRated }) {
  const [step, setStep] = useState(0);
  const passage = usePassage(row.translation, row.book, row.chapter, row.verse_start, row.verse_end);
  const words = useMemo(() => maskWords(passage.text, step), [passage.text, step]);

  return (
    <>
      <header className="page-head">
        <Link className="back-link" to="/"><Icon name="chevLeft" size={14} stroke={2} />Today</Link>
        <div className="head-row">
          <div>
            <div className="eyebrow">Memory · verse {position} of {total} due</div>
            <h1 className="display">{refOf(row)}</h1>
          </div>
          <div className="muted2" style={{ fontSize: 12, fontWeight: 600, paddingBottom: 4 }}>
            {passage.translation}{passage.translation !== row.translation ? ` (saved in ${row.translation}, not on this device)` : ""}
          </div>
        </div>
      </header>
      <div className="screen-scroll">
        <main className="pad wrap-narrow stack" style={{ gap: 20 }}>
          <div className="row-between">
            <div style={{ fontSize: 13.5, fontWeight: 600 }} aria-live="polite">{STEPS[step]}</div>
            <div className="row" style={{ gap: 8 }}>
              <div className="mem-dots" aria-hidden="true">{STEPS.map((_, i) => <i key={i} className={i <= step ? "on" : undefined} />)}</div>
              <div className="muted2" style={{ fontSize: 12 }}>Step {step + 1} of {STEPS.length}</div>
            </div>
          </div>
          <div className="mem-card">
            <p className="mem-words">
              {passage.loading ? "…" : words.map((w, i) => <span key={i} className={w.hidden ? "hid" : undefined}>{w.text}</span>)}
            </p>
          </div>
          <div className="btn-row">
            <button type="button" className="btn btn-outline btn-lg" disabled={step === 0} onClick={() => setStep((s) => Math.max(0, s - 1))}>Show more</button>
            <button type="button" className="btn btn-lg" disabled={step === STEPS.length - 1} onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}>Hide more</button>
          </div>
          <p className="muted2" style={{ fontSize: 13, lineHeight: 1.55 }}>
            Say it aloud at each step. Words drop out a few at a time until only first letters are left.
          </p>
        </main>
      </div>
      <div className="foot">
        <div className="label">How did it go?</div>
        <div className="rate">
          {[["shaky", "Shaky"], ["got_it", "Got it"], ["by_heart", "By heart"]].map(([id, label]) => (
            <button key={id} type="button" className={id === "by_heart" ? "best" : undefined} onClick={() => onRated(row, id)}>
              <b>{label}</b><small>{describeInterval(nextInterval(row, id))}</small>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

/** Spec B5: review the verses that are due, then a done state. */
export default function MemoryScreen() {
  const rows = useTable("memory_verses");
  const toast = useToast();
  const [reviewed, setReviewed] = useState(0);
  // Fix "now" for the session so a verse rated a moment ago cannot come straight back.
  const [now] = useState(() => Date.now());
  const due = useMemo(() => dueVerses(rows, now), [rows, now]);

  function onRated(row, rating) {
    const updated = rate(row, rating);
    setReviewed((n) => n + 1);
    toast(`${refOf(row)} · next review ${describeInterval(updated.interval_days)}`);
  }
  function drop(row) {
    remove("memory_verses", row.id);
    toast(`Removed ${refOf(row)}`, { action: { label: "Undo", run: () => put("memory_verses", row) } });
  }

  if (due.length) {
    return <div className="screen"><Trainer key={due[0].id} row={due[0]} position={reviewed + 1} total={reviewed + due.length} onRated={onRated} /></div>;
  }

  const sorted = [...rows].sort((a, b) => new Date(a.due_at) - new Date(b.due_at));
  return (
    <div className="screen">
      <header className="page-head">
        <Link className="back-link" to="/"><Icon name="chevLeft" size={14} stroke={2} />Today</Link>
        <div className="eyebrow">Memory</div>
        <h1 className="display">{reviewed ? "Done for today" : rows.length ? "Nothing due" : "Memory verses"}</h1>
        <p className="lede">
          {reviewed ? `You reviewed ${reviewed} verse${reviewed === 1 ? "" : "s"}. ` : ""}
          {rows.length ? "Each verse comes back when it is due." : "Select a verse in the reader and choose Memorize. It will be due straight away."}
        </p>
      </header>
      <div className="screen-scroll">
        <main className="pad wrap-narrow stack">
          <Link className="btn btn-accent btn-lg" to="/">Back to Today</Link>
          {sorted.length > 0 && <div className="label">Your verses</div>}
          <div className="stack-sm">
            {sorted.map((row) => (
              <div key={row.id} className="row" style={{ gap: 8, alignItems: "stretch" }}>
                <Link className="result grow" to={readPath(row.book, row.chapter, row.verse_start)}>
                  <span className="refline">{refOf(row)} · {row.translation}</span>
                  <span className="muted2" style={{ fontSize: 13 }}>
                    Next review {new Date(row.due_at).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
                    {row.last_result ? ` · last time: ${{ shaky: "shaky", got_it: "got it", by_heart: "by heart" }[row.last_result]}` : ""}
                  </span>
                </Link>
                <button type="button" className="icon-btn" style={{ height: "auto" }} aria-label={`Remove ${refOf(row)} from memory verses`} onClick={() => drop(row)}><Icon name="trash" size={16} /></button>
              </div>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
