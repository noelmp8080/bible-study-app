import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase.js";
import { AuthContext } from "../hooks/useAuth.js";

const LOCAL_KEY = "bsa_local_preview";
const LAST_USER_KEY = "bsa_last_user";

function readLastUser() {
  try { const u = JSON.parse(localStorage.getItem(LAST_USER_KEY)); return u?.id ? u : null; } catch { return null; }
}

/**
 * Supabase Auth session for the whole app.
 *
 * Sign-in is by emailed magic link (the spec's default). The same email also
 * carries a six-digit code when the project's email template includes
 * {{ .Token }}, which is what an installed PWA or the desktop app needs,
 * because a link opens in the browser instead of the app.
 *
 * Offline: a login token lasts about an hour and cannot be renewed without a
 * connection. So that the app still opens offline, the last signed-in user is
 * remembered on the device; with no session but a remembered user, the app
 * opens that user's local data and syncing waits until the session returns.
 * Supabase reports a real sign-out (or a rejected token) as SIGNED_OUT, which
 * forgets the remembered user.
 *
 * In development builds only, `startLocal()` opens the app without an account:
 * everything is kept in this browser and nothing is sent to Supabase.
 */
export default function AuthProvider({ children }) {
  const [state, setState] = useState({ loading: true, session: null, lastUser: readLastUser() });
  const [local, setLocal] = useState(() => import.meta.env.DEV && sessionStorage.getItem(LOCAL_KEY) === "1");

  useEffect(() => {
    let alive = true;
    const apply = (event, session) => {
      if (!alive) return;
      let lastUser = readLastUser();
      try {
        if (session?.user) {
          lastUser = { id: session.user.id, email: session.user.email };
          localStorage.setItem(LAST_USER_KEY, JSON.stringify(lastUser));
        } else if (event === "SIGNED_OUT") {
          lastUser = null;
          localStorage.removeItem(LAST_USER_KEY);
        }
      } catch { /* storage blocked */ }
      setState({ loading: false, session, lastUser });
    };
    supabase.auth.getSession().then(({ data }) => apply("INITIAL", data.session));
    const { data } = supabase.auth.onAuthStateChange(apply);
    return () => { alive = false; data.subscription.unsubscribe(); };
  }, []);

  const value = useMemo(() => {
    const user = state.session?.user || state.lastUser || null;
    return {
      loading: state.loading,
      user,                                   // { id, email }
      session: state.session,                 // null while offline with an expired token
      waitingForSession: !state.session && !!state.lastUser,
      local: !user && local,
      async sendLink(email) {
        const { error } = await supabase.auth.signInWithOtp({
          email, options: { emailRedirectTo: window.location.origin, shouldCreateUser: true },
        });
        if (error) throw new Error(error.message);
      },
      async verifyCode(email, token) {
        const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
        if (error) throw new Error(error.message);
      },
      async signOut() {
        sessionStorage.removeItem(LOCAL_KEY);
        setLocal(false);
        try { localStorage.removeItem(LAST_USER_KEY); } catch { /* storage blocked */ }
        setState((s) => ({ ...s, session: null, lastUser: null }));
        await supabase.auth.signOut();
      },
      startLocal() {
        if (!import.meta.env.DEV) return;
        sessionStorage.setItem(LOCAL_KEY, "1");
        setLocal(true);
      },
    };
  }, [state, local]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
