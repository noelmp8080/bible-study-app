import { useState } from "react";
import Icon from "../../components/Icon.jsx";
import SyncStatus from "../../components/SyncStatus.jsx";
import { usePrefs, THEMES } from "../../hooks/usePrefs.js";
import { useAuth } from "../../hooks/useAuth.js";
import { useSync } from "../../hooks/useData.js";
import { useBibleStatus } from "../../hooks/useBible.js";
import { syncNow } from "../../lib/store.js";
import { loadKJV } from "../../lib/bible.js";
import { TRANSLATIONS } from "../../lib/books.js";

const THEME_LOOK = { light: ["Light", "#faf9f6", "#181614"], dark: ["Dark", "#141210", "#e6e1d8"], sepia: ["Sepia", "#f5efdc", "#3b2d1e"] };

export default function SettingsScreen() {
  const [prefs, setPrefs] = usePrefs();
  const auth = useAuth();
  const sync = useSync();
  const bible = useBibleStatus();
  const [handle, setHandle] = useState(prefs.share_handle);

  return (
    <div className="screen">
      <header className="page-head">
        <div className="eyebrow">Personalize your study</div>
        <h1 className="display">Preferences</h1>
      </header>
      <div className="screen-scroll">
        <main className="pad wrap">
          <div className="grid2">
            <section className="card stack" aria-labelledby="set-look">
              <h2 className="label" id="set-look">Appearance</h2>
              <div className="row" role="group" aria-label="Theme" style={{ gap: 8 }}>
                {THEMES.map((id) => {
                  const [label, bg, fg] = THEME_LOOK[id];
                  const on = prefs.theme === id;
                  return (
                    <button key={id} type="button" aria-pressed={on} onClick={() => setPrefs({ theme: id })}
                      style={{ flex: 1, minHeight: 56, background: bg, color: fg, border: on ? "2.5px solid var(--accent)" : "1px solid var(--border-strong)", fontSize: 13, fontWeight: on ? 700 : 500, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                      {on && <Icon name="check" size={14} stroke={2.25} />}{label}
                    </button>
                  );
                })}
              </div>
              <div className="row-between">
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>Scripture size</div>
                  <div className="muted" style={{ fontSize: 12 }}>{prefs.font_size}px (12 to 28)</div>
                </div>
                <div className="row" style={{ gap: 8 }}>
                  <button type="button" className="icon-btn" aria-label="Smaller text" disabled={prefs.font_size <= 12} onClick={() => setPrefs({ font_size: prefs.font_size - 1 })}><Icon name="minus" size={16} /></button>
                  <span className="tnum" style={{ minWidth: 28, textAlign: "center", fontWeight: 600 }} aria-hidden="true">{prefs.font_size}</span>
                  <button type="button" className="icon-btn" aria-label="Larger text" disabled={prefs.font_size >= 28} onClick={() => setPrefs({ font_size: prefs.font_size + 1 })}><Icon name="plus" size={16} /></button>
                </div>
              </div>
              <p className="scripture" style={{ fontSize: prefs.font_size, borderTop: "1px solid var(--border)", paddingTop: 12 }}>
                In the beginning was the Word, and the Word was with God, and the Word was God.
              </p>
            </section>

            <section className="card stack" aria-labelledby="set-tr">
              <h2 className="label" id="set-tr">Translation</h2>
              <div className="seg" role="group" aria-label="Translation">
                {Object.keys(TRANSLATIONS).map((id) => (
                  <button key={id} type="button" aria-pressed={prefs.translation === id} onClick={() => setPrefs({ translation: id })}>{id} · {TRANSLATIONS[id].era}</button>
                ))}
              </div>
              <p className="muted2" style={{ fontSize: 13, lineHeight: 1.55 }}>
                {TRANSLATIONS[prefs.translation].label}. The KJV is stored whole on this device. ASV chapters are downloaded the first time you open them and kept after that.
              </p>
              <div className="row-between">
                <SyncStatus />
                {bible === "error" && <button type="button" className="btn btn-sm btn-outline" onClick={() => loadKJV().catch(() => {})}>Retry download</button>}
              </div>

              <h2 className="label" style={{ marginTop: 8 }}>Verse cards</h2>
              <label className="field">
                <span>Your handle, shown on shared cards when you switch it on</span>
                <input className="input" value={handle} placeholder="@yourname" maxLength={40} autoComplete="off"
                  onChange={(e) => setHandle(e.target.value)} onBlur={() => { if (handle.trim() !== prefs.share_handle) setPrefs({ share_handle: handle.trim() }); }} />
              </label>
            </section>

            <section className="card stack" aria-labelledby="set-acct">
              <h2 className="label" id="set-acct">Account and sync</h2>
              {auth.user ? (
                <p style={{ fontSize: 14 }}>Signed in as <b>{auth.user.email}</b></p>
              ) : (
                <p className="notice">Development preview without an account. Everything stays in this browser.</p>
              )}
              {auth.user && (
                <div className="muted2" style={{ fontSize: 13, lineHeight: 1.55 }}>
                  {auth.waitingForSession ? "Your login could not be renewed (probably no connection). Your data is on this device and will sync when you are back online. "
                    : sync.pending > 0 ? `${sync.pending} change${sync.pending === 1 ? "" : "s"} waiting to sync.` : "Everything on this device is synced."}
                  {sync.error ? ` Last problem: ${sync.error}` : ""}
                </div>
              )}
              {sync.behind.length > 0 && (
                <p className="notice" role="status">
                  The database needs an update before these can sync: <b>{sync.behind.join(", ")}</b>. They are saved on this device and will sync once the migrations in <code>supabase/migrations</code> are run.
                </p>
              )}
              <div className="row" style={{ flexWrap: "wrap" }}>
                {auth.session && <button type="button" className="btn btn-outline" onClick={() => syncNow()}><Icon name="sync" size={15} />Sync now</button>}
                <button type="button" className="btn btn-quiet" onClick={() => auth.signOut()}><Icon name="signout" size={15} />{auth.user ? "Sign out" : "Leave preview"}</button>
              </div>
            </section>

            <section className="card stack" aria-labelledby="set-about">
              <h2 className="label" id="set-about">About</h2>
              <div className="display" style={{ fontSize: 24 }}>The Bible Study App</div>
              <p className="muted2" style={{ fontSize: 13.5, lineHeight: 1.65 }}>
                Read, search and study offline; highlight, bookmark and take notes on any passage; follow a plan, memorise verses, record sermons and ask questions in context. Your data is private to your account.
              </p>
              <p className="muted" style={{ fontSize: 12, fontFamily: "ui-monospace, Consolas, monospace" }}>Build {__COMMIT_HASH__}</p>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
