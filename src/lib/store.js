// Local-first data store.
//
// Every table the app owns is held in memory and mirrored to IndexedDB. A write
// is applied locally at once, added to an outbox, and sent to Supabase when the
// device is online and signed in. A pull then brings down what other devices
// changed. Tables or columns that the live database does not have yet (because
// a migration has not been run) do not break anything: those rows simply stay
// on this device, still queued, and `behind` is reported in the sync state.
import { supabase } from "./supabase.js";
import { openDB, idbGet, idbGetAll, idbPut, idbDelete, idbBatch } from "./idb.js";

// Order matters: parents are flushed before the tables that reference them.
export const TABLES = {
  preferences: { single: true, conflict: "user_id", owner: true },
  notes: {
    select: "id,title,ref,text,tags,has_audio,has_image,created_at,book,chapter,verse_start,verse_end,updated_at,drawing_path,photo_path",
    fallback: "id,title,ref,text,tags,has_audio,has_image,created_at",
    stamp: true,
  },
  recordings: {
    stamp: true,
    select: "id,note_id,label,duration,mime_type,storage_path,created_at",
    fallback: "id,note_id,label,duration,mime_type,created_at",
  },
  highlights: { natural: ["book", "chapter", "verse"], stamp: true },
  bookmarks: { natural: ["book", "chapter", "verse"], stamp: true },
  reading_progress: { key: ["book", "chapter"], conflict: "user_id,book,chapter", owner: true },
  user_plans: {},
  memory_verses: { stamp: true },
  ai_threads: { stamp: true },
  ai_messages: { stamp: true },
  sermon_sessions: {},
  sermon_pins: {},
  threads: { stamp: true },
  thread_links: {},
};
const TABLE_NAMES = Object.keys(TABLES);
const EMPTY = Object.freeze([]);

export function newId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

// ── State ─────────────────────────────────────────────────────────────────────
let db = null;
let uid = null;       // Supabase user id, or "local" for a device-only session
let remote = false;   // true when there is a signed-in session to sync with
let mem = {};         // table → Map(id → row)
let snaps = {};       // table → cached array for useSyncExternalStore
let outbox = new Map(); // "table|id" → { k, table, id, op, ts, fails, error }
let pendingBlobs = [];
const tableListeners = new Map();
const syncListeners = new Set();
const missingCols = {};          // table → Set(column) the live schema lacks
const unavailable = new Set();   // tables the live database does not have yet
const useFallback = new Set();   // tables read with their pre-migration column list
let sync = { status: "local", pending: 0, lastSyncedAt: null, error: null, behind: [] };
let syncing = false, queued = false, flushTimer = null, lastPull = 0, generation = 0;

const emit = (table) => { snaps[table] = null; tableListeners.get(table)?.forEach((fn) => fn()); };
function setSync(patch) {
  const behind = [...new Set([...unavailable, ...Object.keys(missingCols).filter((t) => missingCols[t].size)])].sort();
  sync = { ...sync, ...patch, pending: outbox.size + pendingBlobs.length, behind };
  syncListeners.forEach((fn) => fn());
}
export const getSyncState = () => sync;
export function subscribeSync(fn) { syncListeners.add(fn); return () => syncListeners.delete(fn); }
export const currentUserId = () => (remote ? uid : null);
export const storeUid = () => uid;

// ── Open / close ──────────────────────────────────────────────────────────────
export async function openStore(userId) {
  closeStore();
  const gen = ++generation;
  // Everything is read into locals first and only installed if this is still
  // the latest open call (React's development mode opens, closes and reopens).
  const handle = await openDB(`bsa-user-${userId}`, 1, (d) => {
    d.createObjectStore("rows", { keyPath: "k" });
    d.createObjectStore("outbox", { keyPath: "k" });
    d.createObjectStore("blobs");
    d.createObjectStore("kv");
  });
  const loaded = {};
  for (const t of TABLE_NAMES) loaded[t] = new Map();
  for (const rec of await idbGetAll(handle, "rows")) loaded[rec.t]?.set(rec.row.id, rec.row);
  const queue = new Map((await idbGetAll(handle, "outbox")).map((e) => [e.k, e]));
  const blobs = (await idbGet(handle, "kv", "pendingBlobs")) || [];
  const stripped = (await idbGet(handle, "kv", "stripped")) || [];
  const lastSyncedAt = (await idbGet(handle, "kv", "lastSyncedAt")) || null;
  if (gen !== generation) { try { handle?.close(); } catch { /* already closed */ } return; }

  db = handle; uid = userId; remote = false;
  mem = loaded; snaps = {}; outbox = queue; pendingBlobs = blobs;
  // Rows that were sent without some newer columns go out again in full, so
  // nothing is lost once the database has caught up.
  for (const k of stripped) {
    const [table, id] = splitKey(k);
    if (mem[table]?.has(id) && !outbox.has(k)) enqueue(table, id, "upsert");
  }
  if (stripped.length) idbPut(db, "kv", [], "stripped");
  setSync({ status: "local", error: null, lastSyncedAt });
  TABLE_NAMES.forEach(emit);
}

/**
 * Turn syncing on or off for the open store without reloading it.
 * `account` is true when a user is signed in on this device but the session
 * is not available right now (offline with an expired token).
 */
export function setRemote(flag, { account = false } = {}) {
  if (!uid) return;
  window.removeEventListener("online", onOnline);
  window.removeEventListener("offline", onOffline);
  document.removeEventListener("visibilitychange", onVisible);
  remote = !!flag;
  if (!remote) { setSync({ status: account ? "offline" : "local" }); return; }
  window.addEventListener("online", onOnline);
  window.addEventListener("offline", onOffline);
  document.addEventListener("visibilitychange", onVisible);
  setSync({ status: navigator.onLine ? "syncing" : "offline" });
  syncNow();
}

export function closeStore() {
  generation++;
  clearTimeout(flushTimer);
  window.removeEventListener("online", onOnline);
  window.removeEventListener("offline", onOffline);
  document.removeEventListener("visibilitychange", onVisible);
  try { db?.close(); } catch { /* already closed */ }
  db = null; uid = null; remote = false; mem = {}; snaps = {}; outbox = new Map(); pendingBlobs = [];
  unavailable.clear(); useFallback.clear();
  for (const t of Object.keys(missingCols)) delete missingCols[t];
  sync = { status: "local", pending: 0, lastSyncedAt: null, error: null, behind: [] };
}

const onOnline = () => syncNow();
const onOffline = () => setSync({ status: "offline" });
const onVisible = () => { if (document.visibilityState === "visible" && Date.now() - lastPull > 30000) syncNow(); };

// ── Reads ─────────────────────────────────────────────────────────────────────
export function subscribeTable(table, fn) {
  if (!tableListeners.has(table)) tableListeners.set(table, new Set());
  tableListeners.get(table).add(fn);
  return () => tableListeners.get(table)?.delete(fn);
}
export function getRows(table) {
  if (!mem[table]) return EMPTY;
  return (snaps[table] ||= [...mem[table].values()]);
}
export const getRow = (table, id) => mem[table]?.get(id) || null;

// ── Writes ────────────────────────────────────────────────────────────────────
const splitKey = (k) => { const i = k.indexOf("|"); return [k.slice(0, i), k.slice(i + 1)]; };
const localId = (table, row) => {
  const cfg = TABLES[table];
  if (cfg.single) return "me";
  if (cfg.key) return cfg.key.map((c) => row[c]).join("|");
  return row.id;
};

function enqueue(table, id, op) {
  const k = `${table}|${id}`;
  const entry = { k, table, id, op, ts: Date.now() + Math.random(), fails: 0 };
  outbox.set(k, entry);
  idbPut(db, "outbox", entry);
}

function scheduleFlush() {
  setSync({});
  if (!remote) return;
  clearTimeout(flushTimer);
  flushTimer = setTimeout(() => syncNow({ pull: false }), 500);
}

/** Insert or replace a row (an id and created_at are added when missing). */
export function put(table, row) {
  if (!mem[table]) return row;
  const cfg = TABLES[table];
  const full = { ...row };
  if (cfg.single) full.id = "me";
  else if (cfg.key) full.id = cfg.key.map((c) => full[c]).join("|");
  else full.id ||= newId();
  if (cfg.stamp && !full.created_at) full.created_at = new Date().toISOString(); // tables with a created_at column
  mem[table].set(full.id, full);
  idbPut(db, "rows", { k: `${table}|${full.id}`, t: table, row: full });
  enqueue(table, full.id, "upsert");
  emit(table);
  scheduleFlush();
  return full;
}

/** Merge changes into an existing row. */
export function patch(table, id, changes) {
  const current = mem[table]?.get(id);
  return current ? put(table, { ...current, ...changes }) : null;
}

/** Delete a row. Returns the removed row so the caller can offer an undo. */
export function remove(table, id) {
  const row = mem[table]?.get(id);
  if (!row) return null;
  mem[table].delete(id);
  idbDelete(db, "rows", `${table}|${id}`);
  enqueue(table, id, "delete");
  outbox.get(`${table}|${id}`).row = row; // keep the key columns for the server delete
  idbPut(db, "outbox", outbox.get(`${table}|${id}`));
  emit(table);
  scheduleFlush();
  return row;
}

// ── Sync ──────────────────────────────────────────────────────────────────────
const isMissingTable = (e) => e?.code === "42P01" || e?.code === "PGRST205" || /could not find the table/i.test(e?.message || "");
const isMissingColumn = (e) => e?.code === "42703" || e?.code === "PGRST204" || e?.code === "42P10"; // 42P10: the unique key an upsert needs is not there yet
const isNetwork = (e) => !e?.code && /fetch|network|load failed|timeout/i.test(e?.message || "");
const isAuth = (e) => e?.code === "42501" || e?.code === "PGRST301" || e?.status === 401 || /jwt/i.test(e?.message || "");

function toServer(table, row) {
  const cfg = TABLES[table];
  const out = {};
  for (const [key, value] of Object.entries(row)) if (!key.startsWith("_")) out[key] = value;
  if (cfg.single || cfg.key) delete out.id;
  if (cfg.owner) out.user_id = uid; else delete out.user_id;
  for (const col of missingCols[table] || []) delete out[col];
  return out;
}

async function send(entry) {
  const { table, id } = entry;
  const cfg = TABLES[table];
  if (entry.op === "delete") {
    let q = supabase.from(table).delete();
    if (cfg.single) q = q.eq("user_id", uid);
    else if (cfg.key) q = q.match(Object.fromEntries(cfg.key.map((c) => [c, entry.row?.[c]])));
    else q = q.eq("id", id);
    return (await q).error;
  }
  const row = mem[table].get(id);
  if (!row) return null;
  for (let attempt = 0; attempt < 8; attempt++) {
    const payload = toServer(table, row);
    const { error } = await supabase.from(table).upsert(payload, { onConflict: cfg.conflict || "id" });
    if (!error) return null;
    if (error.code === "PGRST204") {
      const col = /'([^']+)' column/.exec(error.message || "")?.[1];
      if (col && col in payload && col !== "id") {
        (missingCols[table] ||= new Set()).add(col);
        const stripped = (await idbGet(db, "kv", "stripped")) || [];
        if (!stripped.includes(entry.k)) await idbPut(db, "kv", [...stripped, entry.k], "stripped");
        continue;
      }
    }
    if (error.code === "23505" && cfg.natural && attempt === 0) {
      // Another device made the same highlight/bookmark first: ours replaces it.
      let dup = supabase.from(table).delete().neq("id", row.id);
      for (const c of cfg.natural) dup = row[c] == null ? dup.is(c, null) : dup.eq(c, row[c]);
      await dup;
      continue;
    }
    return error;
  }
  return { message: "The database is missing columns this app version needs." };
}

async function flush(gen) {
  const order = (e) => TABLE_NAMES.indexOf(e.table);
  // Deletes run children-first, upserts parents-first.
  const entries = [...outbox.values()].sort((a, b) =>
    a.op !== b.op ? (a.op === "upsert" ? -1 : 1) : a.op === "upsert" ? order(a) - order(b) || a.ts - b.ts : order(b) - order(a) || a.ts - b.ts);
  let lastError = null;
  for (const entry of entries) {
    if (gen !== generation) return;
    if (unavailable.has(entry.table)) continue;
    const error = await send(entry);
    if (gen !== generation) return;
    if (!error) {
      if (outbox.get(entry.k)?.ts === entry.ts) { outbox.delete(entry.k); idbDelete(db, "outbox", entry.k); }
      continue;
    }
    if (isNetwork(error) || isAuth(error)) throw error;
    if (isMissingTable(error) || isMissingColumn(error) || error.code === "23502") { unavailable.add(entry.table); continue; }
    entry.fails = (entry.fails || 0) + 1; entry.error = error.message;
    idbPut(db, "outbox", entry);
    lastError = error.message;
  }
  if (lastError) throw new Error(lastError);
}

async function pullTable(table, gen) {
  const cfg = TABLES[table];
  let all = [];
  for (let from = 0; ; from += 1000) {
    const cols = cfg.select ? (useFallback.has(table) ? cfg.fallback : cfg.select) : "*";
    let q = supabase.from(table).select(cols).range(from, from + 999);
    if (cfg.single) q = q.eq("user_id", uid);
    const { data, error } = await q;
    if (gen !== generation) return;
    if (error) {
      if (isMissingColumn(error) && cfg.fallback && !useFallback.has(table)) {
        useFallback.add(table); (missingCols[table] ||= new Set()).add("(new columns)"); from = -1000; all = []; continue;
      }
      if (isMissingTable(error) || isMissingColumn(error)) { unavailable.add(table); return; }
      throw error;
    }
    all = all.concat(data || []);
    if (!data || data.length < 1000) break;
  }
  if (!cfg.select || !useFallback.has(table)) {
    if (missingCols[table]?.delete("(new columns)") && !missingCols[table].size) delete missingCols[table];
  }
  const map = mem[table];
  const ops = [];
  const seen = new Set();
  let changed = false;
  for (const serverRow of all) {
    const id = localId(table, serverRow);
    seen.add(id);
    if (outbox.has(`${table}|${id}`)) continue; // a local change is waiting; it wins
    const merged = { ...(map.get(id) || {}), ...serverRow, id };
    map.set(id, merged); changed = true;
    ops.push(["put", { k: `${table}|${id}`, t: table, row: merged }]);
  }
  for (const id of [...map.keys()]) {
    if (seen.has(id) || outbox.has(`${table}|${id}`)) continue;
    map.delete(id); changed = true; // deleted on another device
    ops.push(["delete", `${table}|${id}`]);
  }
  await idbBatch(db, "rows", ops);
  if (changed) emit(table);
}

/** Push queued changes, then (by default) pull the latest rows. */
export async function syncNow({ pull = true } = {}) {
  if (!remote) return;
  if (syncing) { queued = true; return; }
  if (!navigator.onLine) { setSync({ status: "offline" }); return; }
  const gen = generation;
  syncing = true;
  setSync({ status: "syncing" });
  try {
    await flush(gen);
    await flushBlobs(gen);
    if (pull) {
      for (const table of TABLE_NAMES) { if (gen !== generation) return; await pullTable(table, gen); }
      lastPull = Date.now();
    }
    if (gen !== generation) return;
    const now = Date.now();
    idbPut(db, "kv", now, "lastSyncedAt");
    setSync({ status: "synced", error: null, lastSyncedAt: now });
  } catch (err) {
    if (gen !== generation) return;
    setSync({ status: isNetwork(err) ? "offline" : "error", error: isNetwork(err) ? null : err.message || String(err) });
  } finally {
    syncing = false;
    if (queued && gen === generation) { queued = false; syncNow({ pull: false }); }
  }
}

// ── Media (recordings, drawings, photos) ──────────────────────────────────────
// Blobs are written to IndexedDB first and uploaded to a private Storage bucket
// under "<user id>/…" when online.
// The "bsa-" prefix keeps these apart from other apps in the shared Supabase project.
export const BUCKETS = { recordings: "bsa-recordings", drawings: "bsa-drawings", photos: "bsa-photos" };
const blobUrls = new Map();

export function mediaPath(id, ext) { return `${uid}/${id}.${ext}`; }

export async function saveMedia(bucket, path, blob) {
  const key = `${bucket}/${path}`;
  await idbPut(db, "blobs", { blob, type: blob.type }, key);
  if (!pendingBlobs.includes(key)) { pendingBlobs = [...pendingBlobs, key]; await idbPut(db, "kv", pendingBlobs, "pendingBlobs"); }
  if (blobUrls.has(key)) { URL.revokeObjectURL(blobUrls.get(key)); blobUrls.delete(key); }
  scheduleFlush();
}

/** An object URL for a stored file: from this device if present, else downloaded. */
export async function mediaUrl(bucket, path) {
  if (!path) return null;
  const key = `${bucket}/${path}`;
  if (blobUrls.has(key)) return blobUrls.get(key);
  let blob = (await idbGet(db, "blobs", key))?.blob;
  if (!blob && remote && navigator.onLine) {
    const { data, error } = await supabase.storage.from(bucket).download(path);
    if (error) return null;
    blob = data;
    if (blob.size < 8_000_000) await idbPut(db, "blobs", { blob, type: blob.type }, key); // keep small files for offline
  }
  if (!blob) return null;
  const url = URL.createObjectURL(blob);
  blobUrls.set(key, url);
  return url;
}

export async function deleteMedia(bucket, path) {
  if (!path) return;
  const key = `${bucket}/${path}`;
  await idbDelete(db, "blobs", key);
  if (pendingBlobs.includes(key)) { pendingBlobs = pendingBlobs.filter((k) => k !== key); await idbPut(db, "kv", pendingBlobs, "pendingBlobs"); setSync({}); }
  else if (remote && navigator.onLine) await supabase.storage.from(bucket).remove([path]);
}

async function flushBlobs(gen) {
  for (const key of [...pendingBlobs]) {
    if (gen !== generation) return;
    const i = key.indexOf("/");
    const bucket = key.slice(0, i), path = key.slice(i + 1);
    const rec = await idbGet(db, "blobs", key);
    if (rec?.blob) {
      const { error } = await supabase.storage.from(bucket).upload(path, rec.blob, { upsert: true, contentType: rec.type || undefined });
      if (error) {
        if (isNetwork(error)) throw error;
        // No bucket or no policy yet: keep the file here and report it.
        (missingCols.storage ||= new Set()).add(bucket);
        continue;
      }
    }
    pendingBlobs = pendingBlobs.filter((k) => k !== key);
    await idbPut(db, "kv", pendingBlobs, "pendingBlobs");
  }
  if (missingCols.storage && !pendingBlobs.length) delete missingCols.storage;
}

// Small per-user key/value space for things that are not table rows.
export const kvGet = (key) => idbGet(db, "kv", key);
export const kvSet = (key, value) => idbPut(db, "kv", value, key);
