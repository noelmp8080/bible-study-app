// A very small promise wrapper over IndexedDB. Every call degrades to a
// harmless no-op when IndexedDB is unavailable (private windows, old webviews),
// so the app still runs — it just does not keep anything offline.

export function openDB(name, version, upgrade) {
  return new Promise((resolve) => {
    if (typeof indexedDB === "undefined") return resolve(null);
    let req;
    try { req = indexedDB.open(name, version); } catch { return resolve(null); }
    req.onupgradeneeded = () => upgrade(req.result, req.transaction);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
    req.onblocked = () => resolve(null);
  });
}

const done = (request) =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

export async function idbGet(db, store, key) {
  if (!db) return undefined;
  try { return await done(db.transaction(store).objectStore(store).get(key)); } catch { return undefined; }
}

export async function idbGetAll(db, store) {
  if (!db) return [];
  try { return await done(db.transaction(store).objectStore(store).getAll()); } catch { return []; }
}

export async function idbPut(db, store, value, key) {
  if (!db) return;
  try {
    const os = db.transaction(store, "readwrite").objectStore(store);
    await done(key === undefined ? os.put(value) : os.put(value, key));
  } catch { /* quota or closed database: keep running from memory */ }
}

export async function idbDelete(db, store, key) {
  if (!db) return;
  try { await done(db.transaction(store, "readwrite").objectStore(store).delete(key)); } catch { /* ignore */ }
}

/** Run several writes in one transaction: ops = [["put", value] | ["delete", key]]. */
export function idbBatch(db, store, ops) {
  return new Promise((resolve) => {
    if (!db || !ops.length) return resolve();
    try {
      const tx = db.transaction(store, "readwrite");
      const os = tx.objectStore(store);
      for (const [op, arg] of ops) { if (op === "put") os.put(arg); else os.delete(arg); }
      tx.oncomplete = () => resolve();
      tx.onerror = tx.onabort = () => resolve();
    } catch { resolve(); }
  });
}
