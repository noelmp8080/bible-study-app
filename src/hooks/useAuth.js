import { createContext, useContext } from "react";

/** { loading, user, session, waitingForSession, local, sendLink(email), verifyCode(email, code), signOut(), startLocal() } — see app/AuthProvider.jsx */
export const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);
