import { useState } from "react";
import { useAuth } from "../../hooks/useAuth.js";
import { useOnline } from "../../hooks/useOnline.js";

/** The gate in front of the whole app: email in, magic link (or code) back. */
export default function SignIn() {
  const auth = useAuth();
  const online = useOnline();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function run(fn) {
    setBusy(true); setError(null);
    try { await fn(); } catch (err) { setError(err.message || "Something went wrong. Please try again."); }
    setBusy(false);
  }
  const send = (e) => { e.preventDefault(); run(async () => { await auth.sendLink(email.trim()); setSent(true); }); };
  const verify = (e) => { e.preventDefault(); run(() => auth.verifyCode(email.trim(), code.trim())); };

  return (
    <main className="signin">
      <div className="signin-box">
        <div>
          <div className="eyebrow" style={{ marginBottom: 12 }}>The Bible Study App</div>
          <h1 className="display" style={{ fontSize: 56, lineHeight: 0.94 }}>Sign in</h1>
          <p className="muted2" style={{ fontSize: 14, lineHeight: 1.6, marginTop: 12 }}>
            Your notes, highlights and reading progress are private to your account and sync across your devices.
          </p>
        </div>

        {!sent ? (
          <form className="stack" onSubmit={send}>
            <label className="field">
              <span>Email address</span>
              <input className="input" type="email" required autoComplete="email" inputMode="email" value={email}
                onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
            </label>
            <button className="btn btn-accent btn-lg" type="submit" disabled={busy || !online || !email.trim()}>
              {busy ? "Sending…" : "Email me a sign-in link"}
            </button>
            {!online && <p className="notice">You are offline. Signing in needs a connection the first time.</p>}
          </form>
        ) : (
          <div className="stack">
            <p className="notice" role="status">
              Check <b>{email.trim()}</b> for a sign-in link and open it on this device. You can close this tab afterwards.
            </p>
            <form className="stack" onSubmit={verify}>
              <label className="field">
                <span>Or type the six-digit code from that email</span>
                <input className="input tnum" inputMode="numeric" autoComplete="one-time-code" maxLength={8} value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} placeholder="123456" />
              </label>
              <div className="btn-row">
                <button className="btn btn-outline" type="button" onClick={() => { setSent(false); setCode(""); setError(null); }}>Use another email</button>
                <button className="btn btn-accent" type="submit" disabled={busy || code.length < 6}>{busy ? "Checking…" : "Sign in"}</button>
              </div>
            </form>
          </div>
        )}

        {error && <p className="notice error" role="alert">{error}</p>}

        {import.meta.env.DEV && (
          <div className="stack-sm" style={{ borderTop: "1px solid var(--border)", paddingTop: 16 }}>
            <div className="label">Development build only</div>
            <button className="btn btn-quiet" type="button" onClick={auth.startLocal}>Open without an account (this browser only)</button>
            <p className="muted" style={{ fontSize: 12 }}>Nothing is sent to Supabase in this mode. It is not part of the production build.</p>
          </div>
        )}
      </div>
    </main>
  );
}
