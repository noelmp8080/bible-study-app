import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import Icon from "../../components/Icon.jsx";
import Sheet from "../../components/Sheet.jsx";
import Markdown from "../../components/Markdown.jsx";
import { useTable } from "../../hooks/useData.js";
import { usePrefs } from "../../hooks/usePrefs.js";
import { useToast } from "../../hooks/useToast.js";
import { getRows, put, remove } from "../../lib/store.js";
import { streamChat } from "../../lib/ai.js";
import { getPassage } from "../../lib/bible.js";
import { plainText } from "../../lib/verseText.js";
import { formatSelection } from "../../lib/refs.js";
import { copyText, timeAgo } from "../../lib/format.js";

const SUGGESTIONS = ["What is grace?", "Who were the Pharisees?", "Explain the Trinity", "Walk me through Psalm 23", "What is Sheol?", "Give me an overview of Romans 8", "What are the Beatitudes?"];
const LAST_THREAD = "bsa_ask_thread";

const contextLabel = (c) => `${formatSelection(c.book, c.chapter, c.verses || [])} · ${c.translation}`;
const parseContext = (text) => { try { const c = JSON.parse(text); return c?.book ? c : null; } catch { return null; } };

/** The selected verses plus the whole chapter, in the translation being read, for the model. */
async function buildContext(c) {
  const passage = await getPassage(c.translation, c.book, c.chapter);
  const line = (v) => `${v.verse} ${plainText(v.text)}`;
  return {
    reference: formatSelection(c.book, c.chapter, c.verses || []),
    translation: passage.translation,
    verses: passage.verses.filter((v) => (c.verses || []).includes(v.verse)).map(line).join("\n"),
    chapter: passage.verses.map(line).join("\n"),
  };
}

export default function AskScreen() {
  const location = useLocation();
  // Arriving from "Ask AI" on a verse starts a new conversation about that verse.
  return <Conversation key={location.state?.context ? location.key : "ask"} startContext={location.state?.context || null} />;
}

function Conversation({ startContext }) {
  const [prefs] = usePrefs();
  const toast = useToast();
  const navigate = useNavigate();
  const threads = useTable("ai_threads");
  const allMessages = useTable("ai_messages");

  const [threadId, setThreadId] = useState(() => {
    if (startContext) return null;
    const last = sessionStorage.getItem(LAST_THREAD);
    return last && getRows("ai_threads").some((t) => t.id === last) ? last : null;
  });
  const [draftContext, setDraftContext] = useState(startContext);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(null); // text streamed so far, while waiting
  const [error, setError] = useState(null);
  const [history, setHistory] = useState(false);
  const abort = useRef(null);
  const end = useRef(null);

  const thread = threads.find((t) => t.id === threadId) || null;
  const context = thread ? parseContext(thread.context_ref) : draftContext;
  const messages = useMemo(
    () => allMessages.filter((m) => m.thread_id === threadId).sort((a, b) => String(a.created_at).localeCompare(String(b.created_at))),
    [allMessages, threadId]);

  useEffect(() => { const log = end.current; if (log) log.scrollTop = log.scrollHeight; }, [messages.length, pending, error]);
  useEffect(() => () => abort.current?.abort(), []);

  async function answer(id, history) {
    setPending(""); setError(null);
    abort.current = new AbortController();
    try {
      const ctx = context ? await buildContext(context) : null;
      const text = await streamChat({
        messages: history.slice(-24).map(({ role, content }) => ({ role, content })),
        context: ctx, translation: prefs.translation, onText: setPending, signal: abort.current.signal,
      });
      put("ai_messages", { thread_id: id, role: "assistant", content: text });
    } catch (err) {
      if (err.name !== "AbortError") setError(err.message || "Something went wrong. Please try again.");
    }
    setPending(null);
  }

  function send(text) {
    const question = (text ?? input).trim();
    if (!question || pending !== null) return;
    setInput("");
    let id = threadId;
    if (!id) {
      id = put("ai_threads", { title: question.slice(0, 80), context_ref: draftContext ? JSON.stringify(draftContext) : null }).id;
      setThreadId(id);
      sessionStorage.setItem(LAST_THREAD, id);
    }
    const mine = put("ai_messages", { thread_id: id, role: "user", content: question });
    answer(id, [...messages, mine]);
  }

  function startNew() {
    abort.current?.abort();
    sessionStorage.removeItem(LAST_THREAD);
    setThreadId(null); setDraftContext(null); setError(null); setPending(null);
  }
  function open(id) { abort.current?.abort(); sessionStorage.setItem(LAST_THREAD, id); setThreadId(id); setError(null); setPending(null); setHistory(false); }
  function deleteThread(t) {
    const kept = allMessages.filter((m) => m.thread_id === t.id);
    remove("ai_threads", t.id);
    kept.forEach((m) => remove("ai_messages", m.id));
    if (t.id === threadId) startNew();
    toast("Conversation deleted", { action: { label: "Undo", run: () => { put("ai_threads", t); kept.forEach((m) => put("ai_messages", m)); } } });
  }
  function saveAsNote(message, index) {
    const question = [...messages.slice(0, index)].reverse().find((m) => m.role === "user");
    const sorted = [...(context?.verses || [])].sort((a, b) => a - b);
    const note = put("notes", {
      title: (question?.content || "AI answer").slice(0, 80),
      text: message.content,
      ref: context ? formatSelection(context.book, context.chapter, sorted) : "",
      tags: ["AI"], has_audio: false, has_image: false,
      book: context?.book || null, chapter: context?.chapter || null,
      verse_start: sorted[0] || null, verse_end: sorted[sorted.length - 1] || null,
      updated_at: new Date().toISOString(),
    });
    toast("Saved to your notes", { action: { label: "Open", run: () => navigate(`/notes/${note.id}`) } });
  }

  const lastIsUser = messages.length > 0 && messages[messages.length - 1].role === "user";
  const sortedThreads = [...threads].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));

  return (
    <div className="screen">
      <header className="page-head">
        <div className="head-row">
          <div>
            <div className="eyebrow">Study assistant · {prefs.translation}</div>
            <h1 className="display">Ask</h1>
          </div>
          <div className="row">
            <button type="button" className="btn btn-quiet" onClick={() => setHistory(true)} disabled={!threads.length}><Icon name="clock" size={15} />History</button>
            <button type="button" className="btn btn-outline" onClick={startNew} disabled={!threadId && !draftContext}><Icon name="plus" size={15} stroke={2} />New</button>
          </div>
        </div>
      </header>

      {messages.length === 0 && pending === null && (
        <div className="suggest" role="group" aria-label="Suggested questions">
          {(context ? [`Explain ${formatSelection(context.book, context.chapter, context.verses || [])}`, "What is the historical setting?", "What do the key words mean in the original language?", "How does this connect to the rest of Scripture?"] : SUGGESTIONS)
            .map((q) => <button key={q} type="button" onClick={() => send(q)}>{q}</button>)}
        </div>
      )}

      <div className="chat" role="log" aria-live="polite" aria-label="Conversation" ref={end}>
        {messages.length === 0 && pending === null && (
          <div className="bubble assistant">
            Ask anything about the Bible: theology, history, Greek and Hebrew word studies, or a walk through a chapter.
            {context ? " This conversation has the passage you selected attached, so answers can quote it." : " Select a verse in the reader and choose Ask AI to ask about it in context."}
          </div>
        )}
        {messages.map((m, i) => (
          <div key={m.id} className={`bubble ${m.role === "user" ? "user" : "assistant"}`}>
            {m.role === "user" ? m.content : (
              <>
                <Markdown text={m.content} />
                <div className="actions">
                  <button type="button" className="btn btn-sm btn-quiet" onClick={() => saveAsNote(m, i)}><Icon name="notes" size={13} />Save as note</button>
                  <button type="button" className="btn btn-sm btn-quiet" onClick={async () => toast((await copyText(m.content)) ? "Answer copied" : "Copying is not available here")}><Icon name="copy" size={13} />Copy</button>
                </div>
              </>
            )}
          </div>
        ))}
        {pending !== null && (
          <div className="bubble assistant" aria-busy="true">
            {pending ? <Markdown text={pending} /> : <span className="muted">Searching the scriptures…</span>}
          </div>
        )}
        {error && (
          <div className="notice error" role="alert">
            <p>{error}</p>
            {lastIsUser && <button type="button" className="btn btn-sm btn-outline" style={{ marginTop: 8 }} onClick={() => answer(threadId, messages)}>Try again</button>}
          </div>
        )}
      </div>

      {context && (
        <div className="chat-context">
          <span>About <b>{contextLabel(context)}</b> · verse and chapter text attached</span>
          {!thread && <button type="button" className="btn btn-sm btn-quiet" onClick={() => setDraftContext(null)}>Remove</button>}
        </div>
      )}
      <form className="composer" onSubmit={(e) => { e.preventDefault(); send(); }}>
        <label className="sr-only" htmlFor="ask-input">Your question</label>
        <textarea id="ask-input" className="input" rows={1} value={input} onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="Ask anything about the Bible" style={{ resize: "none", maxHeight: 140 }} />
        {pending !== null
          ? <button type="button" className="icon-btn" onClick={() => abort.current?.abort()} aria-label="Stop answering"><Icon name="stop" size={16} /></button>
          : <button type="submit" className="icon-btn solid" disabled={!input.trim()} aria-label="Send"><Icon name="arrowUp" size={18} stroke={2} /></button>}
      </form>

      {history && (
        <Sheet title="Conversations" onClose={() => setHistory(false)}>
          {sortedThreads.map((t) => {
            const c = parseContext(t.context_ref);
            return (
              <div key={t.id} className="row" style={{ gap: 0, alignItems: "stretch" }}>
                <button type="button" className="list-link" style={{ borderTopWidth: 1, marginTop: -1 }} onClick={() => open(t.id)} aria-current={t.id === threadId ? "true" : undefined}>
                  <span><strong>{t.title || "Conversation"}</strong><small>{c ? `${contextLabel(c)} · ` : ""}{timeAgo(t.created_at)}</small></span>
                </button>
                <button type="button" className="icon-btn" style={{ height: "auto", marginTop: -1, borderLeft: "none" }} aria-label={`Delete conversation: ${t.title}`} onClick={() => deleteThread(t)}><Icon name="trash" size={16} /></button>
              </div>
            );
          })}
        </Sheet>
      )}
    </div>
  );
}
