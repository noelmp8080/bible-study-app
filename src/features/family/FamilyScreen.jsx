import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import Icon from "../../components/Icon.jsx";
import { MarkReadButton } from "../plans/PlanBlock.jsx";
import { useReadAloud, canSpeak } from "../reader/useReadAloud.js";
import { useAuth } from "../../hooks/useAuth.js";
import { useOnline } from "../../hooks/useOnline.js";
import { useReadSet } from "../../hooks/usePlan.js";
import { useChapter } from "../../hooks/useBible.js";
import { usePrefs } from "../../hooks/usePrefs.js";
import { syncNow } from "../../lib/store.js";
import { PLANS, planDays, planName, readingLabel } from "../../lib/plans.js";
import { chapterKey, readPath } from "../../lib/books.js";
import { daysBetween, isoDate } from "../../lib/format.js";
import { kjvText } from "../../lib/bible.js";
import { runTask } from "../../lib/ai.js";
import * as api from "../../lib/household.js";

const AGES = [["little_ones", "Little ones"], ["teens", "Teens"], ["adults", "Adults"]];

function Shell({ eyebrow, children, foot }) {
  return (
    <div className="screen">
      <div className="screen-scroll">
        <header className="page-head">
          <Link className="back-link" to="/"><Icon name="chevLeft" size={14} stroke={2} />Today</Link>
          <div className="eyebrow">{eyebrow}</div>
          <h1 className="display">Family table</h1>
          <p className="lede">One passage, one question for every age at the table.</p>
        </header>
        <main className="pad wrap-narrow stack">{children}</main>
      </div>
      {foot}
    </div>
  );
}

/** No household yet: accept an invitation or create one. */
function Join({ data, userEmail, reload }) {
  const [name, setName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState(null);
  async function run(fn) {
    setBusy(true); setProblem(null);
    try { await fn(); await reload(); } catch (err) { setProblem(err.message); }
    setBusy(false);
  }
  return (
    <Shell eyebrow="Set up">
      <label className="field"><span>Your name at the table</span>
        <input className="input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="e.g. Dad, Mum, Sam" maxLength={30} />
      </label>
      {data.invitations.map((inv) => (
        <div key={inv.household_id} className="card stack-sm">
          <div className="label">Invitation</div>
          <div className="display" style={{ fontSize: 24 }}>{inv.households?.name || "A household"}</div>
          <button type="button" className="btn btn-accent" disabled={busy || !displayName.trim()} onClick={() => run(() => api.acceptInvite(inv.household_id, displayName.trim()))}>Join this household</button>
        </div>
      ))}
      <form className="card stack" onSubmit={(e) => { e.preventDefault(); run(() => api.createHousehold(name.trim(), displayName.trim())); }}>
        <div className="label">Start a household</div>
        <label className="field"><span>Household name</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. The Perez family" maxLength={60} />
        </label>
        <button type="submit" className="btn btn-outline" disabled={busy || !name.trim() || !displayName.trim()}>Create household</button>
        <p className="muted" style={{ fontSize: 12.5, lineHeight: 1.5 }}>
          Each person signs in with their own email ({userEmail}) and keeps their own notes and highlights. Members only see whether the others have read tonight's passage.
        </p>
      </form>
      {problem && <p className="notice error" role="alert">{problem}</p>}
    </Shell>
  );
}

function Household({ data, userId, reload }) {
  const [prefs] = usePrefs();
  const online = useOnline();
  const readSet = useReadSet();
  const today = isoDate();
  const isOwner = data.role === "owner";
  const days = planDays(data.plan);
  const dayIndex = data.plan && days.length ? Math.min(days.length - 1, Math.max(0, daysBetween(String(data.plan.started_on).slice(0, 10), today))) : -1;
  const reading = dayIndex >= 0 ? days[dayIndex] : null;
  const passage = reading ? readingLabel(reading) : null;
  const first = reading?.[0];

  const [status, setStatus] = useState(null);
  const [questions, setQuestions] = useState(null);
  const [busy, setBusy] = useState(null);
  const [problem, setProblem] = useState(null);
  const [email, setEmail] = useState("");
  const chapter = useChapter(prefs.translation, first?.book || "John", first?.chapter || 1);
  const speech = useReadAloud(first ? chapter.verses : null);
  const iHaveRead = !!reading && reading.every((c) => readSet.has(chapterKey(c.book, c.chapter)));

  // Members' read status: refreshed when my own reading of tonight's passage changes.
  useEffect(() => {
    if (dayIndex < 0) return undefined;
    let alive = true;
    (async () => {
      await syncNow({ pull: false }); // make sure my own "read" mark has reached the server first
      try { const rows = await api.readStatus(data.household.id, dayIndex); if (alive) setStatus(rows); }
      catch (err) { if (alive) setProblem(err.message); }
    })();
    return () => { alive = false; };
  }, [data.household.id, dayIndex, iHaveRead]);

  async function makeQuestions(replace) {
    if (!reading) return;
    setBusy("questions"); setProblem(null);
    try {
      const text = reading.map((c) => kjvText(c.book, c.chapter)).join(" ").slice(0, 6000);
      const made = await runTask("family_questions", { passage, text });
      setQuestions(await api.saveQuestions(data.household.id, passage, today, made, replace));
    } catch (err) { setProblem(err.message); }
    setBusy(null);
  }

  // Tonight's questions are cached per household, passage and day, so everyone sees the same ones.
  useEffect(() => {
    if (!passage) return undefined;
    let alive = true;
    api.getQuestions(data.household.id, passage, today).then((q) => { if (alive) setQuestions(q); }, (err) => { if (alive) setProblem(err.message); });
    return () => { alive = false; };
  }, [data.household.id, passage, today]);

  async function run(label, fn) {
    setBusy(label); setProblem(null);
    try { await fn(); await reload(); } catch (err) { setProblem(err.message); }
    setBusy(null);
  }
  const readCount = status?.filter((m) => m.has_read).length ?? 0;

  return (
    <Shell eyebrow={passage ? `Tonight · ${passage}` : data.household.name}
      foot={reading && (
        <div className="foot" style={{ flexDirection: "row", gap: 8 }}>
          <button type="button" className="btn btn-outline btn-lg grow" disabled={busy !== null || !online} onClick={() => makeQuestions(true)}>{busy === "questions" ? "Writing…" : "New questions"}</button>
          {canSpeak && (
            <button type="button" className="btn btn-accent btn-lg grow" disabled={!chapter.verses}
              onClick={() => (speech.state === "idle" ? speech.play() : speech.state === "playing" ? speech.pause() : speech.resume())}>
              <Icon name={speech.state === "playing" ? "pause" : "speaker"} size={16} />{speech.state === "idle" ? "Read it aloud" : speech.state === "playing" ? "Pause" : "Resume"}
            </button>
          )}
        </div>
      )}>
      {!reading && (
        <section className="card stack">
          <div className="label">Shared reading plan</div>
          <p className="muted2" style={{ fontSize: 13.5, lineHeight: 1.55 }}>
            {isOwner ? "Choose the plan your household reads together. Tonight's passage is that plan's reading for today." : "The household owner has not chosen a shared plan yet."}
          </p>
          {isOwner && PLANS.map((def) => (
            <button key={def.key} type="button" className="btn btn-outline btn-wrap" disabled={busy !== null}
              onClick={() => run("plan", () => api.startSharedPlan(data.household.id, def.key, def.days.map((d) => d.map(([book, chapter]) => ({ book, chapter }))), today))}>
              Start “{def.name}” today
            </button>
          ))}
        </section>
      )}

      {reading && (
        <>
          <section className="card stack">
            <div className="row-between" style={{ alignItems: "baseline" }}>
              <div className="label">Reading together</div>
              <div style={{ fontSize: 12, fontWeight: 600 }}>{status ? `${readCount} of ${status.length} have read` : "…"}</div>
            </div>
            <div className="members">
              {(status || data.members.map((m) => ({ ...m, has_read: false }))).map((m) => (
                <div key={m.user_id}>
                  <div className={`sq${m.has_read ? " on" : ""}`} role="img" aria-label={m.has_read ? "Has read" : "Not yet read"}>{m.has_read && <Icon name="check" size={18} stroke={2} />}</div>
                  <span>{m.user_id === userId ? "You" : m.display_name}</span>
                </div>
              ))}
            </div>
            <div className="muted2" style={{ fontSize: 12.5 }}>{planName(data.plan)} · day {dayIndex + 1} of {days.length}</div>
            <div className="row" style={{ flexWrap: "wrap" }}>
              <Link className="btn btn-outline" to={readPath(first.book, first.chapter)}>Open {passage}</Link>
              {reading.length === 1 && <MarkReadButton book={first.book} chapter={first.chapter} block={false} />}
            </div>
            {speech.state !== "idle" && (
              <label className="row" style={{ fontSize: 12, fontWeight: 600, gap: 6 }}>Reading verse {speech.verse} · speed
                <select value={speech.rate} onChange={(e) => speech.setRate(Number(e.target.value))} style={{ minHeight: 36 }}>
                  {[0.75, 1, 1.25].map((r) => <option key={r} value={r}>{r}×</option>)}
                </select>
                <button type="button" className="btn btn-sm btn-quiet" onClick={speech.stop}>Stop</button>
              </label>
            )}
          </section>

          <div className="label" style={{ marginTop: 2 }}>Table questions</div>
          {questions ? AGES.map(([key, label]) => (
            <section key={key} className="card" style={{ padding: "12px 14px" }}>
              <div className="refline" style={{ marginBottom: 5 }}>{label}</div>
              <div className="scripture" style={{ fontSize: 15, lineHeight: 1.55 }}>{questions[key]}</div>
            </section>
          )) : (
            <section className="card stack-sm">
              <p className="muted2" style={{ fontSize: 13.5 }}>No questions for tonight yet.</p>
              <button type="button" className="btn btn-accent" disabled={busy !== null || !online} onClick={() => makeQuestions(false)}>{busy === "questions" ? "Writing…" : "Write tonight's questions"}</button>
            </section>
          )}
        </>
      )}

      {isOwner && (
        <section className="card stack">
          <div className="label">{data.household.name} · members</div>
          <p style={{ fontSize: 13.5 }}>{data.members.map((m) => m.display_name).join(", ")}</p>
          {data.pending.map((inv) => (
            <div key={inv.email} className="row-between">
              <span className="muted2" style={{ fontSize: 13 }}>Invited: {inv.email}</span>
              <button type="button" className="btn btn-sm btn-quiet" style={{ minHeight: 44 }} disabled={busy !== null} onClick={() => run("invite", () => api.cancelInvite(data.household.id, inv.email))}>Cancel</button>
            </div>
          ))}
          <form className="row" style={{ gap: 8, alignItems: "flex-end" }} onSubmit={(e) => { e.preventDefault(); run("invite", async () => { await api.invite(data.household.id, email); setEmail(""); }); }}>
            <label className="field grow"><span>Invite by email</span>
              <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" />
            </label>
            <button type="submit" className="btn" disabled={busy !== null || !email.trim()}>Invite</button>
          </form>
          <p className="muted" style={{ fontSize: 12.5, lineHeight: 1.5 }}>They sign in with that email address and will find the invitation on this screen. No email is sent by the app.</p>
        </section>
      )}
      {problem && <p className="notice error" role="alert">{problem}</p>}
    </Shell>
  );
}

/** Spec B6. Needs a signed-in account and the Phase 10 migration; says so plainly when either is missing. */
export default function FamilyScreen() {
  const auth = useAuth();
  const online = useOnline();
  const [state, setState] = useState({ loading: true, data: null, error: null });
  const [version, setVersion] = useState(0);
  const userId = auth.session?.user.id;
  const reload = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    if (!userId) return undefined;
    let alive = true;
    api.loadHousehold(userId).then(
      (data) => { if (alive) setState({ loading: false, data, error: null }); },
      (error) => { if (alive) setState({ loading: false, data: null, error }); },
    );
    return () => { alive = false; };
  }, [userId, version]);

  if (!userId) return <Shell eyebrow="Sign-in needed"><p className="notice">Family table works between accounts, so it needs you to be signed in. This preview session has no account.</p></Shell>;
  if (!online && !state.data) return <Shell eyebrow="Offline"><p className="notice">Family table needs a connection to see your household.</p></Shell>;
  if (state.loading) return <Shell eyebrow="Loading"><p className="empty" role="status">Finding your household…</p></Shell>;
  if (state.error) {
    return (
      <Shell eyebrow={state.error.notInstalled ? "Not set up yet" : "Something went wrong"}>
        <p className="notice" role="alert">{state.error.message}{state.error.notInstalled ? " Run the Phase 10 migration in supabase/migrations to switch it on." : ""}</p>
        <button type="button" className="btn btn-outline" onClick={reload}>Try again</button>
      </Shell>
    );
  }
  if (!state.data.household) return <Join data={state.data} userEmail={auth.user.email} reload={reload} />;
  return <Household data={state.data} userId={userId} reload={reload} />;
}
