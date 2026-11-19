import { useCallback, useSyncExternalStore } from "react";
import { getRows, subscribeTable, getSyncState, subscribeSync } from "../lib/store.js";

/** Live rows of a local-first table (see lib/store.js). The array is stable until a row changes. */
export function useTable(table) {
  const subscribe = useCallback((fn) => subscribeTable(table, fn), [table]);
  const snapshot = useCallback(() => getRows(table), [table]);
  return useSyncExternalStore(subscribe, snapshot);
}

/** { status, pending, lastSyncedAt, error, behind } */
export function useSync() {
  return useSyncExternalStore(subscribeSync, getSyncState);
}
