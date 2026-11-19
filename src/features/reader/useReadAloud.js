import { useCallback, useEffect, useRef, useState } from "react";
import { plainText } from "../../lib/verseText.js";
import { chunkVerses, fetchClip, naturalVoiceReady } from "../../lib/speech.js";

const hasDeviceVoice = typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
export const canSpeak = hasDeviceVoice || typeof Audio !== "undefined";

// A tenth of a second of silence. Phones only let audio start inside a tap, and
// the real audio arrives after a download; playing this inside the tap keeps
// the player allowed to start it.
let silenceUrl = null;
function silence() {
  if (silenceUrl) return silenceUrl;
  const n = 800, bytes = new Uint8Array(44 + n), view = new DataView(bytes.buffer);
  const put = (at, s) => { for (let i = 0; i < s.length; i++) bytes[at + i] = s.charCodeAt(i); };
  put(0, "RIFF"); view.setUint32(4, 36 + n, true); put(8, "WAVEfmt "); view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); view.setUint16(22, 1, true); view.setUint32(24, 8000, true); view.setUint32(28, 8000, true);
  view.setUint16(32, 1, true); view.setUint16(34, 8, true); put(36, "data"); view.setUint32(40, n, true);
  bytes.fill(128, 44);
  return (silenceUrl = URL.createObjectURL(new Blob([bytes], { type: "audio/wav" })));
}

/**
 * Read verses aloud and mark the verse being spoken.
 *
 * The natural voice comes from the "speak" function (ElevenLabs): the chapter
 * is fetched in a few pieces, each an MP3 with the time every verse starts.
 * When that voice is switched off, not set up, out of credits or out of reach,
 * the browser's own speech synthesis reads instead, one utterance per verse,
 * carrying on from the verse the natural voice had reached.
 *
 * Returns { state: "idle" | "loading" | "playing" | "paused", verse, rate, setRate, play(fromVerse), pause, resume, stop }.
 * `onNotice(message)` is called when the natural voice gives way to the device voice for a reason worth telling.
 */
export function useReadAloud(verses, { onVerse, onNotice } = {}) {
  const [state, setState] = useState("idle");
  const [verse, setVerse] = useState(null);
  const [rate, setRate] = useState(1);
  const run = useRef(0);          // increments to cancel an in-flight sequence
  const mode = useRef(null);      // "natural" | "device" while reading
  const audioRef = useRef(null);
  const abortRef = useRef(null);
  const rateRef = useRef(1);
  const onVerseRef = useRef(onVerse);
  const onNoticeRef = useRef(onNotice);
  useEffect(() => {
    rateRef.current = rate; onVerseRef.current = onVerse; onNoticeRef.current = onNotice;
    if (audioRef.current) audioRef.current.playbackRate = rate;
  }, [rate, onVerse, onNotice]);

  /** Silence everything in flight. */
  const halt = useCallback(() => {
    run.current++;
    abortRef.current?.abort(); abortRef.current = null;
    const audio = audioRef.current;
    if (audio) { audio.ontimeupdate = audio.onended = audio.onerror = null; audio.pause(); }
    if (hasDeviceVoice) window.speechSynthesis.cancel();
    mode.current = null;
  }, []);

  const stop = useCallback(() => { halt(); setState("idle"); setVerse(null); }, [halt]);

  const playDevice = useCallback((id, list) => {
    if (!hasDeviceVoice || !list.length) { setState("idle"); setVerse(null); return; }
    mode.current = "device";
    let i = 0;
    const next = () => {
      if (id !== run.current) return;
      if (i >= list.length) { mode.current = null; setState("idle"); setVerse(null); return; }
      const v = list[i++];
      const u = new SpeechSynthesisUtterance(plainText(v.text));
      u.rate = rateRef.current;
      u.lang = "en";
      u.onend = next;
      u.onerror = () => { if (id === run.current) { mode.current = null; setState("idle"); setVerse(null); } };
      setVerse(v.verse);
      onVerseRef.current?.(v.verse);
      window.speechSynthesis.speak(u);
    };
    setState("playing");
    next();
  }, []);

  const play = useCallback((from) => {
    if (!canSpeak || !verses?.length) return;
    halt();
    const id = run.current;
    const list = verses.filter((v) => !from || v.verse >= from);
    if (!list.length) return;
    const chunks = naturalVoiceReady() ? chunkVerses(verses) : [];
    if (!chunks.length) { playDevice(id, list); return; }

    // ── Natural voice ───────────────────────────────────────────────────────
    const audio = (audioRef.current ||= new Audio());
    audio.preload = "auto";
    audio.src = silence();
    audio.play().catch(() => {}); // inside the tap; see silence()
    mode.current = "natural";
    setState("loading");
    const abort = (abortRef.current = new AbortController());
    const clips = new Map();
    const clip = (k) => {
      if (!clips.has(k)) {
        clips.set(k, fetchClip(chunks[k].segments, {
          previous: chunks[k - 1]?.segments.join(" "), next: chunks[k + 1]?.segments.join(" "), signal: abort.signal,
        }));
      }
      return clips.get(k);
    };
    let reached = list[0].verse;
    const toDevice = (err) => {
      if (id !== run.current || err?.name === "AbortError") return;
      audio.ontimeupdate = audio.onended = audio.onerror = null;
      audio.pause();
      if (err?.message && !err.quiet) onNoticeRef.current?.(err.message);
      playDevice(id, verses.filter((v) => v.verse >= reached));
    };

    const playChunk = async (k, fromVerse) => {
      if (id !== run.current) return;
      if (k >= chunks.length) { mode.current = null; setState("idle"); setVerse(null); return; }
      const chunk = chunks[k];
      reached = fromVerse || chunk.verses[0];
      let got;
      try { got = await clip(k); } catch (err) { toDevice(err); return; }
      if (id !== run.current) return;

      const starts = Array.isArray(got.starts) && got.starts.length === chunk.verses.length ? got.starts : null;
      const first = Math.max(0, fromVerse ? chunk.verses.findIndex((n) => n >= fromVerse) : 0);
      let current = -1;
      const show = (i) => {
        if (i === current) return;
        current = i; reached = chunk.verses[i];
        setVerse(reached); onVerseRef.current?.(reached);
      };
      audio.ontimeupdate = () => {
        if (!starts || audio.paused) return;
        const t = audio.currentTime + 0.05;
        let i = Math.max(current, 0);
        while (i + 1 < starts.length && starts[i + 1] <= t) i++;
        while (i > 0 && starts[i] > t) i--;
        show(i);
      };
      audio.onended = () => playChunk(k + 1);
      audio.onerror = () => toDevice(new Error("The natural voice audio could not be played. Using this device's voice instead."));
      audio.src = got.url;
      audio.playbackRate = rateRef.current;
      if (starts && first > 0) {
        audio.addEventListener("loadedmetadata", () => { if (id === run.current) audio.currentTime = starts[first]; }, { once: true });
      }
      show(first);
      try { await audio.play(); }
      catch (err) { if (err?.name !== "AbortError") toDevice(new Error("This browser would not start the natural voice audio. Using this device's voice instead.")); return; }
      if (id !== run.current) return;
      setState((s) => (s === "loading" ? "playing" : s));
      if (k + 1 < chunks.length) clip(k + 1).catch(() => {}); // have the next piece ready
    };

    const k = chunks.findIndex((c) => c.verses[c.verses.length - 1] >= list[0].verse);
    playChunk(Math.max(0, k), from ? list[0].verse : null);
  }, [verses, halt, playDevice]);

  const pause = useCallback(() => {
    if (mode.current === "natural") audioRef.current?.pause();
    else if (hasDeviceVoice) window.speechSynthesis.pause();
    setState("paused");
  }, []);
  const resume = useCallback(() => {
    if (mode.current === "natural") audioRef.current?.play().catch(() => {});
    else if (hasDeviceVoice) window.speechSynthesis.resume();
    setState("playing");
  }, []);

  // Stop when the passage changes or the screen goes away.
  useEffect(() => () => { halt(); setState("idle"); setVerse(null); }, [verses, halt]);

  return { state, verse, rate, setRate, play, pause, resume, stop };
}
