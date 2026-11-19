// Client for the "speak" Supabase Edge Function (supabase/functions/speak):
// read-aloud audio in a natural voice. The ElevenLabs key lives only in that
// function's secrets. Each passage is generated once and kept in Supabase, so
// asking for it again is only a download.
import { supabase } from "./supabase.js";
import { plainText } from "./verseText.js";

const ENDPOINT = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/speak`;
const CHOICE_KEY = "bsa_voice";
const DEVICE = "Using this device's voice instead.";

/**
 * `lasting`: do not try the natural voice again until the app is reopened.
 * `quiet`: fall back to the device voice without telling the reader.
 */
export class SpeechError extends Error {
  constructor(message, { lasting = false, quiet = false } = {}) { super(message); this.lasting = lasting; this.quiet = quiet; }
}

/** Which voice this device reads with: "natural" (ElevenLabs, the default) or "device". */
export function voiceChoice() {
  try { return localStorage.getItem(CHOICE_KEY) === "device" ? "device" : "natural"; } catch { return "natural"; }
}
export function setVoiceChoice(choice) {
  try { localStorage.setItem(CHOICE_KEY, choice === "device" ? "device" : "natural"); } catch { /* storage blocked */ }
}

let unavailable = false; // set by a lasting error, for as long as the app stays open

/** Worth asking the server for natural audio right now? */
export function naturalVoiceReady() {
  return typeof Audio !== "undefined" && navigator.onLine && !unavailable && voiceChoice() === "natural";
}

/**
 * Split a chapter into pieces of whole verses, short enough that the first one
 * is ready quickly. The split depends only on the chapter, never on where
 * reading starts, so the same pieces are asked for (and found) every time.
 * Returns [{ verses: [number…], segments: [text…] }].
 */
export function chunkVerses(verses, max = 1500) {
  const chunks = [];
  let size = 0;
  for (const v of verses || []) {
    const text = plainText(v.text).replace(/\s+/g, " ").trim();
    if (!text) continue;
    const last = chunks[chunks.length - 1];
    if (!last || size + text.length + 1 > max) { chunks.push({ verses: [v.verse], segments: [text] }); size = text.length; }
    else { last.verses.push(v.verse); last.segments.push(text); size += text.length + 1; }
  }
  return chunks;
}

const recent = new Map(); // text → { at, clip }; the links last an hour

/** Resolve to { url, starts } for these verse texts. Throws SpeechError (or AbortError). */
export async function fetchClip(segments, { previous, next, signal } = {}) {
  const key = segments.join("\n");
  const hit = recent.get(key);
  if (hit && Date.now() - hit.at < 45 * 60 * 1000) return hit.clip;
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new SpeechError("The natural voice needs you to be signed in.", { lasting: true, quiet: true });
    let res;
    try {
      res = await fetch(ENDPOINT, {
        method: "POST", signal,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, apikey: import.meta.env.VITE_SUPABASE_ANON_KEY },
        body: JSON.stringify({ segments, previous, next }),
      });
    } catch (err) {
      if (err.name === "AbortError") throw err;
      throw new SpeechError(`Could not reach the natural voice. ${DEVICE}`);
    }
    if (!res.ok) {
      let detail = {};
      try { detail = await res.json(); } catch { /* not JSON */ }
      // Not deployed yet: the app simply reads as it always has.
      if (res.status === 404) throw new SpeechError("The natural voice is not set up yet.", { lasting: true, quiet: true });
      if (detail.code === "not_configured") throw new SpeechError(`${detail.error} ${DEVICE}`, { lasting: true });
      if (detail.code === "limit") throw new SpeechError(`${detail.error} ${DEVICE}`, { lasting: true });
      if (res.status === 401 || res.status === 403) throw new SpeechError(`Your session has expired, so the natural voice is unavailable. ${DEVICE}`, { lasting: true });
      throw new SpeechError(`${detail.error || `The natural voice returned an error (${res.status}).`} ${DEVICE}`);
    }
    const clip = await res.json();
    if (!clip?.url) throw new SpeechError(`The natural voice returned no audio. ${DEVICE}`);
    recent.set(key, { at: Date.now(), clip });
    return clip;
  } catch (err) {
    if (err instanceof SpeechError && err.lasting) unavailable = true;
    throw err;
  }
}
