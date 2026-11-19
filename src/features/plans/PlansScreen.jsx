import { useState } from "react";
import { Link } from "react-router";
import Icon from "../../components/Icon.jsx";
import BuildPlanSheet from "./BuildPlanSheet.jsx";
import { startPlan } from "../../lib/planActions.js";
import { useActivePlan, useReadSet } from "../../hooks/usePlan.js";
import { useToast } from "../../hooks/useToast.js";
import { currentUserId, patch } from "../../lib/store.js";
import { PLANS, readingLabel } from "../../lib/plans.js";
import { readPath } from "../../lib/books.js";

export default function PlansScreen() {
  const { plan, state, name } = useActivePlan();
  const readSet = useReadSet();
  const toast = useToast();
  const [building, setBuilding] = useState(false);
  const shared = !!plan?.household_id;
  const mine = !plan?.user_id || plan.user_id === currentUserId();

  function start(def) {
    startPlan({ plan_key: def.key });
    toast(`Started “${def.name}”`);
  }
  function stop() {
    patch("user_plans", plan.id, { active: false });
    toast("Plan stopped", { action: { label: "Undo", run: () => patch("user_plans", plan.id, { active: true }) } });
  }

  return (
    <div className="screen">
      <header className="page-head">
        <Link className="back-link" to="/"><Icon name="chevLeft" size={14} stroke={2} />Today</Link>
        <div className="eyebrow">Reading plans</div>
        <h1 className="display">Read with a plan</h1>
        <p className="lede">A plan advances when you mark its chapters read. Your Bible map fills in at the same time.</p>
      </header>
      <div className="screen-scroll">
        <main className="pad wrap stack">
          {plan && state && (
            <section className="card stack" aria-label="Current plan">
              <div className="row-between" style={{ alignItems: "baseline" }}>
                <div className="label">{shared ? "Your household's plan" : "Your current plan"}</div>
                <div style={{ fontSize: 12, fontWeight: 600 }}>Day {state.dayNumber} of {state.total}</div>
              </div>
              <div className="display" style={{ fontSize: 26, lineHeight: 1.15 }}>{name}</div>
              <div className="progress" role="img" aria-label={`Day ${state.dayNumber} of ${state.total}`}><div style={{ width: `${state.percent}%` }} /></div>
              <p className="muted2" style={{ fontSize: 13 }}>
                Started {new Date(`${state.started}T12:00:00`).toLocaleDateString(undefined, { month: "long", day: "numeric" })} · {state.doneCount} of {state.total} days complete
                {state.finished ? " · finished" : ` · ${state.doneToday ? "next" : "today"}: ${readingLabel(state.doneToday ? state.nextReading : state.reading)}`}
              </p>
              <div className="row" style={{ flexWrap: "wrap" }}>
                {!state.finished && (
                  <Link className="btn btn-accent" to={readPath((state.remainingToday[0] || state.nextReading[0]).book, (state.remainingToday[0] || state.nextReading[0]).chapter)}>Open the reading</Link>
                )}
                {mine && !shared && <button type="button" className="btn btn-quiet" onClick={stop}>Stop this plan</button>}
              </div>
            </section>
          )}

          <div className="label">Choose a plan</div>
          <div className="grid2">
            {PLANS.map((def) => {
              const active = plan?.plan_key === def.key;
              return (
                <section key={def.key} className="card stack">
                  <div className="display" style={{ fontSize: 24, lineHeight: 1.15 }}>{def.name}</div>
                  <p className="muted2" style={{ fontSize: 13.5, lineHeight: 1.55 }}>{def.description} {def.days.length} days.</p>
                  <button type="button" className={`btn ${active ? "btn-quiet" : "btn-outline"}`} onClick={() => start(def)}>
                    {active ? "Start again from day 1" : plan ? "Switch to this plan" : "Start today"}
                  </button>
                </section>
              );
            })}
            <section className="card stack">
              <div className="display" style={{ fontSize: 24, lineHeight: 1.15 }}>Every chapter I have not read</div>
              <p className="muted2" style={{ fontSize: 13.5, lineHeight: 1.55 }}>Built from the empty squares on your Bible map, at one to four chapters a day.</p>
              <button type="button" className="btn btn-outline" onClick={() => setBuilding(true)}>Build this plan</button>
            </section>
          </div>
        </main>
      </div>
      {building && <BuildPlanSheet readSet={readSet} onClose={(made) => { setBuilding(false); if (made) toast("Your personal plan has started"); }} />}
    </div>
  );
}
