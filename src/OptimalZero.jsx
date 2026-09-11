import React, { useEffect, useState } from "react";
import { C, label, numeric } from "./components/theme.js";
import { UnitField, StepHead, RigDriftBar, Notice } from "./components/ui.jsx";
import CommercialLoadPicker from "./components/CommercialLoadPicker.jsx";
import { rigDiffers, RIG_FIELDS } from "./storage/myRig.js";
import { useMyRig } from "./storage/useMyRig.js";
import { standardAtmosphere } from "./ballistics/atmosphere.js";
import { energyFtLb } from "./ballistics/solver.js";
import { useOptimalZeroRows } from "./useOptimalZeroRows.js";
import { useSavedLoads } from "./storage/useSavedLoads.js";
import { num } from "./solveFromForm.js";
import { useUnitFormatters } from "./useUnitFormatters.js";

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
  // "My rig" -- synchronous local value on first paint, then kept in step
  // with the cloud copy when signed in (see useMyRig.js).
  const { rig: storedRig, saveRig } = useMyRig();
  const [rig, setRig] = useState(() => ({ ...storedRig }));
  // Only show the drift bar once the user deliberately edits a rig field --
  // symmetric with Calculator, where the same flag also guards against a
  // dataset load raising it. Nothing else here touches the rig, so in
  // practice this tracks "has the user edited it".
  const [rigTouched, setRigTouched] = useState(false);
  const set = Object.fromEntries(
    RIG_FIELDS.map((k) => [k, (val) => { setRigTouched(true); setRig((s) => ({ ...s, [k]: val })); }])
  );

  // Adopt the stored rig if it arrives/changes from the cloud (or another
  // tab) while the user hasn't edited a field -- same guard and equality
  // check as Calculator's.
  useEffect(() => {
    if (rigTouched) return;
    setRig((s) => (RIG_FIELDS.every((k) => s[k] === storedRig[k]) ? s : { ...s, ...storedRig }));
  }, [storedRig, rigTouched]);

  const rigDrifted = rigTouched && rigDiffers(rig, storedRig);
  const handleSaveRig = () => {
    saveRig(Object.fromEntries(RIG_FIELDS.map((k) => [k, rig[k]])));
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

  // Every rig field feeds every selected row's optimalSightIn search
  // (~50ms each). useOptimalZeroRows runs those in a Web Worker — debounced,
  // off the main thread, results streaming back per row — so the table
  // stays responsive no matter how many rounds are selected. Rows come back
  // as { entry, result } | { entry, error } | { entry, pending }.
  const rows = useOptimalZeroRows(selected, rig);

  const { dist, vel, len, energy, dSuf, vSuf, lSuf, eSuf } = useUnitFormatters();

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
                {rows.map(({ entry, result, error, pending }, i) => (
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
                    ) : pending ? (
                      <td colSpan={4} style={{ ...numeric, padding: "7px 12px", textAlign: "right", color: C.muted }}>
                        Solving&hellip;
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

