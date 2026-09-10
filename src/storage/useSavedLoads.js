// Single source of truth for "what are this user's saved loads," used by
// every page that reads them (Calculator, Compare, Optimal Zero) so they
// can never disagree about which backend (local vs. cloud) is active.
// Signed out: identical to the original localStorage-only behavior, byte
// for byte. Signed in: reads/writes Supabase instead, and offers a
// one-time "import your local saves" prompt the first time a device with
// existing local saves signs into an account.
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../AuthContext.jsx";
import { listSavedLoads as listLocal, saveLoad as saveLocal, deleteLoad as deleteLocal } from "./savedLoads.js";
import { listSavedLoadsCloud, saveLoadCloud, deleteLoadCloud, importLocalLoadsToCloud } from "./savedLoadsCloud.js";

// Tracks which accounts have already been offered the import on THIS
// device/browser -- keyed by user id, not just a single flag, since the
// same browser could plausibly sign into more than one account over time.
const IMPORT_OFFERED_KEY = "bullet-in-flight:importOffered";

function markImportOffered(userId) {
  try {
    const offered = JSON.parse(localStorage.getItem(IMPORT_OFFERED_KEY) || "[]");
    if (!offered.includes(userId)) localStorage.setItem(IMPORT_OFFERED_KEY, JSON.stringify([...offered, userId]));
  } catch {
    // Storage unavailable -- worst case the prompt reappears next sign-in, not a correctness issue.
  }
}

function wasImportOffered(userId) {
  try {
    return JSON.parse(localStorage.getItem(IMPORT_OFFERED_KEY) || "[]").includes(userId);
  } catch {
    return false;
  }
}

// Module-level cache of the current list, so switching tabs — which
// unmounts and remounts every consumer (Calculator / Compare / Optimal
// Zero) — doesn't re-hit the network each time for a list that only this
// session's own saves/deletes change. `key` records who the cached list
// belongs to: a user id, or "local" for the signed-out localStorage list.
// A change made on another device is picked up on a full reload (and every
// save/delete here refreshes anyway).
let cache = { key: undefined, loads: null };
const listeners = new Set();

function publish(key, loads) {
  cache = { key, loads };
  listeners.forEach((fn) => fn());
}

export function useSavedLoads() {
  const { user } = useAuth();
  const cacheKey = user ? `u:${user.id}` : "local";
  const [savedLoads, setSavedLoads] = useState(
    () => (cache.key === cacheKey && cache.loads) || []
  );
  const [saveError, setSaveError] = useState("");
  const [importCount, setImportCount] = useState(0);
  const prevKeyRef = useRef(cacheKey);

  const refresh = useCallback(async () => {
    if (!user) {
      publish(cacheKey, listLocal());
      return;
    }
    const { data, error } = await listSavedLoadsCloud();
    if (!error) publish(cacheKey, data);
  }, [user, cacheKey]);

  useEffect(() => {
    const sync = () => { if (cache.key === cacheKey) setSavedLoads(cache.loads ?? []); };
    listeners.add(sync);
    sync();
    // Fetch when the cache doesn't hold this key's list, OR whenever the key
    // changed during this mount — a sign-in/out. The cache may still hold
    // this user's list from earlier in the session, but it could be stale
    // (or briefly clobbered by a request that resolved after a sign-out).
    // A plain tab remount keeps the same key, so it still skips the fetch.
    const keyChanged = prevKeyRef.current !== cacheKey;
    prevKeyRef.current = cacheKey;
    if (cache.key !== cacheKey || cache.loads == null || keyChanged) refresh();
    return () => listeners.delete(sync);
  }, [cacheKey, refresh]);

  // Runs once per sign-in transition (user id changing), not on every
  // render -- offers the import exactly once per account+device, ever,
  // regardless of how many times this hook re-renders in between.
  useEffect(() => {
    if (!user || wasImportOffered(user.id)) { setImportCount(0); return; }
    const local = listLocal();
    setImportCount(local.length);
  }, [user]);

  const dismissImport = () => {
    if (user) markImportOffered(user.id);
    setImportCount(0);
  };

  const runImport = async () => {
    const local = listLocal();
    await importLocalLoadsToCloud(local);
    dismissImport();
    await refresh();
  };

  const save = async (name, formState) => {
    setSaveError("");
    if (!user) {
      saveLocal(name, formState);
      await refresh();
      return true;
    }
    const { error } = await saveLoadCloud(name, formState);
    if (error) { setSaveError(error.message); return false; }
    await refresh();
    return true;
  };

  const remove = async (id) => {
    if (!user) {
      deleteLocal(id);
    } else {
      await deleteLoadCloud(id);
    }
    await refresh();
  };

  return { savedLoads, saveError, save, remove, importCount, runImport, dismissImport, signedIn: Boolean(user) };
}
