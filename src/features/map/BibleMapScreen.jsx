import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import Icon from "../../components/Icon.jsx";
import { ChapterPicker } from "../../components/Pickers.jsx";
import BuildPlanSheet from "../plans/BuildPlanSheet.jsx";
import { useReadSet } from "../../hooks/usePlan.js";
import { useToast } from "../../hooks/useToast.js";
import { BOOKS, BOOKS_NT, BOOKS_OT, TOTAL_CHAPTERS, allChapters, chapterKey, readPath } from "../../lib/books.js";

/**
 * One testament: a row per book, one 10px square per chapter.
 * The squares are a pointer shortcut (too small for touch or to tab through),
 * so they are hidden from assistive technology; each book name is a real
 * button that states the count and opens that book's chapter picker.
 */
function Testament({ title, books, readSet, onBook }) {
  return (
    <div>
      <h2 className="label" style={{ marginBottom: 14 }}>{title} · {books.reduce((n, [, c]) => n + c, 0)} chapters</h2>
      {books.map(([book, count]) => {
        let read = 0;
        const cells = [];
        for (let c = 1; c <= count; c++) {
          const on = readSet.has(chapterKey(book, c));
          if (on) read++;
          cells.push(<Link key={c} to={readPath(book, c)} className={on ? "on" : undefined} tabIndex={-1} title={`${book} ${c}${on ? " · read" : ""}`} />);
        }
        const done = read === count;
        return (
          <div key={book} className="map-row">
            <button type="button" className={`name${done ? " done" : ""}`} onClick={() => onBook(book)}
              aria-label={`${book}: ${read} of ${count} chapters read${done ? ", finished" : ""}. Choose a chapter`}>{book}</button>
            <div className="map-cells" aria-hidden="true">{cells}</div>
          </div>
        );
      })}
    </div>
  );
}

/** Spec B1: every chapter on one page, filled in from reading_progress. */
export default function BibleMapScreen() {
  const readSet = useReadSet();
  const navigate = useNavigate();
  const toast = useToast();
  const [pickBook, setPickBook] = useState(null);
  const [building, setBuilding] = useState(false);

  const totals = useMemo(() => {
    let booksDone = 0;
    for (const [book, count] of BOOKS) {
      let read = 0;
      for (let c = 1; c <= count; c++) if (readSet.has(chapterKey(book, c))) read++;
      if (read === count) booksDone++;
    }
    return { booksDone };
  }, [readSet]);

  function openUnread() {
    const unread = allChapters().filter((c) => !readSet.has(chapterKey(c.book, c.chapter)));
    if (!unread.length) { toast("You have read every chapter."); return; }
    const pick = unread[Math.floor(Math.random() * unread.length)];
    navigate(readPath(pick.book, pick.chapter));
  }

  return (
    <div className="screen">
      <div className="screen-scroll">
        <header className="page-head">
          <Link className="back-link" to="/"><Icon name="chevLeft" size={14} stroke={2} />Today</Link>
          <div className="head-row" style={{ gap: 24 }}>
            <div>
              <div className="eyebrow">Your Bible</div>
              <h1 className="display">Every chapter, on one page</h1>
            </div>
            <div className="map-stats">
              <div><div className="num">{readSet.size.toLocaleString()}</div><small>of {TOTAL_CHAPTERS.toLocaleString()} chapters read</small></div>
              <div><div className="num">{totals.booksDone}</div><small>of 66 books finished</small></div>
              <div className="map-legend" aria-hidden="true">
                <div><i className="on" />Read</div>
                <div><i />Not yet</div>
              </div>
            </div>
          </div>
        </header>
        <main className="pad">
          <div className="map-cols">
            <section><Testament title="Old Testament" books={BOOKS_OT} readSet={readSet} onBook={setPickBook} /></section>
            <section>
              <Testament title="New Testament" books={BOOKS_NT} readSet={readSet} onBook={setPickBook} />
              <div className="card stack">
                <div className="display" style={{ fontSize: 26, lineHeight: 1.1 }}>Where have you never been?</div>
                <p className="muted2" style={{ fontSize: 13, lineHeight: 1.6 }}>
                  Choose a square, or a book name, to open that chapter. Finished books turn bold. The map fills in by itself as you mark chapters read.
                </p>
                <button type="button" className="btn btn-accent btn-wrap" onClick={openUnread}>Open a chapter I have never read</button>
                <button type="button" className="btn btn-outline btn-wrap" onClick={() => setBuilding(true)}>Build a plan from the empty squares</button>
              </div>
            </section>
          </div>
        </main>
      </div>
      {pickBook && <ChapterPicker book={pickBook} current={null} readSet={readSet} onClose={() => setPickBook(null)} onPick={(n) => navigate(readPath(pickBook, n))} />}
      {building && <BuildPlanSheet readSet={readSet} onClose={(made) => { setBuilding(false); if (made) { toast("Your personal plan has started"); navigate("/plans"); } }} />}
    </div>
  );
}
