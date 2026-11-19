import { useCallback, useEffect, useRef, useState } from "react";
import { plainText } from "../../lib/verseText.js";

export const canSpeak = typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;

/**
 * Read verses aloud with the browser's speech synthesis, one utterance per
 * verse so the verse being spoken can be marked on screen.
 * Returns { state: "idle" | "playing" | "paused", verse, rate, setRate, play(fromVerse), pause, resume, stop }.
 */
export function useReadAloud(verses, { onVerse } = {}) {
  const [state, setState] = useState("idle");
  const [verse, setVerse] = useState(null);
  const [rate, setRate] = useState(1);
  const run = useRef(0);          // increments to cancel an in-flight sequence
  const rateRef = useRef(1);
  const onVerseRef = useRef(onVerse);
  useEffect(() => { rateRef.current = rate; onVerseRef.current = onVerse; }, [rate, onVerse]);

  const stop = useCallback(() => {
    run.current++;
    if (canSpeak) window.speechSynthesis.cancel();
    setState("idle"); setVerse(null);
  }, []);

  const play = useCallback((from) => {
    if (!canSpeak || !verses?.length) return;
    window.speechSynthesis.cancel();
    const id = ++run.current;
    const list = verses.filter((v) => !from || v.verse >= from);
    let i = 0;
    const next = () => {
      if (id !== run.current) return;
      if (i >= list.length) { setState("idle"); setVerse(null); return; }
      const v = list[i++];
      const u = new SpeechSynthesisUtterance(plainText(v.text));
      u.rate = rateRef.current;
      u.lang = "en";
      u.onend = next;
      u.onerror = () => { if (id === run.current) { setState("idle"); setVerse(null); } };
      setVerse(v.verse);
      onVerseRef.current?.(v.verse);
      window.speechSynthesis.speak(u);
    };
    setState("playing");
    next();
  }, [verses]);

  const pause = useCallback(() => { if (canSpeak) window.speechSynthesis.pause(); setState("paused"); }, []);
  const resume = useCallback(() => { if (canSpeak) window.speechSynthesis.resume(); setState("playing"); }, []);

  // Stop when the passage changes or the screen goes away.
  useEffect(() => () => { run.current++; if (canSpeak) window.speechSynthesis.cancel(); }, [verses]);

  return { state, verse, rate, setRate, play, pause, resume, stop };
}
