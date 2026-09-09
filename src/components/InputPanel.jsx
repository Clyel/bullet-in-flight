import React, { useEffect, useState } from "react";
import { C, label } from "./theme.js";
import { Field, UnitField, Segmented, SyncStatusHint } from "./ui.jsx";
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
  onSelectCommercial, saveError, signedIn, bcOverridden, onBcOverride,
}) {
  const { system } = useUnits();

  // A catalog pick's BC and drag model are a manufacturer-vetted pair --
  // editing either invalidates the pairing (see IDENTITY_FIELDS in
  // Calculator.jsx), so they start locked to a read-only summary whenever
  // a catalog load is active. "Override" reveals the editable controls for
  // *this* catalog load; picking a new one re-locks -- bcOverridden lives in
  // Calculator and is reset directly by the handlers that actually change
  // which load is active, not inferred from v.cartridge changing (which
  // missed re-picking a different load within the same cartridge).
  const hasCartridge = v.cartridge.trim().length > 0;
  const showEditableBc = !hasCartridge || bcOverridden;

  // The BC field can't tell on its own whether its value still matches the
  // drag model -- G1 and G7 BCs are both just decimals -- so the guard sits
  // on the toggle itself, the one action that actually breaks the pairing.
  // window.confirm looked right in testing but silently no-ops if the
  // browser (or an in-app webview) has dialogs suppressed -- confirm()
  // returns false and the guard just eats the click with no feedback, which
  // is worse than no guard on the one control that yields wrong-not-error
  // output. An inline confirm strip can't silently fail that way.
  const [pendingModel, setPendingModel] = useState(null);
  useEffect(() => setPendingModel(null), [v.cartridge, bcOverridden]);

  const handleDragModelChange = (nextModel) => {
    if (nextModel === v.dragModel) { setPendingModel(null); return; }
    if (v.ballisticCoefficient.trim() === "") { set.dragModel(nextModel); return; }
    setPendingModel(nextModel);
  };
  const confirmDragModelSwitch = () => {
    set.dragModel(pendingModel);
    setPendingModel(null);
  };
  const handleBcChange = (val) => {
    setPendingModel(null);
    set.ballisticCoefficient(val);
  };

  const fillStandard = () => {
    const alt = parseFloat(v.altitudeFt);
    if (!Number.isFinite(alt)) return;
    const { tempF, pressInHg } = standardAtmosphere(alt);
    set.tempF(tempF.toFixed(0));
    set.pressInHg(pressInHg.toFixed(2));
  };

  const step = { ...label, color: C.ink, margin: "20px 0 12px" };
  const sub = { ...label, display: "block", marginBottom: 5 };
  const selectedStepLabel = STEP_PRESETS.find((p) => stepCanonicalValue(p, system) === v.tableStepYd) ?? "";

  return (
    <div style={{ background: C.card, border: `1.5px solid ${C.rule}`, padding: 16 }}>
      {/* Numbered so the required, top-to-bottom flow reads as a sequence
          rather than a wall of fields — everything genuinely optional
          (wind) is unnumbered and pushed to the very end instead. */}
      <div style={{ ...step, marginTop: 0 }}>Step 1 — The load</div>

      <span style={sub}>Pick a commercial round</span>
      <CommercialLoadPicker onSelect={(ammo) => onSelectCommercial(ammo.id)} />
      <div style={{ marginBottom: 16, font: "400 10.5px/1.4 'IBM Plex Sans',sans-serif", color: C.muted }}>
        Fills in muzzle velocity, bullet weight, drag model, and BC below. Sight height, zero, and
        conditions are yours to set separately.
      </div>

      {/* Hidden until there's actually something to load -- a disabled-
          looking "No saved datasets yet" option read as broken/dead UI for
          every first-time visitor, not a real third path. */}
      {savedLoads.length > 0 && (
        <>
          <span style={sub}>Or load a saved dataset</span>
          <select
            value=""
            onChange={(e) => e.target.value && onLoadSaved(e.target.value)}
            style={{ width: "100%", padding: "7px 8px", marginBottom: 6,
                     border: `1.5px solid ${C.rule}`, background: C.card, color: C.ink,
                     font: "500 13px 'IBM Plex Mono',monospace" }}
          >
            <option value="">Choose…</option>
            {savedLoads.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
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
        </>
      )}

      <span style={sub}>Or enter your own</span>
      <UnitField label="Muzzle velocity" category="velocity" value={v.muzzleVelocity} onChange={set.muzzleVelocity} />
      <Field label="Bullet weight" value={v.grains} onChange={set.grains} suffix="gr" />
      <span style={sub}>Ballistic coefficient</span>
      {showEditableBc ? (
        <div style={{ marginBottom: 14, padding: 10, border: `1.5px solid ${C.rule}` }}>
          <Segmented options={["G1", "G7"]} value={v.dragModel} onChange={handleDragModelChange} />
          <div style={{ margin: "5px 0 12px", font: "400 10.5px/1.4 'IBM Plex Sans',sans-serif", color: C.muted }}>
            {v.dragModel === "G1"
              ? "Flat-base reference. Use with a BC published as G1."
              : "Boat-tail reference. Use with a BC published as G7."}
          </div>
          {pendingModel && (
            <div role="alert" style={{ marginBottom: 12, padding: "7px 9px", background: C.card, border: `1px solid ${C.brass}` }}>
              <div style={{ marginBottom: 6, font: "500 11px/1.4 'IBM Plex Sans',sans-serif", color: C.ink }}>
                That BC must be a {pendingModel} value — {v.dragModel} and {pendingModel} aren't interchangeable.
              </div>
              <div style={{ display: "flex", gap: 14 }}>
                <button
                  onClick={confirmDragModelSwitch}
                  style={{ background: "none", border: "none", cursor: "pointer", padding: 0,
                           color: C.ox, textDecoration: "underline", font: "600 11px 'IBM Plex Sans',sans-serif" }}
                >
                  Switch to {pendingModel} anyway
                </button>
                <button
                  onClick={() => setPendingModel(null)}
                  style={{ background: "none", border: "none", cursor: "pointer", padding: 0,
                           color: C.steel, textDecoration: "underline", font: "600 11px 'IBM Plex Sans',sans-serif" }}
                >
                  Keep {v.dragModel}
                </button>
              </div>
            </div>
          )}
          <div style={{ marginBottom: 0 }}>
            <Field
              label="BC value"
              hint={`Must be the ${v.dragModel} value. Mixing the two gives wrong answers.`}
              value={v.ballisticCoefficient}
              onChange={handleBcChange}
              suffix={v.dragModel}
            />
          </div>
        </div>
      ) : (
        <div style={{ marginBottom: 14, padding: "8px 10px", background: C.field, border: `1px solid ${C.rule}`,
                      display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <span style={{ font: "500 12px 'IBM Plex Mono',monospace", color: C.ink }}>
            {v.dragModel} {v.ballisticCoefficient}
            <span style={{ marginLeft: 6, font: "400 10.5px 'IBM Plex Sans',sans-serif", color: C.muted }}>
              {" "}— {v.bcSource === "published" ? `${v.manufacturer}'s published data` : `derived from ${v.manufacturer}'s data`}
            </span>
          </span>
          <button
            onClick={onBcOverride}
            style={{ flexShrink: 0, background: "none", border: "none", cursor: "pointer",
                     color: C.steel, textDecoration: "underline", font: "500 11px 'IBM Plex Sans',sans-serif" }}
          >
            Override
          </button>
        </div>
      )}

      {/* Saving is its own action, not a fourth way to get a load, but it
          only makes sense once a load's actually put together above --
          keeping it inside Step 1 instead of its own numbered step. */}
      <Field label="Name this load" inputMode="text" value={saveName} onChange={onSaveNameChange} />
      <SyncStatusHint signedIn={signedIn} noun="saves" />
      <button
        onClick={onSave}
        disabled={!saveName.trim()}
        style={{ width: "100%", padding: 9, marginBottom: 16,
                 background: saveName.trim() ? C.ink : C.rule, color: C.card,
                 border: "none", cursor: saveName.trim() ? "pointer" : "default",
                 font: "600 11px 'Oswald',sans-serif", letterSpacing: ".12em" }}
      >
        Save current load
      </button>
      {saveError && (
        <div style={{ marginTop: -10, marginBottom: 16, font: "500 11px/1.4 'IBM Plex Sans',sans-serif", color: C.ox }}>
          Couldn't save: {saveError}
        </div>
      )}

      <div style={step}>Step 2 — The sights</div>
      <UnitField
        label="Sight height over bore"
        hint="Bore centerline to sight centerline. Typical scope 1.5–2.0 in; irons about 0.8 in."
        category="length"
        value={v.sightHeight}
        onChange={set.sightHeight}
      />
      <UnitField label="Zero range" category="distance" value={v.zeroRangeYd} onChange={set.zeroRangeYd} />

      <div style={step}>Step 3 — The target</div>
      <UnitField
        label="Vitals radius"
        hint="Half-width of the vital zone you're aiming to stay within — smaller for varmints, larger for elk or moose. Drives the Vitals Zero chart lines and the vitals-window figures below."
        category="length"
        value={v.vitalsRadiusIn}
        onChange={set.vitalsRadiusIn}
      />

      <div style={step}>Step 4 — The shot</div>
      <UnitField label="Distance out to" category="distance" value={v.maxRangeYd} onChange={set.maxRangeYd} />
      <div style={{ marginBottom: 16 }}>
        <span style={sub}>Table every ({system === "metric" ? "m" : "yd"})</span>
        <Segmented
          options={STEP_PRESETS}
          value={selectedStepLabel}
          onChange={(presetLabel) => set.tableStepYd(stepCanonicalValue(presetLabel, system))}
        />
      </div>

      <div style={step}>Step 5 — The air</div>
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
        style={{ width: "100%", padding: 9, marginBottom: 16, background: C.ink, color: C.card,
                 border: "none", cursor: "pointer",
                 font: "600 11px 'Oswald',sans-serif", letterSpacing: ".12em" }}
      >
        Fill from standard atmosphere
      </button>

      <div style={step}>Optional — The wind</div>
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
    </div>
  );
}
