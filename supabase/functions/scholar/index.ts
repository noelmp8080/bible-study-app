// "scholar" — the app's only route to Claude.
//
// The browser never holds an Anthropic key. It calls this function with the
// signed-in user's Supabase JWT; the function checks that the JWT belongs to a
// real user, then calls the Anthropic API with a key kept in function secrets.
//
// Secrets and settings (set with `supabase secrets set …`):
//   ANTHROPIC_API_KEY   required
//   SCHOLAR_MODEL       optional model id, default "claude-opus-5-5"
//   SCHOLAR_FALLBACKS   optional, "off" disables server-side refusal fallbacks
// SUPABASE_URL and SUPABASE_ANON_KEY are provided by the platform.
//
// Request body: { task, ... }
//   chat              { messages, translation, context? }   → text/event-stream of { text } chunks
//   summary           { ref, translation }                  → { result: { text } }
//   sermon_summary    { title, pins }                       → { result: { summary, key_points, action_step } }
//   thread_suggest    { title, links }                      → { result: { suggestions: [{ ref, reason }] } }
//   thread_outline    { title, links }                      → { result: { text } }
//   family_questions  { passage, text }                     → { result: { little_ones, teens, adults } }
import Anthropic from "npm:@anthropic-ai/sdk@^1.10.0";
import { createClient } from "npm:@supabase/supabase-js@2";

const MODEL = Deno.env.get("SCHOLAR_MODEL") || "claude-opus-5-5";
// Models that accept the server-side refusal-fallback parameter.
const FALLBACK_OK = /^claude-(fable-5-[12]|opus-5(-5)?|sonnet-5-5)$/.test(MODEL) && Deno.env.get("SCHOLAR_FALLBACKS") !== "off";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const TRANSLATIONS: Record<string, string> = { KJV: "King James Version", ASV: "American Standard Version" };
const clip = (value: unknown, max: number) => String(value ?? "").slice(0, max);

function chatSystem(translation: string, context?: { reference?: string; translation?: string; verses?: string; chapter?: string }) {
  const name = TRANSLATIONS[translation] || TRANSLATIONS.KJV;
  let system =
    `You are a knowledgeable, pastoral Bible study assistant inside "The Bible Study App". ` +
    `The reader is studying from the ${name} (${translation}). Give theological depth, historical context and, where it helps, ` +
    `insight from the original Greek and Hebrew. Cite specific references. Be warm, reverent and clear. ` +
    `Write for reading on a phone: short paragraphs, markdown headings and lists only where they help, no preamble.`;
  if (context?.chapter) {
    const t = context.translation || translation;
    system +=
      `\n\nThe reader is asking about ${clip(context.reference, 80)} in the ${t}. ` +
      `When you quote this passage, quote it exactly as given below, from the ${t}, and do not substitute another translation's wording.` +
      (context.verses ? `\n\nSelected verse(s):\n${clip(context.verses, 6000)}` : "") +
      `\n\nThe surrounding chapter, for context (verse numbers first):\n${clip(context.chapter, 40000)}`;
  }
  return system;
}

/** One-shot tasks that return JSON matching `schema`. */
const TASKS: Record<string, (b: Record<string, unknown>) => { system: string; user: string; schema: Record<string, unknown> }> = {
  summary: (b) => ({
    system: `You are a ${clip(b.translation, 8) || "KJV"} Bible study assistant. Be concise and faithful to the text.`,
    user: `Write a study summary for ${clip(b.ref, 80)} (${clip(b.translation, 8) || "KJV"}). ` +
      `Put it in the "text" field, formatted exactly as:\n\nOVERVIEW:\n[2 sentences]\n\nKEY POINTS:\n• [point 1]\n• [point 2]\n• [point 3]\n\nEXPOSITION:\n[2-3 sentences of theological insight]`,
    schema: { type: "object", properties: { text: { type: "string" } }, required: ["text"], additionalProperties: false },
  }),
  sermon_summary: (b) => ({
    system: "You turn a listener's sermon notes into a short study summary. Use only what is in the pins: the passages and the listener's own notes. Do not invent what the preacher said.",
    user: `Sermon: ${clip(b.title, 120)}\n\nPins, in order (time, then a passage or the listener's note):\n${clip(JSON.stringify(b.pins), 30000)}\n\n` +
      `Return a summary of two to four sentences, three to five key points, and one concrete action step for this week, all drawn only from these pins.`,
    schema: {
      type: "object",
      properties: { summary: { type: "string" }, key_points: { type: "array", items: { type: "string" } }, action_step: { type: "string" } },
      required: ["summary", "key_points", "action_step"], additionalProperties: false,
    },
  }),
  thread_suggest: (b) => ({
    system: "You help a reader trace one idea through the Bible. Suggest only real passages, written as Book chapter:verse or Book chapter:verse-verse using standard English book names.",
    user: `Thread title: ${clip(b.title, 120)}\nPassages so far, in order:\n${clip(JSON.stringify(b.links), 8000)}\n\n` +
      `Suggest up to three passages that could come next in this thread and are not already in it. Give each a one-line reason.`,
    schema: {
      type: "object",
      properties: {
        suggestions: {
          type: "array",
          items: { type: "object", properties: { ref: { type: "string" }, reason: { type: "string" } }, required: ["ref", "reason"], additionalProperties: false },
        },
      },
      required: ["suggestions"], additionalProperties: false,
    },
  }),
  thread_outline: (b) => ({
    system: "You write lesson outlines for small-group Bible study. Keep the passages in the order given and quote them as supplied.",
    user: `Thread: ${clip(b.title, 120)}\nPassages in order, with their text:\n${clip(JSON.stringify(b.links), 30000)}\n\n` +
      `Write a lesson outline as plain text in the "text" field: a one-paragraph introduction, then for each passage a heading line ` +
      `("1. Reference — label"), the passage quoted, one sentence on how it carries the thread forward, and two discussion prompts. End with a closing question.`,
    schema: { type: "object", properties: { text: { type: "string" } }, required: ["text"], additionalProperties: false },
  }),
  family_questions: (b) => ({
    system: "You write warm, concrete discussion questions for a family reading the Bible together at the table. One question each, grounded in the passage given.",
    user: `Passage: ${clip(b.passage, 80)}\n\nText:\n${clip(b.text, 12000)}\n\n` +
      `Write three questions about this passage: one for little ones (about ages 4 to 8, simple and concrete), one for teens, and one for adults. One or two sentences each.`,
    schema: {
      type: "object",
      properties: { little_ones: { type: "string" }, teens: { type: "string" }, adults: { type: "string" } },
      required: ["little_ones", "teens", "adults"], additionalProperties: false,
    },
  }),
};

function describe(err: unknown): { status: number; message: string } {
  if (err instanceof Anthropic.RateLimitError) return { status: 429, message: "The AI is busy right now. Try again in a minute." };
  if (err instanceof Anthropic.AuthenticationError) return { status: 500, message: "The AI service is misconfigured (its API key was rejected)." };
  if (err instanceof Anthropic.BadRequestError) return { status: 400, message: `The AI could not accept that request: ${err.message}` };
  if (err instanceof Anthropic.APIError) return { status: 502, message: `The AI service returned an error (${err.status ?? "network"}). Try again.` };
  return { status: 500, message: "Something went wrong while asking the AI." };
}

/** Options shared by every request; refusal fallbacks are on for models that support them. */
function withFallback<T extends Record<string, unknown>>(params: T) {
  return FALLBACK_OK ? { ...params, betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" } : params;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Use POST." }, 405);

  // Only a signed-in user may call this. The anon key alone is not enough.
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
  const { data: auth, error: authError } = await supabase.auth.getUser(token);
  if (authError || !auth?.user) return json({ error: "Sign in to use the AI." }, 401);

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return json({ error: "The AI service is not configured yet (no ANTHROPIC_API_KEY secret)." }, 500);
  const client = new Anthropic({ apiKey });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: "The request was not valid JSON." }, 400); }
  const task = String(body.task || "chat");

  // ── Streaming chat ─────────────────────────────────────────────────────────
  if (task === "chat") {
    const raw = Array.isArray(body.messages) ? body.messages.slice(-30) : [];
    const messages = raw
      .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
      .map((m) => ({ role: m.role as "user" | "assistant", content: clip(m.content, 12000) }));
    if (!messages.length || messages[messages.length - 1].role !== "user") return json({ error: "Send at least one question." }, 400);
    const translation = clip(body.translation, 8) || "KJV";
    const params = withFallback({
      model: MODEL,
      max_tokens: 8000,
      cache_control: { type: "ephemeral" }, // follow-up questions reuse the cached passage context
      system: chatSystem(translation, body.context as Record<string, string> | undefined),
      messages,
    });

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (data: unknown) => controller.enqueue(encoder.encode(`data: ${typeof data === "string" ? data : JSON.stringify(data)}\n\n`));
        try {
          // deno-lint-ignore no-explicit-any
          const run = FALLBACK_OK ? client.beta.messages.stream(params as any) : client.messages.stream(params as any);
          for await (const event of run) {
            if (event.type === "content_block_delta" && event.delta.type === "text_delta") send({ text: event.delta.text });
          }
          const final = await run.finalMessage();
          if (final.stop_reason === "refusal") send({ error: "The AI declined to answer that question." });
          else if (final.stop_reason === "max_tokens") send({ text: "\n\n*(The answer was cut off because it reached the length limit.)*" });
          send("[DONE]");
        } catch (err) {
          console.error("scholar chat failed:", err);
          send({ error: describe(err).message });
        }
        controller.close();
      },
    });
    return new Response(stream, { headers: { ...cors, "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" } });
  }

  // ── One-shot JSON tasks ────────────────────────────────────────────────────
  const build = TASKS[task];
  if (!build) return json({ error: `Unknown task "${task}".` }, 400);
  const spec = build(body);
  try {
    const params = withFallback({
      model: MODEL,
      max_tokens: 8000,
      system: spec.system,
      messages: [{ role: "user" as const, content: spec.user }],
      output_config: { format: { type: "json_schema", schema: spec.schema } },
    });
    // deno-lint-ignore no-explicit-any
    const response = FALLBACK_OK ? await client.beta.messages.create(params as any) : await client.messages.create(params as any);
    if (response.stop_reason === "refusal") return json({ error: "The AI declined this request." }, 422);
    // deno-lint-ignore no-explicit-any
    const text = (response.content as any[]).filter((b) => b.type === "text").map((b) => b.text).join("");
    let result: unknown;
    try { result = JSON.parse(text); }
    catch { return json({ error: "The AI returned an answer that could not be read. Try again." }, 502); }
    return json({ result });
  } catch (err) {
    console.error(`scholar ${task} failed:`, err);
    const { status, message } = describe(err);
    return json({ error: message }, status);
  }
});
