import React, { useMemo, useState } from "react";
import { C, label, numeric } from "./components/theme.js";
import { UnitField } from "./components/ui.jsx";
import CommercialLoadPicker from "./components/CommercialLoadPicker.jsx";
import { standardAtmosphere } from "./ballistics/atmosphere.js";
import { optimalSightIn } from "./ballistics/vitalsWindow.js";
import { num } from "./solveFromForm.js";
import { useUnits } from "./UnitsContext.jsx";
import { toDisplay, unitSuffix } from "./units.js";

// The shared rig — everything a catalog round needs beyond its own ammo
// data to compute an optimal zero. Deliberately smaller than Calculator's
// full input set: no zero (that's the output), no shot distance, no wind
// (barely touches apex height, not worth the complexity for a browsing
// tool like this one).
const DEFAULTS = {
  sightHeight: "1.5",
  vitalsRadiusIn: "3",
  tempF: "59",
  pressInHg: "29.92",
  altitudeFt: "0",
};

export default function OptimalZero() {
  const { system } = useUnits();
  const [rig, setRig] = useState(DEFAULTS);
  const set = Object.fromEntries(
    Object.keys(DEFAULTS).map((k) => [k, (val) => setRig((s) => ({ ...s, [k]: val }))])
  );
  const [selected, setSelected] = useState([]); // COMMERCIAL_AMMO entries, in pick order

  const addLoad = (ammo) => {
    setSelected((s) => (s.some((a) => a.id === ammo.id) ? s : [...s, ammo]));
  };
  const removeLoad = (id) => setSelected((s) => s.filter((a) => a.id !== id));

  const fillStandard = () => {
    const alt = parseFloat(rig.altitudeFt);
    if (!Number.isFinite(alt)) return;
    const { tempF, pressInHg } = standardAtmosphere(alt);
    set.tempF(tempF.toFixed(0));
    set.pressInHg(pressInHg.toFixed(2));
  };

  const dist = (yd) => toDisplay(yd, "distance", system);
  const dSuf = unitSuffix("distance", system);

  // One optimalSightIn call per row (~130-150ms each) — fine for the
  // "a dozen or so rounds" scale this is meant for. Recomputes the whole
  // table when the shared rig changes (it applies to every row), or when
  // the selection itself changes.
  const rows = useMemo(() => {
    const sightHeight = num(rig.sightHeight);
    const vitalsRadiusIn = num(rig.vitalsRadiusIn);
    const tempF = num(rig.tempF);
    const pressInHg = num(rig.pressInHg);
    const rigOk = Number.isFinite(sightHeight) && Number.isFinite(vitalsRadiusIn) && vitalsRadiusIn > 0 &&
      Number.isFinite(tempF) && Number.isFinite(pressInHg);

    return selected.map((ammo) => {
      if (!rigOk) return { ammo, error: "Fill in your rig above." };
      const base = {
        muzzleVelocity: ammo.muzzleVelocity, ballisticCoefficient: ammo.ballisticCoefficient,
        dragModel: ammo.dragModel, sightHeight, tempF, pressInHg,
        windSpeedMph: undefined, windClock: undefined,
      };
      try {
        return { ammo, result: optimalSightIn(base, vitalsRadiusIn) };
      } catch (e) {
        return { ammo, error: e.message };
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, JSON.stringify(rig)]);

  return (
    <div className="bif-grid">
      <div style={{ background: C.card, border: `1.5px solid ${C.rule}`, padding: 16 }}>
        <div style={{ ...label, color: C.ink, marginTop: 0, marginBottom: 12 }}>Your rig</div>
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
          style={{ width: "100%", padding: 9, marginBottom: 20, background: C.ink, color: C.card,
                   border: "none", cursor: "pointer",
                   font: "600 11px 'Oswald',sans-serif", letterSpacing: ".12em" }}
        >
          Fill from standard atmosphere
        </button>

        <div style={{ ...label, color: C.ink, marginBottom: 12 }}>Add a round to compare</div>
        <CommercialLoadPicker onSelect={addLoad} resetLoadAfterSelect />
      </div>

      <div>
        {selected.length === 0 ? (
          <Notice tone={C.brass} title="Nothing to compare yet">
            Add a round above — pick as many as you want, they'll all use the same rig on the left.
          </Notice>
        ) : (
          <div style={{ background: C.card, border: `1.5px solid ${C.rule}`, overflowX: "auto" }}>
            <table>
              <thead>
                <tr style={{ background: C.ink }}>
                  {["Round", "Muzzle Velocity", "Optimal Zero", "Vitals Window", ""].map((head, i) => (
                    <th key={head || i} scope="col"
                        style={{ padding: "9px 12px", textAlign: i === 0 ? "left" : i === 4 ? "center" : "right",
                                 font: "600 10px 'Oswald',sans-serif", letterSpacing: ".12em",
                                 textTransform: "uppercase", color: C.card, whiteSpace: "nowrap" }}>
                      {head}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(({ ammo, result, error }, i) => (
                  <tr key={ammo.id} style={{ background: i % 2 ? C.cardAlt : C.card }}>
                    <td style={{ ...numeric, padding: "7px 12px", fontWeight: 600 }}>
                      {ammo.cartridge}
                      <div style={{ font: "400 10.5px 'IBM Plex Sans',sans-serif", color: C.muted, marginTop: 2 }}>
                        {ammo.grains}gr {ammo.bullet} — {ammo.manufacturer}
                      </div>
                    </td>
                    <td style={{ ...numeric, padding: "7px 12px", textAlign: "right" }}>{ammo.muzzleVelocity} fps</td>
                    {error ? (
                      <td colSpan={2} style={{ ...numeric, padding: "7px 12px", textAlign: "right", color: C.ox }}>
                        {error}
                      </td>
                    ) : (
                      <>
                        <td style={{ ...numeric, padding: "7px 12px", textAlign: "right" }}>
                          {dist(result.zeroRangeYd).toFixed(0)} {dSuf}
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
                        onClick={() => removeLoad(ammo.id)}
                        aria-label={`Remove ${ammo.cartridge} ${ammo.bullet}`}
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
