// Single source of truth for "what are this user's saved loads," used by
// every page that reads them (Calculator, Compare, Optimal Zero) so they
// can never disagree about which backend (local vs. cloud) is active.
// Signed out: identical to the original localStorage-only behavior, byte
// for byte. Signed in: reads/writes Supabase instead, and offers a
// one-time "import your local saves" prompt the first time a device with
// existing local saves signs into an account.
import { useCallback, useEffect, useState } from "react";
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

export function useSavedLoads() {
  const { user } = useAuth();
  const [savedLoads, setSavedLoads] = useState([]);
  const [saveError, setSaveError] = useState("");
  const [importCount, setImportCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!user) {
      setSavedLoads(listLocal());
      return;
    }
    const { data, error } = await listSavedLoadsCloud();
    if (!error) setSavedLoads(data);
  }, [user]);

  useEffect(() => { refresh(); }, [refresh]);

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
