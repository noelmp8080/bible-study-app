import { createContext, useContext } from "react";

/** toast(message, { action: { label, run }, error, duration }) — see components/Toasts.jsx */
export const ToastContext = createContext(() => {});
export const useToast = () => useContext(ToastContext);
