import { useCallback, useRef, useState } from "react";
import { ToastContext } from "../hooks/useToast.js";

/** Bottom toasts with an optional action (used for "Undo" after a delete). */
export default function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id) => setItems((list) => list.filter((t) => t.id !== id)), []);
  const toast = useCallback((message, { action, error = false, duration } = {}) => {
    const id = nextId.current++;
    setItems((list) => [...list.slice(-2), { id, message, action, error }]);
    setTimeout(() => dismiss(id), duration || (action ? 7000 : 4000));
  }, [dismiss]);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`toast${t.error ? " error" : ""}`}>
            <span>{t.message}</span>
            {t.action && (
              <button type="button" onClick={() => { t.action.run(); dismiss(t.id); }}>{t.action.label}</button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
