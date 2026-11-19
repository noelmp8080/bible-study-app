import { useEffect, useState } from "react";
import { mediaUrl } from "../lib/store.js";

/** Object URL for a stored file (local copy first, else downloaded). null while loading or missing. */
export function useMediaUrl(bucket, path) {
  const key = path ? `${bucket}/${path}` : null;
  const [state, setState] = useState({ key: null, url: null });
  useEffect(() => {
    if (!key) return undefined;
    let alive = true;
    mediaUrl(bucket, path).then((url) => { if (alive) setState({ key, url }); });
    return () => { alive = false; };
  }, [key, bucket, path]);
  return state.key === key ? state.url : null;
}
