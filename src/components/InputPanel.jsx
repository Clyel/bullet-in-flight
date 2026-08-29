import React from "react";
import { C, label } from "./theme.js";
import { Field, UnitField, Segmented } from "./ui.jsx";
import CommercialLoadPicker from "./CommercialLoadPicker.jsx";
import { standardAtmosphere } from "../ballistics/atmosphere.js";
import { useUnits } from "../UnitsContext.jsx";
import { mToYd } from "../units.js";

const STEP_PRESETS = ["25", "50", "100"];

// The three step-size presets always read "25/50/100" on the buttons, but
// what they *mean* depends on the unit system: 25/50/100 yards in Imperial,
// or 25/50/100 clean meters in Metric (not a converted-and-rounded yard
// value like "22.9" — nobody wants that as a table step). Selecting a
// metric preset still stores the canonical yard equivalent, same as every
// other field.
const stepCanonicalValue = (presetLabel, system) =>
  system === "metric" ? String(Math.round(mToYd(parseFloat(presetLabel)) * 100) / 100) : presetLabel;

export default function InputPanel({
  v, set, savedLoads, saveName, onSaveNameChange, onSave, onLoadSaved, onDeleteSaved,
  onSelectCommercial,
}) {
  const { system } = useUnits();

  const fillStandard = () => {
    const alt = parseFloat(v.altitudeFt);
    if (!Number.isFinite(alt)) return;
    const { tempF, pressInHg } = standardAtmosphere(alt);
    set.tempF(tempF.toFixed(0));
    set.pressInHg(pressInHg.toFixed(2));
  };

  const head = { ...label, color: C.ink, margin: "20px 0 12px" };
  const selectedStepLabel = STEP_PRESETS.find((p) => stepCanonicalValue(p, system) === v.tableStepYd) ?? "";

  return (
    <div style={{ background: C.card, border: `1.5px solid ${C.rule}`, padding: 16 }}>
      <div style={{ ...head, marginTop: 0 }}>Saved datasets</div>
      <Field label="Name this dataset" inputMode="text" value={saveName} onChange={onSaveNameChange} />
      <button
        onClick={onSave}
        disabled={!saveName.trim()}
        style={{ width: "100%", padding: 9, marginBottom: 16,
                 background: saveName.trim() ? C.ink : C.rule, color: C.card,
                 border: "none", cursor: saveName.trim() ? "pointer" : "default",
                 font: "600 11px 'Oswald',sans-serif", letterSpacing: ".12em" }}
      >
        Save current dataset
      </button>

      <span style={{ ...label, display: "block", marginBottom: 5 }}>Load a saved dataset</span>
      <select
        value=""
        onChange={(e) => e.target.value && onLoadSaved(e.target.value)}
        style={{ width: "100%", padding: "7px 8px", marginBottom: 6,
                 border: `1.5px solid ${C.rule}`, background: C.card, color: C.ink,
                 font: "500 13px 'IBM Plex Mono',monospace" }}
      >
        <option value="">{savedLoads.length ? "Choose…" : "No saved datasets yet"}</option>
        {savedLoads.map((l) => (
          <option key={l.id} value={l.id}>{l.name}</option>
        ))}
      </select>
      {savedLoads.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          {savedLoads.map((l) => (
            <div key={l.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
                                      padding: "2px 1px", font: "400 11px 'IBM Plex Sans',sans-serif",
                                      color: C.muted }}>
              <span>{l.name}</span>
              <button
                onClick={() => onDeleteSaved(l.id)}
                aria-label={`Delete ${l.name}`}
                style={{ background: "none", border: "none", cursor: "pointer", color: C.ox,
                         font: "600 12px 'IBM Plex Mono',monospace", padding: "0 4px" }}
              >
                &times;
              </button>
            </div>
          ))}
        </div>
      )}

      <div style={head}>The load</div>
      <span style={{ ...label, display: "block", marginBottom: 5 }}>Or pick a commercial round</span>

      <CommercialLoadPicker onSelect={(ammo) => onSelectCommercial(ammo.id)} />
      <div style={{ marginBottom: 16, font: "400 10.5px/1.4 'IBM Plex Sans',sans-serif", color: C.muted }}>
        Fills the four fields below. Sight height, zero, and conditions are yours to set separately.
      </div>

      <UnitField label="Muzzle velocity" category="velocity" value={v.muzzleVelocity} onChange={set.muzzleVelocity} />
      <Field label="Bullet weight" value={v.grains} onChange={set.grains} suffix="gr" />

      <div style={{ marginBottom: 12 }}>
        <span style={{ ...label, display: "block", marginBottom: 5 }}>Drag model</span>
        <Segmented options={["G1", "G7"]} value={v.dragModel} onChange={set.dragModel} />
        <div style={{ marginTop: 5, font: "400 10.5px/1.4 'IBM Plex Sans',sans-serif", color: C.muted }}>
          {v.dragModel === "G1"
            ? "Flat-base reference. Use with a BC published as G1."
            : "Boat-tail reference. Use with a BC published as G7."}
        </div>
      </div>

      <Field
        label="Ballistic coefficient"
        hint={`Must be the ${v.dragModel} value. Mixing the two gives wrong answers.`}
        value={v.ballisticCoefficient}
        onChange={set.ballisticCoefficient}
        suffix={v.dragModel}
      />

      <div style={head}>The sights</div>
      <UnitField
        label="Sight height over bore"
        hint="Bore centerline to sight centerline. Typical scope 1.5–2.0 in; irons about 0.8 in."
        category="length"
        value={v.sightHeight}
        onChange={set.sightHeight}
      />
      <UnitField label="Zero range" category="distance" value={v.zeroRangeYd} onChange={set.zeroRangeYd} />

      <div style={head}>The target</div>
      <UnitField
        label="Vitals radius"
        hint="Half-width of the vital zone you're aiming to stay within — smaller for varmints, larger for elk or moose. Drives the Vitals Zero chart lines and the vitals-window figures below."
        category="length"
        value={v.vitalsRadiusIn}
        onChange={set.vitalsRadiusIn}
      />

      <div style={head}>The shot</div>
      <UnitField label="Distance out to" category="distance" value={v.maxRangeYd} onChange={set.maxRangeYd} />
      <div style={{ marginBottom: 16 }}>
        <span style={{ ...label, display: "block", marginBottom: 5 }}>
          Table every ({system === "metric" ? "m" : "yd"})
        </span>
        <Segmented
          options={STEP_PRESETS}
          value={selectedStepLabel}
          onChange={(presetLabel) => set.tableStepYd(stepCanonicalValue(presetLabel, system))}
        />
      </div>

      <div style={head}>The wind</div>
      <UnitField
        label="Wind speed"
        hint="Leave blank for no wind."
        category="windSpeed"
        value={v.windSpeedMph}
        onChange={set.windSpeedMph}
      />
      <Field
        label="Wind direction"
        hint="Clock face: 12 is straight into your face, 3 is your right cheek, 6 is at your back, 9 is your left cheek."
        value={v.windClock}
        onChange={set.windClock}
        suffix="o'clock"
      />

      <div style={head}>The air</div>
      <UnitField label="Temperature" category="temperature" value={v.tempF} onChange={set.tempF} />
      <UnitField
        label="Station pressure"
        hint="Absolute pressure where you are standing, not sea-level corrected."
        category="pressure"
        value={v.pressInHg}
        onChange={set.pressInHg}
      />
      <UnitField
        label="Altitude"
        hint="Only fills the two fields above. It is not applied on top of them."
        category="altitude"
        value={v.altitudeFt}
        onChange={set.altitudeFt}
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
  );
}
