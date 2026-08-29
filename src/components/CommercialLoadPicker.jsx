import React, { useMemo, useState } from "react";
import { C, label } from "./theme.js";
import { COMMERCIAL_AMMO } from "../data/commercialAmmo.js";

/**
 * Caliber -> Manufacturer -> Load: each choice narrows the next select's
 * options, so picking one of 855 loads never means scanning a single huge
 * list. Auto-advances past a step when it only has one option, all the way
 * through to auto-applying the load itself if a caliber+manufacturer combo
 * has just one.
 *
 * onSelect(ammo) fires with the FULL catalog entry (not just its id) once a
 * load is resolved, whether by explicit pick or auto-apply.
 *
 * resetLoadAfterSelect: if true, the Load select snaps back to blank right
 * after firing onSelect (Caliber/Manufacturer stay put) — for a picker used
 * to build up a list of several loads one at a time. If false (default),
 * the selection and its "Filled in: ..." confirmation stay visible — for a
 * picker that's filling a single form's fields.
 */
export default function CommercialLoadPicker({ onSelect, resetLoadAfterSelect = false }) {
  const [caliber, setCaliber] = useState("");
  const [manufacturer, setManufacturer] = useState("");
  const [loadId, setLoadId] = useState("");

  const calibers = useMemo(
    () => [...new Set(COMMERCIAL_AMMO.map((a) => a.cartridge))].sort((a, b) => a.localeCompare(b)),
    []
  );

  const manufacturersForCaliber = useMemo(() => {
    if (!caliber) return [];
    const set = new Set(COMMERCIAL_AMMO.filter((a) => a.cartridge === caliber).map((a) => a.manufacturer));
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [caliber]);

  const loadsForSelection = useMemo(() => {
    if (!caliber || !manufacturer) return [];
    return COMMERCIAL_AMMO.filter((a) => a.cartridge === caliber && a.manufacturer === manufacturer)
      .sort((a, b) => a.grains - b.grains || a.bullet.localeCompare(b.bullet));
  }, [caliber, manufacturer]);

  const applyLoad = (ammo) => {
    setLoadId(resetLoadAfterSelect ? "" : ammo.id);
    onSelect(ammo);
  };

  const handleCaliberChange = (nextCaliber) => {
    setCaliber(nextCaliber);
    setLoadId("");
    if (!nextCaliber) { setManufacturer(""); return; }
    const mfrs = [...new Set(COMMERCIAL_AMMO.filter((a) => a.cartridge === nextCaliber).map((a) => a.manufacturer))];
    setManufacturer(mfrs.length === 1 ? mfrs[0] : "");
  };

  const handleManufacturerChange = (nextManufacturer) => {
    setManufacturer(nextManufacturer);
    if (!nextManufacturer) { setLoadId(""); return; }
    const loads = COMMERCIAL_AMMO.filter((a) => a.cartridge === caliber && a.manufacturer === nextManufacturer);
    if (loads.length === 1) applyLoad(loads[0]);
    else setLoadId("");
  };

  const handleLoadChange = (nextLoadId) => {
    if (!nextLoadId) { setLoadId(""); return; }
    const ammo = loadsForSelection.find((a) => a.id === nextLoadId);
    if (ammo) applyLoad(ammo);
  };

  const selectedLoad = loadId ? loadsForSelection.find((a) => a.id === loadId) : null;

  return (
    <>
      <select
        value={caliber}
        onChange={(e) => handleCaliberChange(e.target.value)}
        style={{ width: "100%", padding: "7px 8px", marginBottom: 5,
                 border: `1.5px solid ${C.rule}`, background: C.card, color: C.ink,
                 font: "500 13px 'IBM Plex Mono',monospace" }}
      >
        <option value="">Caliber…</option>
        {calibers.map((c) => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>

      <select
        value={manufacturer}
        onChange={(e) => handleManufacturerChange(e.target.value)}
        disabled={!caliber}
        style={{ width: "100%", padding: "7px 8px", marginBottom: 5,
                 border: `1.5px solid ${C.rule}`, background: caliber ? C.card : C.rule, color: C.ink,
                 font: "500 13px 'IBM Plex Mono',monospace" }}
      >
        <option value="">Manufacturer…</option>
        {manufacturersForCaliber.map((m) => (
          <option key={m} value={m}>{m}</option>
        ))}
      </select>

      <select
        value={loadId}
        onChange={(e) => handleLoadChange(e.target.value)}
        disabled={!manufacturer}
        style={{ width: "100%", padding: "7px 8px", marginBottom: 5,
                 border: `1.5px solid ${C.rule}`, background: manufacturer ? C.card : C.rule, color: C.ink,
                 font: "500 13px 'IBM Plex Mono',monospace" }}
      >
        <option value="">Load…</option>
        {loadsForSelection.map((a) => (
          <option key={a.id} value={a.id}>
            {a.grains}gr {a.bullet}{a.bcSource !== "published" ? " (derived BC)" : ""}
          </option>
        ))}
      </select>

      {selectedLoad ? (
        <div style={{ marginBottom: 16, padding: "7px 9px", background: C.field, border: `1px solid ${C.rule}`,
                      font: "500 11px/1.4 'IBM Plex Mono',monospace", color: C.ink }}>
          Filled in: {selectedLoad.muzzleVelocity} fps · {selectedLoad.grains}gr · {selectedLoad.dragModel}{" "}
          {selectedLoad.ballisticCoefficient}
          {selectedLoad.bcSource !== "published" ? " (derived BC)" : ""}
        </div>
      ) : caliber && manufacturer ? (
        <div style={{ marginBottom: 16, padding: "7px 9px", background: C.field, border: `1px solid ${C.brass}`,
                      font: "600 11px/1.4 'IBM Plex Sans',sans-serif", color: C.brass }}>
          Pick a load above — the fields below haven't changed yet.
        </div>
      ) : (
        <div style={{ marginBottom: 16, font: "400 10.5px/1.4 'IBM Plex Sans',sans-serif", color: C.muted }}>
          G1 only — every manufacturer here publishes G1 in bulk, not G7. "Derived BC" means the manufacturer
          doesn't publish a BC at all — it's back-solved from their own published velocity table using this app's
          own physics (see the catalog source in code comments).
        </div>
      )}
    </>
  );
}
