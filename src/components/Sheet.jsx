import { useEffect, useRef } from "react";
import Icon from "./Icon.jsx";

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * A modal sheet: bottom-anchored by default, or near the top with position="top".
 * Focus moves into the sheet when it opens, stays inside while it is open, and
 * returns to whatever was focused before when it closes. Escape and a tap on
 * the scrim close it (pass `onScrim` to decide what a scrim tap does instead;
 * `clear` leaves the page behind fully visible).
 */
export default function Sheet({ title, onClose, children, position = "bottom", wide = false, head, clear = false, onScrim }) {
  const ref = useRef(null);
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);

  useEffect(() => {
    const previous = document.activeElement;
    const node = ref.current;
    (node?.querySelector("[data-autofocus]") || node?.querySelector(FOCUSABLE) || node)?.focus();
    function onKey(e) {
      if (e.key === "Escape") { e.stopPropagation(); closeRef.current(); return; }
      if (e.key !== "Tab" || !node) return;
      const els = [...node.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null);
      if (!els.length) return;
      const first = els[0], last = els[els.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      if (previous instanceof HTMLElement && document.contains(previous)) previous.focus();
    };
  }, []);

  return (
    <div className={`scrim${position === "top" ? " top" : ""}${clear ? " clear" : ""}`}
      onMouseDown={(e) => { if (e.target === e.currentTarget) { if (onScrim) onScrim(e); else onClose(); } }}>
      <div ref={ref} className={`sheet${wide ? " wide" : ""}`} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1}>
        {head || (
          <div className="sheet-head">
            <h2>{title}</h2>
            <button type="button" className="icon-btn bare" onClick={onClose} aria-label="Close"><Icon name="close" size={20} /></button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
