import { useMemo } from "react";
import { Link, useNavigate } from "react-router";
import Icon from "../../components/Icon.jsx";
import SyncStatus from "../../components/SyncStatus.jsx";
import { usePrefs } from "../../hooks/usePrefs.js";
import { useTable } from "../../hooks/useData.js";
import { usePassage } from "../../hooks/useBible.js";
import { useActivePlan } from "../../hooks/usePlan.js";
import { readPath, TOTAL_CHAPTERS } from "../../lib/books.js";
import { readingLabel, weekStrip } from "../../lib/plans.js";
import { verseOfTheDay } from "../../lib/votd.js";
import { dueVerses } from "../../lib/memory.js";

function PlanCard() {
  const { plan, state, name } = useActivePlan();
  const week = useMemo(() => weekStrip(state), [state]);
  if (!plan || !state) {
    return (
      <section className="card stack">
        <div className="label">Reading plan</div>
        <div className="display" style={{ fontSize: 22, lineHeight: 1.15 }}>Read with a plan</div>
        <p className="muted2" style={{ fontSize: 13, lineHeight: 1.5 }}>John in 21 days, the New Testament in 90, or the whole Bible in a year.</p>
        <Link className="btn btn-accent" to="/plans">Choose a plan</Link>
      </section>
    );
  }
  const target = state.finished ? null : (state.remainingToday[0] || state.reading[0]);
  const summary = `This week: ${week.filter((d) => d.done).map((d) => d.name).join(", ") || "nothing"} read; today is ${week.find((d) => d.isToday)?.name}`;
  return (
    <section className="card stack">
      <div className="row-between" style={{ alignItems: "baseline" }}>
        <div className="label">Reading plan</div>
        <div style={{ fontSize: 12, fontWeight: 600 }}>Day {state.dayNumber} of {state.total}</div>
      </div>
      <div className="display" style={{ fontSize: 22, lineHeight: 1.15 }}>{name}</div>
      <div className="progress" role="img" aria-label={`Day ${state.dayNumber} of ${state.total}`}><div style={{ width: `${state.percent}%` }} /></div>
      <div className="week" role="img" aria-label={summary}>
        {week.map((d) => (
          <div key={d.date} className={`${d.done ? "done " : ""}${d.isToday ? "today " : ""}${d.off ? "off" : ""}`}>
            <span>{d.letter}</span>
            <div className="box">{d.done && <Icon name="check" size={14} stroke={2} />}</div>
          </div>
        ))}
      </div>
      <div className="row-between">
        <div style={{ fontSize: 13 }}>
          {state.finished ? "Plan finished. Well done." : state.doneToday ? <>Done for today · next: {readingLabel(state.nextReading)}</> : <>Today: <b>{readingLabel(state.reading)}</b></>}
        </div>
        {target
          ? <Link className="btn btn-outline" to={readPath(target.book, target.chapter)}>{state.doneToday ? "Read ahead" : "Read"}</Link>
          : <Link className="btn btn-outline" to="/plans">Plans</Link>}
      </div>
    </section>
  );
}

function VerseOfTheDay({ translation }) {
  const navigate = useNavigate();
  const ref = useMemo(() => verseOfTheDay(), []);
  const passage = usePassage(translation, ref.book, ref.chapter, ref.verse, ref.verse);
  return (
    <section className="stack-sm" style={{ borderTop: "1px solid var(--border)", paddingTop: 14, gap: 9 }}>
      <div className="label">Verse of the day</div>
      <p className="votd">{passage.text ? `“${passage.text}”` : "…"}</p>
      <div className="row-between">
        <Link to={readPath(ref.book, ref.chapter, ref.verse)} style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--heading)", minHeight: 44, display: "inline-flex", alignItems: "center" }}>
          {ref.book} {ref.chapter}:{ref.verse} · {passage.translation}
        </Link>
        <button type="button" className="btn btn-outline" disabled={!passage.text}
          onClick={() => navigate("/card", { state: { card: { book: ref.book, chapter: ref.chapter, verses: [ref.verse], translation: passage.translation } } })}>
          <Icon name="share" size={15} />Share as image
        </button>
      </div>
    </section>
  );
}

/** Spec A3: the landing screen. */
export default function TodayScreen() {
  const [prefs] = usePrefs();
  const memory = useTable("memory_verses");
  const progress = useTable("reading_progress");
  const threads = useTable("threads");
  const due = dueVerses(memory).length;
  const now = new Date();
  const eyebrow = `${now.toLocaleDateString(undefined, { weekday: "long" })} · ${now.toLocaleDateString(undefined, { month: "long", day: "numeric" })}`;

  return (
    <div className="screen">
      <div className="screen-scroll">
        <header className="page-head plain">
          <div className="head-row wrap">
            <div>
              <div className="eyebrow">{eyebrow}</div>
              <h1 className="display">Today</h1>
            </div>
            <Link className="icon-btn today-gear" to="/settings" aria-label="Preferences"><Icon name="prefs" size={19} /></Link>
          </div>
        </header>
        <main className="pad" style={{ paddingTop: 0 }}>
          <div className="wrap today-grid">
            <section className="card-ink row-between span2">
              <div>
                <div className="label">Continue reading</div>
                <div className="display" style={{ fontSize: 34, lineHeight: 1.05, marginTop: 6, color: "inherit" }}>{prefs.current_book} {prefs.current_chapter}</div>
                <div style={{ fontSize: 12, color: "var(--on-ink-muted)", marginTop: 4 }}>
                  {prefs.current_verse ? `Left off at verse ${prefs.current_verse} · ` : ""}{prefs.translation}
                </div>
              </div>
              <Link className="btn" style={{ background: "var(--on-ink)", color: "var(--ink)", fontWeight: 700, padding: "0 18px" }} to="/read">Resume</Link>
            </section>

            <PlanCard />
            <VerseOfTheDay translation={prefs.translation} />

            {due > 0 && (
              <section className="card-quiet row-between span2">
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 600 }}>{due} memory verse{due === 1 ? "" : "s"} due</div>
                  <div className="muted2" style={{ fontSize: 12, marginTop: 2 }}>A two-minute review keeps them fresh</div>
                </div>
                <Link className="btn btn-accent" to="/memory">Review</Link>
              </section>
            )}

            <nav className="span2" aria-label="More">
              <Link className="list-link" to="/bible"><span><strong>Your Bible</strong><small>{progress.length.toLocaleString()} of {TOTAL_CHAPTERS.toLocaleString()} chapters read</small></span><Icon name="grid" size={17} /></Link>
              <Link className="list-link" to="/plans"><span><strong>Reading plans</strong><small>Choose, change or build a plan</small></span><Icon name="clock" size={17} /></Link>
              <Link className="list-link" to="/memory"><span><strong>Memory verses</strong><small>{memory.length ? `${memory.length} in your queue` : "Add one with Memorize in the reader"}</small></span><Icon name="memorize" size={17} /></Link>
              <Link className="list-link" to="/threads"><span><strong>Threads</strong><small>{threads.length ? `${threads.length} thread${threads.length === 1 ? "" : "s"}` : "Trace one idea through Scripture"}</small></span><Icon name="thread" size={17} /></Link>
              <Link className="list-link" to="/sermon"><span><strong>Sermon mode</strong><small>Record, pin verses and thoughts, keep one note</small></span><Icon name="mic" size={17} /></Link>
              <Link className="list-link" to="/family"><span><strong>Family table</strong><small>One passage, a question for every age</small></span><Icon name="users" size={17} /></Link>
            </nav>
            <div className="span2"><SyncStatus /></div>
          </div>
        </main>
      </div>
    </div>
  );
}
