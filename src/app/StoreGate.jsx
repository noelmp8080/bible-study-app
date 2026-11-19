import { useEffect, useState } from "react";
import { openStore, closeStore, setRemote } from "../lib/store.js";
import { loadKJV } from "../lib/bible.js";
import { usePrefs } from "../hooks/usePrefs.js";

/**
 * Opens the local data store for one user, then renders the app.
 * `remote` says whether there is a live session to sync with; it can come and
 * go (offline with an expired login) without the store being reloaded.
 */
export default function StoreGate({ userId, remote, children }) {
  const [openFor, setOpenFor] = useState(null);

  useEffect(() => {
    let alive = true;
    openStore(userId).then(() => { if (alive) setOpenFor(userId); });
    loadKJV().catch(() => { /* reported through the Bible status line */ });
    return () => { alive = false; setOpenFor(null); closeStore(); };
  }, [userId]);

  useEffect(() => {
    if (openFor === userId) setRemote(remote, { account: userId !== "local" });
  }, [openFor, userId, remote]);

  if (openFor !== userId) return <div className="splash" role="status" aria-label="Loading">B.</div>;
  return <><ThemeSync />{children}</>;
}

const THEME_COLOR = { light: "#faf9f6", dark: "#141210", sepia: "#f5efdc" };

/** Applies the saved theme and scripture size to the document. */
function ThemeSync() {
  const [prefs] = usePrefs();
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = prefs.theme;
    root.style.setProperty("--scripture-size", `${prefs.font_size}px`);
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLOR[prefs.theme]);
    try { localStorage.setItem("bsa_theme", prefs.theme); } catch { /* storage blocked */ }
  }, [prefs.theme, prefs.font_size]);
  return null;
}
