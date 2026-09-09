// Single source of truth for Recoil's setup list — mirrors useSavedLoads.js
// exactly (same local/cloud switch, same one-time import-offer pattern),
// just pointed at recoil_setups instead of saved_loads. Kept as a separate
// hook rather than a generic parameterized one: the two domains' add
// semantics genuinely differ (saved loads overwrite by name, recoil setups
// are insert-only), so sharing one hook would mean threading that
// difference through as a flag rather than just having two small, honest
// hooks that each say what they do.
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../AuthContext.jsx";
import { listRecoilSetups as listLocal, addRecoilSetup as addLocal, deleteRecoilSetup as deleteLocal } from "./recoilSetups.js";
import { listRecoilSetupsCloud, addRecoilSetupCloud, deleteRecoilSetupCloud, importLocalRecoilSetupsToCloud } from "./recoilSetupsCloud.js";

const IMPORT_OFFERED_KEY = "bullet-in-flight:recoilImportOffered";

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

export function useRecoilSetups() {
  const { user } = useAuth();
  const [setups, setSetups] = useState([]);
  const [addError, setAddError] = useState("");
  const [importCount, setImportCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!user) {
      setSetups(listLocal());
      return;
    }
    const { data, error } = await listRecoilSetupsCloud();
    if (!error) setSetups(data);
  }, [user]);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    if (!user || wasImportOffered(user.id)) { setImportCount(0); return; }
    setImportCount(listLocal().length);
  }, [user]);

  const dismissImport = () => {
    if (user) markImportOffered(user.id);
    setImportCount(0);
  };

  const runImport = async () => {
    await importLocalRecoilSetupsToCloud(listLocal());
    dismissImport();
    await refresh();
  };

  const add = async (setup) => {
    setAddError("");
    if (!user) {
      addLocal(setup);
      await refresh();
      return true;
    }
    const { error } = await addRecoilSetupCloud(setup);
    if (error) { setAddError(error.message); return false; }
    await refresh();
    return true;
  };

  const remove = async (id) => {
    if (!user) {
      deleteLocal(id);
    } else {
      await deleteRecoilSetupCloud(id);
    }
    await refresh();
  };

  return { setups, addError, add, remove, importCount, runImport, dismissImport, signedIn: Boolean(user) };
}
