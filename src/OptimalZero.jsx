import React, { useEffect, useMemo, useState } from "react";
import { C, label, numeric } from "./components/theme.js";
import { UnitField } from "./components/ui.jsx";
import CommercialLoadPicker from "./components/CommercialLoadPicker.jsx";
import { standardAtmosphere } from "./ballistics/atmosphere.js";
import { energyFtLb } from "./ballistics/solver.js";
import { optimalSightIn } from "./ballistics/vitalsWindow.js";
import { listSavedLoads } from "./storage/savedLoads.js";
import { num } from "./solveFromForm.js";
import { useUnits } from "./UnitsContext.jsx";
import { toDisplay, unitSuffix } from "./units.js";

// The shared rig — everything a round needs beyond its own ammo data to
// compute an optimal zero. Deliberately smaller than Calculator's full
// input set: no zero (that's the output), no shot distance, no wind
// (barely touches apex height, not worth the complexity for a browsing
// tool like this one).
const DEFAULTS = {
  sightHeight: "1.5",
  vitalsRadiusIn: "3",
  tempF: "59",
  pressInHg: "29.92",
  altitudeFt: "0",
};

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
  const [rig, setRig] = useState(DEFAULTS);
  const set = Object.fromEntries(
    Object.keys(DEFAULTS).map((k) => [k, (val) => setRig((s) => ({ ...s, [k]: val }))])
  );
  // Loaded once per mount — switching to this tab re-mounts it, which is
  // when a load saved on the Calculator tab should show up here (same
  // pattern as Compare.jsx).
  const [savedLoads] = useState(() => listSavedLoads());
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
        {savedLoads.length > 0 && (
          <>
            <div style={{ ...label, color: C.ink, marginBottom: 12 }}>Your saved datasets</div>
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

        <div style={{ ...label, color: C.ink, marginBottom: 12 }}>Add a round from the catalog</div>
        <CommercialLoadPicker onSelect={(ammo) => addEntry(fromCatalog(ammo))} resetLoadAfterSelect />

        <div style={{ ...label, color: C.ink, marginBottom: 12 }}>Your rig</div>
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
                        ? `${Math.round(energyFtLb(entry.grains, entry.muzzleVelocity)).toLocaleString("en-US")} ft·lb`
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
