import { useEffect, useRef, useState } from "react";
import { parseQuery } from "../../lib/searchQuery.js";

let worker = null;
function getWorker() {
  worker ||= new Worker(new URL("./search.worker.js", import.meta.url), { type: "module" });
  return worker;
}

/**
 * Debounced (200 ms) full-text search in the worker.
 * Returns { key, indices, ot, nt, error }; `key` is the query the result is for,
 * so callers can tell a finished search from one still running.
 */
export function useVerseSearch(query, enabled) {
  const [result, setResult] = useState({ key: "", indices: null, ot: 0, nt: 0, error: null });
  const seq = useRef(0);
  const parsed = parseQuery(query);
  const key = enabled && !parsed.empty ? JSON.stringify([parsed.words, parsed.phrases]) : "";

  useEffect(() => {
    if (!key) return undefined;
    const id = ++seq.current;
    const w = getWorker();
    const onMessage = (e) => {
      if (e.data.type !== "result" || e.data.id !== id) return;
      setResult({ key, indices: e.data.indices || new Int32Array(0), ot: e.data.ot || 0, nt: e.data.nt || 0, error: e.data.error || null });
    };
    w.addEventListener("message", onMessage);
    const [words, phrases] = JSON.parse(key);
    const timer = setTimeout(() => w.postMessage({ id, words, phrases }), 200);
    return () => { clearTimeout(timer); w.removeEventListener("message", onMessage); };
  }, [key]);

  return { ...result, current: result.key === key, key, parsed };
}
