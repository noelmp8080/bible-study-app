// "speak" — read-aloud audio in a natural voice, from ElevenLabs.
//
// The browser never holds an ElevenLabs key. It sends the verses to read with
// the signed-in user's Supabase JWT; this function turns them into speech once,
// keeps the audio in a private Storage bucket and the timings in a table, and
// from then on answers the same request from what it kept. A passage costs
// ElevenLabs credits the first time anyone hears it and nothing after that.
//
// Secrets and settings (set with `supabase secrets set …`):
//   ELEVENLABS_API_KEY  required
//   SPEAK_VOICE_ID      optional ElevenLabs voice id, default "George" (a premade voice)
//   SPEAK_MODEL         optional model id, default "eleven_multilingual_v2"
//   SPEAK_DAILY_CHARS   optional cap on newly generated characters per day (UTC), default 60000
// SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are provided by the platform.
//
// Request body: { segments: string[], previous?: string, next?: string }
//   segments   the verses to read, in order; spoken as one passage
//   previous   the text just before, and
//   next       the text just after: not spoken, they only shape the delivery
// Response: { url, starts }
//   url        a link to the MP3, good for an hour
//   starts     when each segment begins, in seconds (null if timings are unavailable)
// Errors:      { error, code } with code "not_configured" | "limit" | "voice" | "bad_request"
import { createClient } from "npm:@supabase/supabase-js@2";

const VOICE = Deno.env.get("SPEAK_VOICE_ID") || "JBFqnCBsd6RMkjVDRZzb";
const MODEL = Deno.env.get("SPEAK_MODEL") || "eleven_multilingual_v2";
const DAILY_CHARS = Number(Deno.env.get("SPEAK_DAILY_CHARS")) || 60000;
const MAX_CHARS = 3000;      // per request; the app sends about half of this
const MAX_SEGMENTS = 120;
const BUCKET = "bsa-speech";
const FORMAT = "mp3_44100_64"; // mono speech; half the storage of the 128 kbps default

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const fail = (status: number, code: string, error: string) => json({ error, code }, status);

async function sha256(text: string) {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

type Alignment = { character_start_times_seconds?: number[]; character_end_times_seconds?: number[] } | null | undefined;

/** When each segment starts, from ElevenLabs' per-character timings of the joined text. */
function segmentStarts(segments: string[], alignment: Alignment): number[] | null {
  const times = alignment?.character_start_times_seconds;
  if (!Array.isArray(times) || !times.length) return null;
  const ends = alignment?.character_end_times_seconds;
  const duration = (Array.isArray(ends) && ends[ends.length - 1]) || times[times.length - 1];
  const total = segments.reduce((n, s) => n + s.length, 0) + segments.length - 1;
  let offset = 0;
  return segments.map((s) => {
    // One timing per character is the normal case; otherwise place the segment by its share of the text.
    const at = times.length === total ? times[offset] : (offset / total) * duration;
    offset += s.length + 1;
    return Math.round(at * 1000) / 1000;
  });
}

async function generate(key: string, text: string, previous: string, next: string) {
  const call = (context: boolean) =>
    fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE}/with-timestamps?output_format=${FORMAT}`, {
      method: "POST",
      headers: { "xi-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify({
        text, model_id: MODEL,
        ...(context && previous ? { previous_text: previous } : {}),
        ...(context && next ? { next_text: next } : {}),
      }),
    });
  let res = await call(true);
  // Not every model accepts the surrounding text; the passage itself is what matters.
  if ((res.status === 400 || res.status === 422) && (previous || next)) res = await call(false);
  return res;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return fail(405, "bad_request", "Use POST.");

  // Only a signed-in user may call this. The anon key alone is not enough.
  const url = Deno.env.get("SUPABASE_URL")!;
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: auth, error: authError } = await createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!).auth.getUser(token);
  if (authError || !auth?.user) return fail(401, "auth", "Sign in to use the natural voice.");

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return fail(400, "bad_request", "The request was not valid JSON."); }
  const segments = (Array.isArray(body.segments) ? body.segments : [])
    .map((s) => String(s ?? "").replace(/\s+/g, " ").trim()).filter(Boolean);
  const text = segments.join(" ");
  if (!segments.length) return fail(400, "bad_request", "Nothing to read.");
  if (segments.length > MAX_SEGMENTS || text.length > MAX_CHARS) return fail(400, "bad_request", "That passage is too long to read in one piece.");
  const previous = String(body.previous ?? "").slice(-400);
  const next = String(body.next ?? "").slice(0, 400);

  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const hash = await sha256(`${VOICE}\n${MODEL}\n${segments.join("\n")}`);
  const signed = async (path: string) => {
    const { data, error } = await admin.storage.from(BUCKET).createSignedUrl(path, 3600);
    if (error || !data?.signedUrl) throw new Error(error?.message || "no signed URL");
    return data.signedUrl;
  };

  try {
    // Heard before: answer from what was kept.
    const { data: kept, error: lookupError } = await admin.from("speech_clips").select("path, starts").eq("hash", hash).maybeSingle();
    if (lookupError) throw new Error(lookupError.message);
    if (kept) return json({ url: await signed(kept.path), starts: kept.starts });

    const key = Deno.env.get("ELEVENLABS_API_KEY");
    if (!key) return fail(503, "not_configured", "The natural voice is not set up yet (no ELEVENLABS_API_KEY secret).");

    // A ceiling on new audio per day, so a mistake or a stranger cannot empty the ElevenLabs account.
    const midnight = new Date(); midnight.setUTCHours(0, 0, 0, 0);
    const { data: today, error: usageError } = await admin.from("speech_clips").select("chars").gte("created_at", midnight.toISOString());
    if (usageError) throw new Error(usageError.message);
    const used = (today || []).reduce((n, row) => n + (row.chars || 0), 0);
    if (used + text.length > DAILY_CHARS) return fail(429, "limit", "Today's allowance of new natural-voice audio has been used. Passages already heard still play.");

    const res = await generate(key, text, previous, next);
    if (!res.ok) {
      let detail: { status?: string; message?: string } = {};
      try { const parsed = await res.json(); detail = typeof parsed.detail === "object" && parsed.detail ? parsed.detail : { message: String(parsed.detail || "") }; } catch { /* not JSON */ }
      console.error("speak: ElevenLabs", res.status, detail.status, detail.message);
      if (res.status === 401 && detail.status !== "quota_exceeded") return fail(503, "not_configured", "The natural voice is misconfigured (its ElevenLabs key was rejected).");
      if (res.status === 429 || detail.status === "quota_exceeded") return fail(429, "limit", "The ElevenLabs account has no credits left for new audio. Passages already heard still play.");
      return fail(502, "voice", `The voice service could not read that passage (${detail.status || res.status}).`);
    }
    const out = await res.json();
    if (!out.audio_base64) return fail(502, "voice", "The voice service returned no audio.");
    const audio = Uint8Array.from(atob(out.audio_base64), (c) => c.charCodeAt(0));
    const starts = segmentStarts(segments, out.alignment);

    const path = `${VOICE}/${hash}.mp3`;
    const { error: uploadError } = await admin.storage.from(BUCKET).upload(path, audio, { contentType: "audio/mpeg", upsert: true });
    if (uploadError) throw new Error(uploadError.message);
    const { error: saveError } = await admin.from("speech_clips")
      .upsert({ hash, voice: VOICE, model: MODEL, chars: text.length, path, starts, created_by: auth.user.id }, { onConflict: "hash" });
    if (saveError) throw new Error(saveError.message);
    return json({ url: await signed(path), starts });
  } catch (err) {
    console.error("speak failed:", err);
    return fail(500, "voice", "Something went wrong while preparing the audio.");
  }
});
