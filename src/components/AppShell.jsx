import { NavLink, Outlet, Link } from "react-router";
import Icon from "./Icon.jsx";
import { usePrefs } from "../hooks/usePrefs.js";
import { TRANSLATIONS } from "../lib/books.js";

// Spec A3: Today, Read, Notes, Ask, Search. Preferences lives on the rail
// (desktop) and behind the gear button in the Today header (phone, tablet).
const NAV = [
  { to: "/", icon: "today", label: "Today", end: true },
  { to: "/read", icon: "read", label: "Read" },
  { to: "/notes", icon: "notes", label: "Notes" },
  { to: "/ask", icon: "ask", label: "Ask", long: "Ask AI" },
  { to: "/search", icon: "search", label: "Search" },
];

/** The frame around every main screen: 64px rail on desktop, bottom nav below it. */
export default function AppShell() {
  const [prefs] = usePrefs();
  return (
    <div className="app">
      <nav className="rail" aria-label="Sections">
        <Link className="rail-mark" to="/" aria-label="The Bible Study App: Today">B.</Link>
        <div className="rail-title" aria-hidden="true">
          {`The Bible Study App — ${prefs.translation} ${TRANSLATIONS[prefs.translation].era}`}
        </div>
        <div className="rail-nav">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} aria-label={n.long || n.label} title={n.long || n.label}><Icon name={n.icon} size={19} /></NavLink>
          ))}
          <NavLink to="/settings" aria-label="Preferences" title="Preferences"><Icon name="prefs" size={19} /></NavLink>
        </div>
      </nav>
      <div className="app-main">
        <div className="app-body"><Outlet /></div>
        <nav className="bottomnav" aria-label="Sections">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end}><Icon name={n.icon} size={20} />{n.label}</NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
}
