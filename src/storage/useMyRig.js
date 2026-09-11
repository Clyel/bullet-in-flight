// Single source of truth for the shared "My rig" (sight height, vitals
// radius, the three atmosphere fields), used by Calculator, Optimal Zero
// and Compare so they can't disagree about which backend is active.
// Signed out: identical to the old localStorage-only myRig.js behavior.
// Signed in: reads/writes the `user_settings` rig columns in Supabase, and
// the first time a device signs into an account whose cloud rig is empty,
// seeds it from that device's local rig (silently -- it's one small object,
// not a list, so there's no "import?" prompt like saved loads has).
//
// Same cache + listener design as useSavedLoads.js: switching tabs unmounts
// and remounts every consumer, and this keeps that from re-hitting the
// network for a value only this session's own saves change.
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../AuthContext.jsx";
import { getMyRig, setMyRig } from "./myRig.js";
import { getMyRigCloud, setMyRigCloud } from "./myRigCloud.js";

let cache = { key: undefined, rig: null };
const listeners = new Set();

function publish(key, rig) {
  cache = { key, rig };
  listeners.forEach((fn) => fn());
}

export function useMyRig() {
  const { user } = useAuth();
  const cacheKey = user ? `u:${user.id}` : "local";
  const [rig, setRig] = useState(
    () => (cache.key === cacheKey && cache.rig) || getMyRig()
  );
  const prevKeyRef = useRef(cacheKey);

  const refresh = useCallback(async () => {
    if (!user) {
      publish(cacheKey, getMyRig());
      return;
    }
    const { data, error } = await getMyRigCloud();
    if (error) return; // keep whatever's already published (local)
    if (data) {
      // Mirror the cloud rig locally too, so a later signed-out session on
      // this device starts from the synced value, not a stale one.
      setMyRig(data);
      publish(cacheKey, data);
    } else {
      // No cloud rig yet -> seed it from this device's local rig.
      const local = getMyRig();
      const { error: seedError } = await setMyRigCloud(user.id, local);
      if (seedError) console.warn("My rig: couldn't seed the cloud copy.", seedError.message);
      publish(cacheKey, local);
    }
  }, [user, cacheKey]);

  useEffect(() => {
    const sync = () => { if (cache.key === cacheKey) setRig(cache.rig ?? getMyRig()); };
    listeners.add(sync);
    sync();
    const keyChanged = prevKeyRef.current !== cacheKey;
    prevKeyRef.current = cacheKey;
    if (cache.key !== cacheKey || cache.rig == null || keyChanged) refresh();
    return () => listeners.delete(sync);
  }, [cacheKey, refresh]);

  // Always keep the local copy current -- it's the instant, offline-safe
  // source and what a signed-out session reads. The cloud write is
  // fire-and-forget: the local write already made the change durable on
  // this device, and a failed cloud write self-heals on the next save or
  // the next sign-in seed. A rig column can't fail validation (all
  // nullable text), so this only warns on a network/auth failure.
  const saveRig = useCallback((next) => {
    setMyRig(next);
    publish(cacheKey, next);
    if (user) {
      setMyRigCloud(user.id, next)
        .then(({ error }) => { if (error) console.warn("My rig: cloud save failed, kept locally.", error.message); })
        .catch((e) => console.warn("My rig: cloud save threw, kept locally.", e));
    }
  }, [user, cacheKey]);

  return { rig, saveRig, signedIn: Boolean(user) };
}
