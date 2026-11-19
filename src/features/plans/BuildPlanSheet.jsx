import { useState } from "react";
import Sheet from "../../components/Sheet.jsx";
import { startPlan } from "../../lib/planActions.js";
import { allChapters, chapterKey } from "../../lib/books.js";
import { buildCustomReadings } from "../../lib/plans.js";

/** "Build a plan from the empty squares": every unread chapter, in order, at a chosen pace. */
export default function BuildPlanSheet({ readSet, onClose }) {
  const [pace, setPace] = useState(2);
  const unread = allChapters().filter((c) => !readSet.has(chapterKey(c.book, c.chapter)));
  const days = Math.ceil(unread.length / pace);

  function create() {
    startPlan({ plan_key: "custom", custom_readings: buildCustomReadings(unread, pace) });
    onClose(true);
  }

  return (
    <Sheet title="Build a plan from the empty squares" onClose={() => onClose(false)}>
      {unread.length === 0 ? (
        <p className="muted2">You have marked every chapter as read. There is nothing left to plan.</p>
      ) : (
        <div className="stack">
          <p className="muted2" style={{ fontSize: 13.5, lineHeight: 1.6 }}>
            A personal plan covering the {unread.length.toLocaleString()} chapters you have not read yet, in Bible order. It replaces your current plan.
          </p>
          <div className="stack-sm">
            <div className="label">Chapters a day</div>
            <div className="seg" role="group" aria-label="Chapters a day">
              {[1, 2, 3, 4].map((n) => <button key={n} type="button" aria-pressed={pace === n} onClick={() => setPace(n)}>{n}</button>)}
            </div>
          </div>
          <p style={{ fontSize: 13.5 }}>That is <b>{days.toLocaleString()} day{days === 1 ? "" : "s"}</b>{days > 60 ? `, about ${Math.round(days / 30)} months` : ""}.</p>
          <button type="button" className="btn btn-accent btn-lg" onClick={create}>Start this plan today</button>
        </div>
      )}
    </Sheet>
  );
}
