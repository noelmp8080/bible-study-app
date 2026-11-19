import { useCallback, useEffect, useRef, useState } from "react";

function supportedMimeType() {
  const types = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
  return types.find((t) => { try { return MediaRecorder.isTypeSupported(t); } catch { return false; } }) || "";
}

export const canRecord = typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined";

/**
 * Microphone recording with MediaRecorder.
 *
 * Keeps the fixes the app already needed for iOS Safari: record with a 100 ms
 * timeslice so data arrives at all, trust the MIME type the recorder actually
 * chose, and strip codec parameters before storing it.
 *
 * Returns { recording, seconds, levels, error, start(), stop() → { blob, mime, duration } | null }.
 * `levels` (when `meter` is true) is a short rolling list of 0–1 input levels.
 * `onProgress({ blob, mime, duration })` is called every 15 seconds with the audio
 * so far, so a long recording can be kept safe while it is still running.
 */
export function useRecorder({ meter = false, bars = 24, onProgress } = {}) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [levels, setLevels] = useState([]);
  const [error, setError] = useState(null);
  const ref = useRef({ recorder: null, stream: null, chunks: [], mime: "", startedAt: 0, timer: 0, saver: 0, audio: null, raf: 0, resolve: null });
  const progress = useRef(onProgress);
  useEffect(() => { progress.current = onProgress; }, [onProgress]);

  const cleanup = useCallback(() => {
    const r = ref.current;
    clearInterval(r.timer); clearInterval(r.saver); cancelAnimationFrame(r.raf);
    r.stream?.getTracks().forEach((t) => t.stop());
    r.audio?.close().catch(() => {});
    r.stream = null; r.audio = null; r.recorder = null;
  }, []);
  useEffect(() => cleanup, [cleanup]);

  const start = useCallback(async () => {
    setError(null);
    if (!canRecord) { setError("Recording is not supported in this browser."); return false; }
    const r = ref.current;
    let stream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
    catch { setError("Microphone access was denied or is unavailable on this device."); return false; }
    const wanted = supportedMimeType();
    const recorder = new MediaRecorder(stream, wanted ? { mimeType: wanted } : {});
    r.stream = stream; r.recorder = recorder; r.chunks = []; r.mime = recorder.mimeType || wanted;
    recorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) r.chunks.push(e.data); };
    recorder.onstop = () => {
      const mime = (r.mime || "audio/webm").split(";")[0];
      const blob = r.chunks.length ? new Blob(r.chunks, { type: mime }) : null;
      const duration = Math.round((Date.now() - r.startedAt) / 1000);
      cleanup();
      r.resolve?.(blob && blob.size ? { blob, mime, duration } : null);
      r.resolve = null;
    };
    recorder.start(100);
    r.startedAt = Date.now();
    setSeconds(0); setRecording(true);
    r.timer = setInterval(() => setSeconds(Math.floor((Date.now() - r.startedAt) / 1000)), 500);
    r.saver = setInterval(() => {
      if (!progress.current || !r.chunks.length) return;
      const mime = (r.mime || "audio/webm").split(";")[0];
      progress.current({ blob: new Blob(r.chunks, { type: mime }), mime, duration: Math.round((Date.now() - r.startedAt) / 1000) });
    }, 15000);

    if (meter) {
      try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        const audio = new Ctx();
        const analyser = audio.createAnalyser();
        analyser.fftSize = 256;
        audio.createMediaStreamSource(stream).connect(analyser);
        r.audio = audio;
        const data = new Uint8Array(analyser.fftSize);
        let last = 0;
        const tick = (now) => {
          r.raf = requestAnimationFrame(tick);
          if (now - last < 220) return;
          last = now;
          analyser.getByteTimeDomainData(data);
          let peak = 0;
          for (const v of data) peak = Math.max(peak, Math.abs(v - 128) / 128);
          setLevels((list) => [...list.slice(-(bars - 1)), Math.min(1, peak * 1.8)]);
        };
        r.raf = requestAnimationFrame(tick);
      } catch { /* the meter is decoration; recording continues without it */ }
    }
    return true;
  }, [meter, bars, cleanup]);

  const stop = useCallback(() => new Promise((resolve) => {
    const r = ref.current;
    setRecording(false);
    if (!r.recorder || r.recorder.state === "inactive") { cleanup(); resolve(null); return; }
    r.resolve = resolve;
    r.recorder.stop();
  }), [cleanup]);

  /** Seconds since the recording started, read at call time (for pins). */
  const elapsed = useCallback(() => (ref.current.startedAt ? Math.floor((Date.now() - ref.current.startedAt) / 1000) : 0), []);

  return { recording, seconds, levels, error, start, stop, elapsed };
}
