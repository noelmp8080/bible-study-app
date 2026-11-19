// Client for the "scholar" Supabase Edge Function (supabase/functions/scholar).
// The Anthropic key lives only in that function's secrets; the browser sends
// the signed-in user's JWT and never sees a key.
import { supabase } from "./supabase.js";

const ENDPOINT = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/scholar`;

export class AiError extends Error {}

async function call(body, signal) {
  if (!navigator.onLine) throw new AiError("You are offline. The AI needs a connection.");
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new AiError("The AI needs you to be signed in and online. (A preview session without an account cannot use it.)");
  let res;
  try {
    res = await fetch(ENDPOINT, {
      method: "POST", signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, apikey: import.meta.env.VITE_SUPABASE_ANON_KEY },
      body: JSON.stringify(body),
    });
  } catch (err) {
    if (err.name === "AbortError") throw err;
    throw new AiError("Could not reach the AI service. Check your connection and try again.");
  }
  if (res.ok) return res;
  let detail = "";
  try { detail = (await res.json()).error || ""; } catch { /* not JSON */ }
  if (res.status === 404) throw new AiError("The AI service is not set up yet: the “scholar” function has not been deployed to Supabase.");
  if (res.status === 401 || res.status === 403) throw new AiError("Your session has expired. Sign out and sign in again.");
  if (res.status === 429) throw new AiError(detail || "The AI is busy right now. Try again in a minute.");
  throw new AiError(detail || `The AI service returned an error (${res.status}).`);
}

/**
 * Stream a chat answer. `onText(fullTextSoFar)` is called as text arrives.
 * `context` is { reference, translation, verses, chapter } for "AI in context".
 */
export async function streamChat({ messages, context, translation, onText, signal }) {
  const res = await call({ task: "chat", messages, context, translation }, signal);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "", text = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let cut;
    while ((cut = buffer.indexOf("\n\n")) !== -1) {
      const event = buffer.slice(0, cut); buffer = buffer.slice(cut + 2);
      for (const line of event.split("\n")) {
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        const msg = JSON.parse(payload);
        if (msg.error) throw new AiError(msg.error);
        if (msg.text) { text += msg.text; onText?.(text); }
      }
    }
  }
  if (!text.trim()) throw new AiError("The AI returned an empty answer. Please try again.");
  return text;
}

/**
 * One-shot structured tasks. Each returns the parsed `result` from the function:
 *   summary          { ref, translation }                      → { text }
 *   sermon_summary   { title, pins:[{time, kind, ref, text}] } → { summary, key_points:[…], action_step }
 *   thread_suggest   { title, links:[{ref, label}] }           → { suggestions:[{ ref, reason }] }
 *   thread_outline   { title, links:[{ref, label, text}] }     → { text }
 *   family_questions { passage, text }                         → { little_ones, teens, adults }
 */
export async function runTask(task, input, signal) {
  const res = await call({ task, ...input }, signal);
  const data = await res.json();
  if (data.error) throw new AiError(data.error);
  return data.result;
}
