import { useSyncExternalStore } from "react";

const QUERIES = [["wide", "(min-width: 1280px)"], ["desktop", "(min-width: 1024px)"], ["tablet", "(min-width: 640px)"]];
const lists = typeof matchMedia === "function" ? QUERIES.map(([name, q]) => [name, matchMedia(q)]) : [];

function subscribe(fn) {
  lists.forEach(([, mq]) => mq.addEventListener("change", fn));
  return () => lists.forEach(([, mq]) => mq.removeEventListener("change", fn));
}
const snapshot = () => lists.find(([, mq]) => mq.matches)?.[0] || "phone";

/** "phone" (< 640), "tablet" (640–1023), "desktop" (≥ 1024) or "wide" (≥ 1280). */
export function useBreakpoint() {
  const size = useSyncExternalStore(subscribe, snapshot);
  return { size, isPhone: size === "phone", isTablet: size === "tablet", isDesktop: size === "desktop" || size === "wide", isWide: size === "wide" };
}
