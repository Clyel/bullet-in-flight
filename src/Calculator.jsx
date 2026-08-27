import React, { useMemo, useState } from "react";
import { C, label } from "./components/theme.js";
import InputPanel from "./components/InputPanel.jsx";
import SummaryStrip from "./components/SummaryStrip.jsx";
import TrajectoryChart from "./components/TrajectoryChart.jsx";
import RangeTable from "./components/RangeTable.jsx";
import { listSavedLoads, saveLoad, deleteLoad } from "./storage/savedLoads.js";
import { num, isWindActive, solveFromForm } from "./solveFromForm.js";
import { COMMERCIAL_AMMO } from "./data/commercialAmmo.js";

// 30-06 Springfield, Remington Premier Long Range 172gr (Speer Impact).
// MV/BC published directly by Remington: remington.com/rifle/premier-long-range/29-R21344.html
// G7 = 0.265 is the accurate figure for this boat-tail bullet (G1 = 0.522).
const DEFAULTS = {
  muzzleVelocity: "2825",
  ballisticCoefficient: "0.265",
  grains: "172",
  dragModel: "G7",
  sightHeight: "1.5",
  zeroRangeYd: "200",
  maxRangeYd: "500",
  tableStepYd: "100",
  tempF: "59",
  pressInHg: "29.92",
  altitudeFt: "0",
  windSpeedMph: "",
  windClock: "",
};

const REQUIRED = [
  ["muzzleVelocity", "muzzle velocity"],
  ["ballisticCoefficient", "ballistic coefficient"],
  ["grains", "bullet weight"],
  ["sightHeight", "sight height"],
  ["zeroRangeYd", "zero range"],
  ["maxRangeYd", "distance"],
  ["pressInHg", "station pressure"],
];

export default function Calculator() {
  const [v, setState] = useState(DEFAULTS);
  const set = Object.fromEntries(
    Object.keys(DEFAULTS).map((k) => [k, (val) => setState((s) => ({ ...s, [k]: val }))])
  );

  const [savedLoads, setSavedLoads] = useState(() => listSavedLoads());
  const [saveName, setSaveName] = useState("");
  const [showMOA, setShowMOA] = useState(false);
  const [showMIL, setShowMIL] = useState(false);

  const handleSave = () => {
    const trimmed = saveName.trim();
    if (!trimmed) return;
    saveLoad(trimmed, v);
    setSavedLoads(listSavedLoads());
    setSaveName("");
  };
  const handleLoadSaved = (id) => {
    const entry = savedLoads.find((l) => l.id === id);
    if (!entry) return;
    const { id: _id, name: _name, savedAt: _savedAt, ...formState } = entry;
    setState((s) => ({ ...s, ...formState }));
  };
  const handleDeleteSaved = (id) => {
    const entry = savedLoads.find((l) => l.id === id);
    if (entry && !window.confirm(`Delete "${entry.name}"?`)) return;
    deleteLoad(id);
    setSavedLoads(listSavedLoads());
  };
  const handleSelectCommercial = (id) => {
    const ammo = COMMERCIAL_AMMO.find((a) => a.id === id);
    if (!ammo) return;
    // Ammo-only: fills the four ballistic fields, leaves rifle setup and conditions untouched.
    setState((s) => ({
      ...s,
      muzzleVelocity: String(ammo.muzzleVelocity),
      ballisticCoefficient: String(ammo.ballisticCoefficient),
      dragModel: ammo.dragModel,
      grains: String(ammo.grains),
    }));
  };

  const missing = REQUIRED.filter(([k]) => {
    const n = num(v[k]);
    return k === "sightHeight" ? !(n >= 0) : !(n > 0);
  }).map(([, name]) => name);
  if (!Number.isFinite(num(v.tempF))) missing.push("temperature");

  const zeroPastMax = num(v.zeroRangeYd) > num(v.maxRangeYd);
  const windActive = isWindActive(v);

  const { solution, error } = useMemo(() => {
    if (missing.length) return { solution: null, error: null };
    try {
      return { solution: solveFromForm(v), error: null };
    } catch (e) {
      return { solution: null, error: e.message };
    }
  }, [JSON.stringify(v)]);

  const maxRangeYd = Math.max(num(v.maxRangeYd), num(v.zeroRangeYd));

  return (
    <div className="bif-grid">
      <InputPanel
        v={v} set={set}
        savedLoads={savedLoads} saveName={saveName} onSaveNameChange={setSaveName}
        onSave={handleSave} onLoadSaved={handleLoadSaved} onDeleteSaved={handleDeleteSaved}
        onSelectCommercial={handleSelectCommercial}
      />

      <div>
        {missing.length > 0 && (
          <Notice tone={C.ox} title="Nothing to plot yet">
            Enter a value for {missing.join(", ")}.
          </Notice>
        )}
        {error && (
          <Notice tone={C.ox} title="Could not zero the rifle">{error}</Notice>
        )}
        {zeroPastMax && solution && (
          <Notice tone={C.brass} title="Zero is past the charted distance">
            The chart has been extended to {Math.round(maxRangeYd)} yd so the zero is visible.
          </Notice>
        )}

        {solution && (
          <>
            <SummaryStrip solution={solution} maxRangeYd={maxRangeYd} />
            <TrajectoryChart solution={solution} maxRangeYd={maxRangeYd} />

            <div style={{ display: "flex", gap: 18, marginBottom: 8 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                <input type="checkbox" checked={showMOA} onChange={(e) => setShowMOA(e.target.checked)} />
                <span style={{ ...label, color: C.ink }}>Show MOA</span>
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                <input type="checkbox" checked={showMIL} onChange={(e) => setShowMIL(e.target.checked)} />
                <span style={{ ...label, color: C.ink }}>Show MIL</span>
              </label>
            </div>

            <RangeTable rows={solution.rows} showWindage={windActive} showMOA={showMOA} showMIL={showMIL} />
            <p style={{ marginTop: 10, font: "400 11px/1.5 'IBM Plex Sans',sans-serif", color: C.muted }}>
              Barrel angle above the line of sight: {solution.launchAngleDeg.toFixed(3)}&deg;.
              Drag uses the tabulated {v.dragModel} standard curve, integrated in 0.25 ms steps.
              {windActive
                ? ` Wind: ${num(v.windSpeedMph)} mph from ${num(v.windClock)} o'clock, factored into velocity, energy, and windage.`
                : " No wind entered."}
              {" "}No spin drift or Coriolis in this version.
            </p>
          </>
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
