import React, { useEffect, useMemo, useState } from "react";
import { C, label } from "./components/theme.js";
import InputPanel from "./components/InputPanel.jsx";
import SummaryStrip from "./components/SummaryStrip.jsx";
import TrajectoryChart from "./components/TrajectoryChart.jsx";
import RangeTable from "./components/RangeTable.jsx";
import DopeChart from "./components/DopeChart.jsx";
import { ImportActions } from "./components/ui.jsx";
import { useSavedLoads } from "./storage/useSavedLoads.js";
import { num, isWindActive, solveFromForm, baseBallisticParams } from "./solveFromForm.js";
import { COMMERCIAL_AMMO } from "./data/commercialAmmo.js";

// 30-06 Springfield, Remington Premier Long Range 172gr (Speer Impact).
// MV/BC published directly by Remington: remington.com/rifle/premier-long-range/29-R21344.html
// G7 = 0.265 is the accurate figure for this boat-tail bullet (G1 = 0.522).
const DEFAULTS = {
  cartridge: "30-06 Springfield",
  bullet: "172gr Speer Impact (Premier Long Range)",
  manufacturer: "Remington",
  bcSource: "published",
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
  vitalsRadiusIn: "3",
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

// Editing any of these by hand invalidates whatever catalog round was
// picked (the whole point of the identity label above SummaryStrip is
// trustworthy "this is what's being evaluated" — showing a stale
// cartridge name after someone's typed over its numbers would undermine
// exactly that), so these four setters also clear cartridge/bullet/
// manufacturer/bcSource instead of using the generic per-field setter below.
const IDENTITY_FIELDS = ["muzzleVelocity", "ballisticCoefficient", "grains", "dragModel"];

export default function Calculator() {
  const [v, setState] = useState(DEFAULTS);
  const set = Object.fromEntries(
    Object.keys(DEFAULTS).map((k) => [k, (val) => setState((s) => ({ ...s, [k]: val }))])
  );
  for (const k of IDENTITY_FIELDS) {
    set[k] = (val) => setState((s) => ({ ...s, [k]: val, cartridge: "", bullet: "", manufacturer: "", bcSource: "" }));
  }

  const { savedLoads, saveError, save, remove, importCount, runImport, dismissImport, signedIn } = useSavedLoads();
  const [saveName, setSaveName] = useState("");
  const [showMOA, setShowMOA] = useState(false);
  const [showMIL, setShowMIL] = useState(false);
  const [printing, setPrinting] = useState(false);
  // Whether the BC/drag-model guard is unlocked for the *current* catalog
  // load. Lives here (not as an effect keyed on v.cartridge in InputPanel)
  // because a cartridge string alone can't tell "still the same pick" from
  // "a fresh pick that happens to share a cartridge" -- picking a different
  // load within the same cartridge left the guard stuck unlocked. Resetting
  // it directly in the two handlers that actually change which load is
  // active (below) fixes that for both cases at once.
  const [bcOverridden, setBcOverridden] = useState(false);

  // DopeChart mounts via a portal (see its own comment for why), so it
  // needs a render to actually land in the DOM before window.print() reads
  // it — hence doing this in an effect rather than inline in the click
  // handler. afterprint fires whether the user saves, cancels, or the
  // dialog is dismissed any other way, so this always cleans back up.
  useEffect(() => {
    if (!printing) return;
    const stopPrinting = () => setPrinting(false);
    window.addEventListener("afterprint", stopPrinting);
    window.print();
    return () => window.removeEventListener("afterprint", stopPrinting);
  }, [printing]);

  const handleSave = async () => {
    const trimmed = saveName.trim();
    if (!trimmed) return;
    const ok = await save(trimmed, v);
    if (ok) setSaveName("");
  };
  const handleLoadSaved = (id) => {
    const entry = savedLoads.find((l) => l.id === id);
    if (!entry) return;
    const { id: _id, name: _name, savedAt: _savedAt, ...formState } = entry;
    // Datasets saved before the identity label existed have no cartridge/
    // bullet/manufacturer keys at all -- spreading formState over blanks
    // (rather than over whatever's currently on screen) means loading one
    // of those correctly shows "Custom load" instead of leaking behind a
    // stale name from whatever was loaded before it.
    setState((s) => ({ ...s, cartridge: "", bullet: "", manufacturer: "", bcSource: "", ...formState }));
    setBcOverridden(false);
  };
  const handleDeleteSaved = (id) => {
    const entry = savedLoads.find((l) => l.id === id);
    if (entry && !window.confirm(`Delete "${entry.name}"?`)) return;
    remove(id);
  };
  const handleSelectCommercial = (id) => {
    const ammo = COMMERCIAL_AMMO.find((a) => a.id === id);
    if (!ammo) return;
    // Ammo-only: fills the four ballistic fields, leaves rifle setup and conditions untouched.
    // cartridge/bullet/manufacturer are display-only -- solveFromForm.js
    // never reads them -- but are what the identity label above
    // SummaryStrip actually shows, and ride along into Saved Datasets for
    // free since saveLoad/handleLoadSaved already spread the whole form.
    setState((s) => ({
      ...s,
      muzzleVelocity: String(ammo.muzzleVelocity),
      ballisticCoefficient: String(ammo.ballisticCoefficient),
      dragModel: ammo.dragModel,
      grains: String(ammo.grains),
      cartridge: ammo.cartridge,
      bullet: `${ammo.grains}gr ${ammo.bullet}${ammo.bcSource !== "published" ? " (derived BC)" : ""}`,
      manufacturer: ammo.manufacturer,
      bcSource: ammo.bcSource,
    }));
    setBcOverridden(false);
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
        onSelectCommercial={handleSelectCommercial} saveError={saveError} signedIn={signedIn}
        bcOverridden={bcOverridden} onBcOverride={() => setBcOverridden(true)}
      />

      <div>
        {importCount > 0 && (
          <Notice tone={C.brass} title="Saved loads found on this device">
            {importCount} {importCount === 1 ? "load" : "loads"} saved locally, from before you signed in.
            <ImportActions onImport={runImport} onDismiss={dismissImport} />
          </Notice>
        )}
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
            <LoadIdentity v={v} />
            <SummaryStrip solution={solution} maxRangeYd={maxRangeYd} />
            <TrajectoryChart
              solution={solution} maxRangeYd={maxRangeYd}
              vitalsRadiusIn={num(v.vitalsRadiusIn)}
              baseBallisticParams={baseBallisticParams(v)}
            />

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
            <button
              onClick={() => setPrinting(true)}
              style={{ margin: "10px 0", padding: "6px 0", background: "none", border: "none",
                       cursor: "pointer", color: C.steel, textDecoration: "underline",
                       font: "500 12px 'IBM Plex Sans',sans-serif" }}
            >
              Print dope chart (PDF)
            </button>
            <p style={{ marginTop: 4, font: "400 11px/1.5 'IBM Plex Sans',sans-serif", color: C.muted }}>
              Barrel angle above the line of sight: {solution.launchAngleDeg.toFixed(3)}&deg;.
              Drag uses the tabulated {v.dragModel} standard curve, integrated in 0.25 ms steps.
              {windActive
                ? ` Wind: ${num(v.windSpeedMph)} mph from ${num(v.windClock)} o'clock, factored into velocity, energy, and windage.`
                : " No wind entered."}
              {" "}No spin drift or Coriolis in this version.
            </p>
            {printing && (
              <DopeChart v={v} solution={solution} saveName={saveName} showMOA={showMOA} showMIL={showMIL} />
            )}
          </>
        )}
      </div>
    </div>
  );
}

/** What's actually being evaluated, shown above the summary strip so it's
 *  never ambiguous which round the numbers below belong to. Falls back to
 *  a plain numeric description for a hand-typed load with no catalog
 *  cartridge attached — never blank, never a stale name left over from
 *  before the load's numbers were edited (see IDENTITY_FIELDS above). */
function LoadIdentity({ v }) {
  const hasCartridge = v.cartridge.trim().length > 0;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ font: "700 15px 'Oswald',sans-serif", textTransform: "uppercase", letterSpacing: ".02em", color: C.ink }}>
        {hasCartridge ? v.cartridge : "Custom load"}
      </div>
      <div style={{ font: "400 11.5px 'IBM Plex Sans',sans-serif", color: C.muted, marginTop: 2 }}>
        {hasCartridge
          ? `${v.bullet}${v.manufacturer ? ` — ${v.manufacturer}` : ""}`
          : `${v.grains}gr @ ${v.muzzleVelocity} fps, ${v.dragModel} ${v.ballisticCoefficient}`}
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
