import { useState } from "react";
import { useAuth } from "../../hooks/useAuth.js";
import { useOnline } from "../../hooks/useOnline.js";

// A sign-in link that fails comes back to the app with the reason in the URL
// (#error_code=otp_expired…). Read once at load, before anything clears it.
const linkError = (() => {
  try {
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    if (!params.get("error") && !params.get("error_code")) return null;
    return params.get("error_code") === "otp_expired"
      ? "That sign-in link has already been used or has expired. Each link works once, for an hour. Request a new one below."
      : params.get("error_description") || "That sign-in link did not work. Request a new one below.";
  } catch { return null; }
})();

/** Supabase's own wording for the errors people actually meet, made actionable. */
function explain(message) {
  if (/rate limit/i.test(message || "")) {
    return "No email was sent: only a couple of sign-in emails can go out each hour, and that limit has been reached. "
      + "Use the most recent sign-in email you already have (its link, or its code with \"I already have a code\"), "
      + "or try again in about an hour.";
  }
  return message || "Something went wrong. Please try again.";
}

// Typing the code means leaving the app to read the email, and an installed app
// can be reloaded on the way back. The address a code was sent to is remembered
// for as long as that code is valid, so the code step is still there.
const PENDING_KEY = "bsa_signin_pending";
const PENDING_MS = 60 * 60 * 1000;

function readPending() {
  try {
    const p = JSON.parse(localStorage.getItem(PENDING_KEY));
    return p?.email && Date.now() - p.at < PENDING_MS ? p.email : "";
  } catch { return ""; }
}

function writePending(email) {
  try {
    if (email) localStorage.setItem(PENDING_KEY, JSON.stringify({ email, at: Date.now() }));
    else localStorage.removeItem(PENDING_KEY);
  } catch { /* storage blocked */ }
}

/** The gate in front of the whole app: email in, magic link (or code) back. */
export default function SignIn() {
  const auth = useAuth();
  const online = useOnline();
  const [email, setEmail] = useState(readPending);
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(() => !!email);
  // False when the code step was opened for an email that is already in the inbox.
  const [justSent, setJustSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(linkError);

  async function run(fn) {
    setBusy(true); setError(null);
    try { await fn(); } catch (err) { setError(explain(err.message)); }
    setBusy(false);
  }
  const openCodeStep = (fresh) => { writePending(email.trim()); setJustSent(fresh); setSent(true); };
  const send = (e) => { e.preventDefault(); run(async () => { await auth.sendLink(email.trim()); openCodeStep(true); }); };
  const verify = (e) => {
    e.preventDefault();
    run(async () => { await auth.verifyCode(email.trim(), code.trim()); writePending(""); });
  };
  const startOver = () => { writePending(""); setSent(false); setCode(""); setError(null); };

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
            <button className="btn btn-quiet" type="button" disabled={busy || !online || !email.trim()}
              onClick={() => { setError(null); openCodeStep(false); }}>
              I already have a code
            </button>
            {!online && <p className="notice">You are offline. Signing in needs a connection the first time.</p>}
          </form>
        ) : (
          <div className="stack">
            <p className="notice" role="status">
              {justSent
                ? <>Check <b>{email.trim()}</b> for a sign-in email. In a browser, open its link on this device.</>
                : <>Use the most recent sign-in email sent to <b>{email.trim()}</b>.</>}
              {" "}In the app on your Home Screen or desktop, type the code from that email here instead: a link would open in the browser, not in the app.
            </p>
            <form className="stack" onSubmit={verify}>
              <label className="field">
                <span>Six-digit code from that email</span>
                <input className="input tnum" inputMode="numeric" autoComplete="one-time-code" maxLength={8} value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} placeholder="123456" />
              </label>
              <div className="btn-row">
                <button className="btn btn-outline" type="button" onClick={startOver}>Use another email</button>
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
