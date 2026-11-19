import Icon from "./Icon.jsx";
import { useSync } from "../hooks/useData.js";
import { useBibleStatus } from "../hooks/useBible.js";
import { syncNow } from "../lib/store.js";
import { timeAgo } from "../lib/format.js";

/** One line saying whether the Bible is on the device and whether changes are synced. */
export default function SyncStatus({ compact = false }) {
  const sync = useSync();
  const bible = useBibleStatus();

  const bibleText = bible === "ready" ? "Whole Bible saved on this device"
    : bible === "error" ? "Bible text not downloaded yet" : "Saving the Bible to this device…";
  const n = sync.pending;
  const waiting = `${n} change${n === 1 ? "" : "s"} waiting`;
  let syncText, icon = "checkCircle", warn = false;
  if (sync.status === "local") { syncText = "kept on this device only"; icon = "cloudOff"; }
  else if (sync.status === "offline") { syncText = n ? `offline · ${waiting}` : "offline"; icon = "cloudOff"; }
  else if (sync.status === "syncing") { syncText = "syncing…"; icon = "sync"; }
  else if (sync.status === "error") { syncText = "sync problem · tap to retry"; icon = "alert"; warn = true; }
  else if (n) { syncText = `${waiting} for a database update`; icon = "alert"; warn = true; }
  else syncText = `synced ${timeAgo(sync.lastSyncedAt)}`;
  if (bible === "error") { icon = "alert"; warn = true; }

  const content = (<><Icon name={icon} size={16} /><span>{compact ? syncText : `${bibleText} · ${syncText}`}</span></>);
  if (sync.status === "error" || sync.status === "offline") {
    return (
      <button type="button" className={`sync${warn ? " warn" : ""}`} style={{ background: "none", border: "none", padding: 0, minHeight: 44 }}
        onClick={() => syncNow()} title={sync.error || "Try to sync now"}>{content}</button>
    );
  }
  return <div className={`sync${warn ? " warn" : ""}`} role="status" title={sync.error || undefined}>{content}</div>;
}
