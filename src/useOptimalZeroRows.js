// Bridges the Optimal Zero table to its Web Worker (see
// ballistics/optimalZero.worker.js). Owns the debounce, the rig parse/
// validation, job dispatch, and stale-result filtering, so OptimalZero.jsx
// just renders whatever rows come back — each is
// { entry, result } | { entry, error } | { entry, pending: true }.
import { useEffect, useMemo, useRef, useState } from "react";
import { num } from "./solveFromForm.js";

const DEBOUNCE_MS = 400;

/**
 * @param selected  normalized entries: { key, muzzleVelocity, ballisticCoefficient, dragModel, ... }
 * @param rig       raw rig form state: { sightHeight, vitalsRadiusIn, tempF, pressInHg, ... } (strings)
 */
export function useOptimalZeroRows(selected, rig) {
  const workerRef = useRef(null);
  const genRef = useRef(0);
  const [byKey, setByKey] = useState({}); // entry.key -> { result } | { error }

  // One worker for the life of the component.
  useEffect(() => {
    const worker = new Worker(
      new URL("./ballistics/optimalZero.worker.js", import.meta.url),
      { type: "module" }
    );
    worker.onmessage = (e) => {
      const { gen, key, result, error } = e.data;
      if (gen !== genRef.current) return; // superseded by a newer rig/selection
      setByKey((m) => ({ ...m, [key]: error ? { error } : { result } }));
    };
    workerRef.current = worker;
    return () => worker.terminate();
  }, []);

  // Debounce the rig — the inputs stay driven by `rig` so typing is instant,
  // but a keystroke stream shouldn't fire a worker batch per character.
  const [debouncedRig, setDebouncedRig] = useState(rig);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedRig(rig), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [rig]);

  const parsed = useMemo(() => {
    const sightHeight = num(debouncedRig.sightHeight);
    const vitalsRadiusIn = num(debouncedRig.vitalsRadiusIn);
    const tempF = num(debouncedRig.tempF);
    const pressInHg = num(debouncedRig.pressInHg);
    const ok =
      Number.isFinite(sightHeight) && sightHeight >= 0 &&
      Number.isFinite(vitalsRadiusIn) && vitalsRadiusIn > 0 &&
      Number.isFinite(tempF) && Number.isFinite(pressInHg);
    return { sightHeight, vitalsRadiusIn, tempF, pressInHg, ok };
  }, [debouncedRig.sightHeight, debouncedRig.vitalsRadiusIn, debouncedRig.tempF, debouncedRig.pressInHg]);

  const entryHasAmmo = (e) =>
    Number.isFinite(e.muzzleVelocity) && Number.isFinite(e.ballisticCoefficient);

  // Dispatch a fresh batch on any change to the selection or the parsed
  // rig. Full redispatch (not per-key diffing) is fine — it's all off the
  // main thread now, and the worker posts each row back as it lands.
  useEffect(() => {
    const worker = workerRef.current;
    if (!worker) return;
    const gen = ++genRef.current;
    setByKey({}); // rows go pending until their result returns
    if (!parsed.ok) return;
    for (const entry of selected) {
      if (!entryHasAmmo(entry)) continue;
      worker.postMessage({
        gen,
        key: entry.key,
        base: {
          muzzleVelocity: entry.muzzleVelocity,
          ballisticCoefficient: entry.ballisticCoefficient,
          dragModel: entry.dragModel,
          sightHeight: parsed.sightHeight,
          tempF: parsed.tempF,
          pressInHg: parsed.pressInHg,
          windSpeedMph: undefined,
          windClock: undefined,
        },
        vitalsRadiusIn: parsed.vitalsRadiusIn,
      });
    }
  }, [selected, parsed]);

  return selected.map((entry) => {
    if (!parsed.ok) return { entry, error: "Fill in your rig above." };
    if (!entryHasAmmo(entry)) return { entry, error: "This dataset is missing muzzle velocity or BC." };
    const r = byKey[entry.key];
    return r ? { entry, ...r } : { entry, pending: true };
  });
}
