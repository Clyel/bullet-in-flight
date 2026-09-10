import React, { useEffect, useMemo, useState } from "react";
import { C, label, numeric } from "./components/theme.js";
import { UnitField, StepHead, RigDriftBar } from "./components/ui.jsx";
import CommercialLoadPicker from "./components/CommercialLoadPicker.jsx";
import { getMyRig, setMyRig, rigDiffers, RIG_FIELDS } from "./storage/myRig.js";
import { standardAtmosphere } from "./ballistics/atmosphere.js";
import { energyFtLb } from "./ballistics/solver.js";
import { optimalSightIn } from "./ballistics/vitalsWindow.js";
import { useSavedLoads } from "./storage/useSavedLoads.js";
import { num } from "./solveFromForm.js";
import { useUnits } from "./UnitsContext.jsx";
import { toDisplay, unitSuffix } from "./units.js";

// The rig fields (sight height, vitals radius, atmosphere) are the shared
// "My rig" -- see storage/myRig.js, which is also where the "deliberately
// smaller than Calculator's full input set" reasoning lives now. This tab
// applies one rig to every row it compares.

// Both a catalog round and a saved dataset get normalized to this same
// ammo-only shape before anything downstream touches them — this page
// applies ONE shared rig to every row, so a saved dataset's own sight
// height/zero/conditions from whenever it was saved are deliberately left
// behind. Using them instead would make some rows reflect "my current rig"
// and others reflect "whatever I had dialed in weeks ago," which would
// quietly break the whole point of a side-by-side comparison.
const fromCatalog = (ammo) => ({
  key: `catalog:${ammo.id}`,
  label: ammo.cartridge,
  sublabel: `${ammo.grains}gr ${ammo.bullet} — ${ammo.manufacturer}`,
  muzzleVelocity: ammo.muzzleVelocity,
  ballisticCoefficient: ammo.ballisticCoefficient,
  dragModel: ammo.dragModel,
  grains: ammo.grains,
});

const fromSaved = (load) => ({
  key: `saved:${load.id}`,
  label: load.name,
  sublabel: "Saved dataset",
  muzzleVelocity: num(load.muzzleVelocity),
  ballisticCoefficient: num(load.ballisticCoefficient),
  dragModel: load.dragModel,
  grains: num(load.grains),
});

export default function OptimalZero() {
  const { system } = useUnits();
  const [storedRig, setStoredRig] = useState(getMyRig);
  const [rig, setRig] = useState(() => ({ ...storedRig }));
  // Only show the drift bar once the user deliberately edits a rig field --
  // symmetric with Calculator, where the same flag also guards against a
  // dataset load raising it. Nothing else here touches the rig, so in
  // practice this tracks "has the user edited it".
  const [rigTouched, setRigTouched] = useState(false);
  const set = Object.fromEntries(
    RIG_FIELDS.map((k) => [k, (val) => { setRigTouched(true); setRig((s) => ({ ...s, [k]: val })); }])
  );

  const rigDrifted = rigTouched && rigDiffers(rig, storedRig);
  const handleSaveRig = () => {
    const next = Object.fromEntries(RIG_FIELDS.map((k) => [k, rig[k]]));
    setMyRig(next);
    setStoredRig(next);
    setRigTouched(false);
  };
  const handleResetRig = () => {
    setRig({ ...storedRig });
    setRigTouched(false);
  };
  // useSavedLoads re-fetches on mount, which is when a load saved on the
  // Calculator tab (or synced from the cloud) should show up here (same
  // pattern as Compare.jsx).
  const { savedLoads } = useSavedLoads();
  const [selected, setSelected] = useState([]); // normalized entries, in pick order

  const addEntry = (entry) => {
    setSelected((s) => (s.some((e) => e.key === entry.key) ? s : [...s, entry]));
  };
  const removeEntry = (key) => setSelected((s) => s.filter((e) => e.key !== key));
  const toggleSaved = (load) => {
    const key = `saved:${load.id}`;
    setSelected((s) => (s.some((e) => e.key === key) ? s.filter((e) => e.key !== key) : [...s, fromSaved(load)]));
  };

  const fillStandard = () => {
    const alt = parseFloat(rig.altitudeFt);
    if (!Number.isFinite(alt)) return;
    const { tempF, pressInHg } = standardAtmosphere(alt);
    set.tempF(tempF.toFixed(0));
    set.pressInHg(pressInHg.toFixed(2));
  };

  // Every rig field feeds every selected row's optimalSightIn call (~130-
  // 150ms each), run fully synchronously. With several rows selected, that
  // adds up to a multi-second freeze — and without debouncing, it reruns on
  // EVERY keystroke while typing, not just once you're done. Debounced here
  // instead: the input itself stays driven by `rig` (so typing feels
  // instant), but the expensive table recompute waits until 400ms after you
  // stop.
  const [debouncedRig, setDebouncedRig] = useState(rig);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedRig(rig), 400);
    return () => clearTimeout(t);
  }, [rig]);

  const dist = (yd) => toDisplay(yd, "distance", system);
  const dSuf = unitSuffix("distance", system);
  const vel = (fps) => toDisplay(fps, "velocity", system);
  const vSuf = unitSuffix("velocity", system);
  const len = (inches) => toDisplay(inches, "length", system);
  const lSuf = unitSuffix("length", system);
  const energy = (ftLb) => toDisplay(ftLb, "energy", system);
  const eSuf = unitSuffix("energy", system);

  // One optimalSightIn call per row (~130-150ms each) — fine for the
  // "a dozen or so rounds" scale this is meant for. Recomputes the whole
  // table when the (debounced) shared rig changes, or when the selection
  // itself changes — adding/removing a round is already a discrete click,
  // not a rapid keystroke stream, so that path stays undebounced.
  const rows = useMemo(() => {
    const sightHeight = num(debouncedRig.sightHeight);
    const vitalsRadiusIn = num(debouncedRig.vitalsRadiusIn);
    const tempF = num(debouncedRig.tempF);
    const pressInHg = num(debouncedRig.pressInHg);
    const rigOk = Number.isFinite(sightHeight) && sightHeight >= 0 &&
      Number.isFinite(vitalsRadiusIn) && vitalsRadiusIn > 0 &&
      Number.isFinite(tempF) && Number.isFinite(pressInHg);

    return selected.map((entry) => {
      if (!rigOk) return { entry, error: "Fill in your rig above." };
      if (!Number.isFinite(entry.muzzleVelocity) || !Number.isFinite(entry.ballisticCoefficient)) {
        return { entry, error: "This dataset is missing muzzle velocity or BC." };
      }
      const base = {
        muzzleVelocity: entry.muzzleVelocity, ballisticCoefficient: entry.ballisticCoefficient,
        dragModel: entry.dragModel, sightHeight, tempF, pressInHg,
        windSpeedMph: undefined, windClock: undefined,
      };
      try {
        return { entry, result: optimalSightIn(base, vitalsRadiusIn) };
      } catch (e) {
        return { entry, error: e.message };
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, JSON.stringify(debouncedRig)]);

  const selectedSavedKeys = new Set(selected.filter((e) => e.key.startsWith("saved:")).map((e) => e.key));

  return (
    <div className="bif-grid">
      <div style={{ background: C.card, border: `1.5px solid ${C.rule}`, padding: 16 }}>
        <RigDriftBar drifted={rigDrifted} onSave={handleSaveRig} onReset={handleResetRig} />
        <StepHead n={1} name="Add rounds" first />

        {savedLoads.length > 0 && (
          <>
            <span style={{ ...label, display: "block", marginBottom: 5 }}>Your saved datasets</span>
            <div style={{ marginBottom: 20 }}>
              {savedLoads.map((l) => (
                <label key={l.id} style={{ display: "flex", alignItems: "center", gap: 8,
                                            marginBottom: 8, cursor: "pointer" }}>
                  <input type="checkbox" checked={selectedSavedKeys.has(`saved:${l.id}`)}
                         onChange={() => toggleSaved(l)} />
                  <span style={{ font: "500 13px 'IBM Plex Sans',sans-serif", color: C.ink }}>{l.name}</span>
                </label>
              ))}
            </div>
          </>
        )}

        <span style={{ ...label, display: "block", marginBottom: 5 }}>Add a round from the catalog</span>
        <CommercialLoadPicker onSelect={(ammo) => addEntry(fromCatalog(ammo))} resetLoadAfterSelect />

        <StepHead n={2} name="Your rig" />
        <UnitField
          label="Sight height over bore"
          hint="Bore centerline to sight centerline. Typical scope 1.5–2.0 in; irons about 0.8 in."
          category="length" value={rig.sightHeight} onChange={set.sightHeight}
        />
        <UnitField
          label="Vitals radius"
          hint="Half-width of the vital zone — smaller for varmints, larger for elk or moose."
          category="length" value={rig.vitalsRadiusIn} onChange={set.vitalsRadiusIn}
        />
        <UnitField label="Temperature" category="temperature" value={rig.tempF} onChange={set.tempF} />
        <UnitField
          label="Station pressure"
          hint="Absolute pressure where you are standing, not sea-level corrected."
          category="pressure" value={rig.pressInHg} onChange={set.pressInHg}
        />
        <UnitField
          label="Altitude"
          hint="Only fills the two fields above. It is not applied on top of them."
          category="altitude" value={rig.altitudeFt} onChange={set.altitudeFt}
        />
        <button
          onClick={fillStandard}
          style={{ width: "100%", padding: 9, background: C.ink, color: C.card,
                   border: "none", cursor: "pointer",
                   font: "600 11px 'Oswald',sans-serif", letterSpacing: ".12em" }}
        >
          Fill from standard atmosphere
        </button>
      </div>

      <div>
        {selected.length === 0 ? (
          <Notice tone={C.brass} title="Nothing to compare yet">
            Check off a saved dataset or add a round from the catalog — they'll all use the same rig on the left.
          </Notice>
        ) : (
          <div style={{ background: C.card, border: `1.5px solid ${C.rule}`, overflowX: "auto" }}>
            <table>
              <thead>
                <tr style={{ background: C.ink }}>
                  {["Round", "Muzzle Velocity", "Muzzle Energy", "Near Zero", "Optimal Zero", "Height @ 100",
                    "Vitals Window", ""].map((head, i, arr) => (
                    <th key={head || i} scope="col"
                        style={{ padding: "9px 12px", textAlign: i === 0 ? "left" : i === arr.length - 1 ? "center" : "right",
                                 font: "600 10px 'Oswald',sans-serif", letterSpacing: ".12em",
                                 textTransform: "uppercase", color: C.card, whiteSpace: "nowrap" }}>
                      {head}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(({ entry, result, error }, i) => (
                  <tr key={entry.key} style={{ background: i % 2 ? C.cardAlt : C.card }}>
                    <td style={{ ...numeric, padding: "7px 12px", fontWeight: 600 }}>
                      {entry.label}
                      <div style={{ font: "400 10.5px 'IBM Plex Sans',sans-serif", color: C.muted, marginTop: 2 }}>
                        {entry.sublabel}
                      </div>
                    </td>
                    <td style={{ ...numeric, padding: "7px 12px", textAlign: "right" }}>
                      {Number.isFinite(entry.muzzleVelocity) ? `${Math.round(vel(entry.muzzleVelocity))} ${vSuf}` : "—"}
                    </td>
                    <td style={{ ...numeric, padding: "7px 12px", textAlign: "right" }}>
                      {Number.isFinite(entry.muzzleVelocity) && Number.isFinite(entry.grains)
                        ? `${Math.round(energy(energyFtLb(entry.grains, entry.muzzleVelocity))).toLocaleString("en-US")} ${eSuf}`
                        : "—"}
                    </td>
                    {error ? (
                      <td colSpan={4} style={{ ...numeric, padding: "7px 12px", textAlign: "right", color: C.ox }}>
                        {error}
                      </td>
                    ) : (
                      <>
                        <td style={{ ...numeric, padding: "7px 12px", textAlign: "right" }}>
                          {result.nearZeroYd != null ? `${dist(result.nearZeroYd).toFixed(0)} ${dSuf}` : "—"}
                        </td>
                        <td style={{ ...numeric, padding: "7px 12px", textAlign: "right" }}>
                          {dist(result.zeroRangeYd).toFixed(0)} {dSuf}
                        </td>
                        <td style={{ ...numeric, padding: "7px 12px", textAlign: "right" }}>
                          {result.heightAt100Yd != null ? `${len(result.heightAt100Yd).toFixed(1)} ${lSuf}` : "—"}
                        </td>
                        <td style={{ ...numeric, padding: "7px 12px", textAlign: "right" }}>
                          {dist(result.spanYd).toFixed(0)} {dSuf}
                          <div style={{ font: "400 10.5px 'IBM Plex Sans',sans-serif", color: C.muted, marginTop: 2 }}>
                            {dist(result.entryYd).toFixed(0)}&ndash;{dist(result.exitYd).toFixed(0)} {dSuf}
                          </div>
                        </td>
                      </>
                    )}
                    <td style={{ padding: "7px 8px", textAlign: "center" }}>
                      <button
                        onClick={() => removeEntry(entry.key)}
                        aria-label={`Remove ${entry.label}`}
                        style={{ background: "none", border: "none", cursor: "pointer", color: C.ox,
                                 font: "600 14px 'IBM Plex Mono',monospace", padding: "0 4px" }}
                      >
                        &times;
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Notice({ tone, title, children }) {
  return (
    <div style={{ background: C.card, border: `1.5px solid ${tone}`, borderLeft: `5px solid ${tone}`,
                  padding: 14, marginBottom: 16 }}>
      <div style={{ font: "600 12px 'Oswald',sans-serif", letterSpacing: ".1em",
                    textTransform: "uppercase", color: tone }}>
        {title}
      </div>
      <div style={{ marginTop: 5, font: "400 12.5px 'IBM Plex Sans',sans-serif", color: C.ink }}>
        {children}
      </div>
    </div>
  );
}
