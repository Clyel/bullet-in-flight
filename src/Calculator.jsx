import React, { useEffect, useMemo, useRef, useState } from "react";
import { C, label } from "./components/theme.js";
import InputPanel from "./components/InputPanel.jsx";
import SummaryStrip from "./components/SummaryStrip.jsx";
import TrajectoryChart from "./components/TrajectoryChart.jsx";
import RangeTable from "./components/RangeTable.jsx";
import DopeChart from "./components/DopeChart.jsx";
import { ImportActions, Notice } from "./components/ui.jsx";
import { useSavedLoads } from "./storage/useSavedLoads.js";
import { getMyRig, setMyRig, rigDiffers, RIG_FIELDS } from "./storage/myRig.js";
import { num, isWindActive, solveFromForm, baseBallisticParams } from "./solveFromForm.js";
import { inclinedEquivalentRange } from "./ballistics/inclineComp.js";
import { COMMERCIAL_AMMO } from "./data/commercialAmmo.js";
import { useUnits } from "./UnitsContext.jsx";
import { toDisplay, toCanonical, unitSuffix } from "./units.js";

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
  shotAngleDeg: "0",
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

// Soft sanity ranges, in canonical (imperial) units -- a value outside
// these still computes, it just gets a non-blocking caution above the
// results, because the usual cause is a fat-fingered extra zero or a value
// typed into the wrong field, not a real load. Bounds are deliberately
// wide (a .17 varmint round and a .50 BMG both have to fit): this catches
// "50,000 fps", not "unusual but real". `cat` is the units.js category for
// echoing the value back in the user's chosen units; BC has none.
const SANITY = [
  { k: "muzzleVelocity", cat: "velocity", low: 300, high: 5200, name: "Muzzle velocity" },
  { k: "ballisticCoefficient", low: 0.04, high: 1.6, name: "Ballistic coefficient" },
  { k: "grains", low: 5, high: 1200, name: "Bullet weight" },
  { k: "zeroRangeYd", cat: "distance", low: 5, high: 1500, name: "Zero range" },
  { k: "sightHeight", cat: "length", low: 0.2, high: 6, name: "Sight height" },
];

// Editing any of these by hand invalidates whatever catalog round was
// picked (the whole point of the identity label above SummaryStrip is
// trustworthy "this is what's being evaluated" — showing a stale
// cartridge name after someone's typed over its numbers would undermine
// exactly that), so these four setters also clear cartridge/bullet/
// manufacturer/bcSource instead of using the generic per-field setter below.
const IDENTITY_FIELDS = ["muzzleVelocity", "ballisticCoefficient", "grains", "dragModel"];

export default function Calculator() {
  // The 5 shared rig fields start from "My rig" (set on either this tab or
  // Optimal Zero) rather than the hardcoded DEFAULTS; everything else is
  // still DEFAULTS. `storedRig` is what's currently saved -- the drift bar
  // compares the live form against it.
  const [storedRig, setStoredRig] = useState(getMyRig);
  const [v, setState] = useState(() => ({ ...DEFAULTS, ...storedRig }));
  // The drift bar shows only after the user *deliberately* touches a rig
  // field -- not when a rig field changes because a saved dataset was
  // loaded (that dataset carries its own conditions, and both "Save as my
  // rig" and "Reset to my rig" would be wrong for it).
  const [rigTouched, setRigTouched] = useState(false);
  // One stable set of per-field setters (all the state setters they close
  // over are stable) — was rebuilding ~20 closures on every render.
  const set = useMemo(() => {
    const s = Object.fromEntries(
      Object.keys(DEFAULTS).map((k) => [k, (val) => setState((prev) => ({ ...prev, [k]: val }))])
    );
    for (const k of IDENTITY_FIELDS) {
      s[k] = (val) => setState((prev) => ({ ...prev, [k]: val, cartridge: "", bullet: "", manufacturer: "", bcSource: "" }));
    }
    for (const k of RIG_FIELDS) {
      const base = s[k];
      s[k] = (val) => { setRigTouched(true); base(val); };
    }
    return s;
  }, []);

  const { savedLoads, saveError, save, remove, importCount, runImport, dismissImport, signedIn } = useSavedLoads();
  const { system } = useUnits();
  const [saveName, setSaveName] = useState("");
  const [showMOA, setShowMOA] = useState(false);
  const [showMIL, setShowMIL] = useState(false);
  const [printing, setPrinting] = useState(false);

  // "Distance out to" and "table every" are chart-display preferences, not
  // physical properties of the load -- a metric shooter wants "out to
  // 500 m, every 100 m", not the yard values mechanically converted to
  // 457 / 91 (the review's "table lands on 91/183/274"). So on a unit
  // switch, keep the number the user is looking at and reinterpret it in
  // the new units -- the same thing the step presets have always done (25/
  // 50/100 mean that in whichever system). Rounding to 2 decimals lands
  // exactly on stepCanonicalValue()'s output, so a selected preset stays
  // selected. Every other field is a real quantity and converts normally.
  const prevSystem = useRef(system);
  useEffect(() => {
    const from = prevSystem.current;
    if (from === system) return;
    prevSystem.current = system;
    setState((s) => {
      const keepNumber = (canonical) => {
        const shown = toDisplay(num(canonical), "distance", from);
        if (!Number.isFinite(shown)) return canonical;
        return String(Math.round(toCanonical(shown, "distance", system) * 100) / 100);
      };
      return { ...s, maxRangeYd: keepNumber(s.maxRangeYd), tableStepYd: keepNumber(s.tableStepYd) };
    });
  }, [system]);
  // Whether the BC/drag-model guard is unlocked for the *current* catalog
  // load. Lives here (not as an effect keyed on v.cartridge in InputPanel)
  // because a cartridge string alone can't tell "still the same pick" from
  // "a fresh pick that happens to share a cartridge" -- picking a different
  // load within the same cartridge left the guard stuck unlocked. Resetting
  // it directly in the two handlers that actually change which load is
  // active (below) fixes that for both cases at once.
  const [bcOverridden, setBcOverridden] = useState(false);

  const rigDrifted = rigTouched && rigDiffers(v, storedRig);
  const handleSaveRig = () => {
    const next = Object.fromEntries(RIG_FIELDS.map((k) => [k, v[k]]));
    setMyRig(next);
    setStoredRig(next);
    setRigTouched(false);
  };
  const handleResetRig = () => {
    setState((s) => ({ ...s, ...storedRig }));
    setRigTouched(false);
  };

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
  const loadSavedEntry = (id) => {
    const entry = savedLoads.find((l) => l.id === id);
    if (!entry) return null;
    const { id: _id, name, savedAt: _savedAt, ...formState } = entry;
    // Datasets saved before the identity label existed have no cartridge/
    // bullet/manufacturer keys at all -- spreading formState over blanks
    // (rather than over whatever's currently on screen) means loading one
    // of those correctly shows "Custom load" instead of leaking behind a
    // stale name from whatever was loaded before it.
    setState((s) => ({ ...s, cartridge: "", bullet: "", manufacturer: "", bcSource: "", ...formState }));
    setBcOverridden(false);
    // The dataset's own sight/vitals/conditions came along -- they're not a
    // deliberate rig edit, so don't let them raise the drift bar.
    setRigTouched(false);
    return name;
  };
  const handleLoadSaved = (id) => { loadSavedEntry(id); };
  // Edit differs from Load by one thing: it carries the dataset's name into
  // the name field. Saving overwrites by name in both backends (see
  // savedLoads.js / savedLoadsCloud.js), so with the name pre-filled, Save
  // updates this dataset in place instead of making a copy -- and the Save
  // button relabels itself to "Update ..." whenever the name matches.
  const handleEditSaved = (id) => {
    const name = loadSavedEntry(id);
    if (name != null) setSaveName(name);
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
    if (!Number.isFinite(n)) return true; // also rules out Infinity, which > 0 would let through
    return k === "sightHeight" ? n < 0 : n <= 0;
  }).map(([, name]) => name);
  if (!Number.isFinite(num(v.tempF))) missing.push("temperature");

  // Non-blocking: these still feed the solve, they just get flagged.
  const cautions = SANITY.flatMap(({ k, cat, low, high, name }) => {
    const n = num(v[k]);
    if (!Number.isFinite(n) || n <= 0 || (n >= low && n <= high)) return [];
    const shown = cat ? `${Math.round(toDisplay(n, cat, system))} ${unitSuffix(cat, system)}` : String(n);
    return [`${name} (${shown}) looks ${n < low ? "low" : "high"}`];
  });

  const zeroPastMax = num(v.zeroRangeYd) > num(v.maxRangeYd);
  const windActive = isWindActive(v);

  // `v`'s identity only changes when a field actually changes (every setter
  // spreads a new object), so it's a sound dep on its own — no need to
  // JSON.stringify it on every render to get a stable key.
  const { solution, error } = useMemo(() => {
    if (missing.length) return { solution: null, error: null };
    try {
      return { solution: solveFromForm(v), error: null };
    } catch (e) {
      return { solution: null, error: e.message };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v]);

  // Stable per-`v` so TrajectoryChart's optimal-sight-in memo can depend on
  // it by identity instead of stringifying it.
  const baseParams = useMemo(() => baseBallisticParams(v), [v]);

  const maxRangeYd = Math.max(num(v.maxRangeYd), num(v.zeroRangeYd));

  return (
    <div className="bif-grid">
      <InputPanel
        v={v} set={set}
        savedLoads={savedLoads} saveName={saveName} onSaveNameChange={setSaveName}
        onSave={handleSave} onLoadSaved={handleLoadSaved} onEditSaved={handleEditSaved}
        onDeleteSaved={handleDeleteSaved}
        onSelectCommercial={handleSelectCommercial} saveError={saveError} signedIn={signedIn}
        bcOverridden={bcOverridden} onBcOverride={() => setBcOverridden(true)}
        rigDrifted={rigDrifted} onSaveRig={handleSaveRig} onResetRig={handleResetRig}
      />

      <div className="bif-results-col">
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
        {cautions.length > 0 && solution && (
          <Notice tone={C.brass} title="Double-check these values">
            {cautions.join("; ")}. The trajectory below still uses them as entered.
          </Notice>
        )}

        {solution && (
          <>
            <div className="bif-results">
              <LoadIdentity v={v} />
              <SummaryStrip solution={solution} maxRangeYd={maxRangeYd} />
              <InclineNote maxRangeYd={maxRangeYd} shotAngleDeg={num(v.shotAngleDeg)} system={system} />
              <TrajectoryChart
                solution={solution} maxRangeYd={maxRangeYd}
                vitalsRadiusIn={num(v.vitalsRadiusIn)}
                baseBallisticParams={baseParams}
              />
            </div>

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

/** Rifleman's rule advisory. Shows only for a real, non-zero shot angle:
 *  an inclined shot (up or down) drops like a flat shot over the horizontal
 *  leg of the distance, so the shooter holds for a nearer range than the
 *  rangefinder reads. Display-only — the trajectory itself isn't re-solved,
 *  this just points at the row of the table to use. */
function InclineNote({ maxRangeYd, shotAngleDeg, system }) {
  const mag = Math.abs(shotAngleDeg);
  // Below ~5deg the horizontal-range correction is under half a MOA — not
  // worth an amber callout. Above 90deg it isn't a real shot angle.
  if (!Number.isFinite(shotAngleDeg) || mag < 5 || mag >= 90) return null;
  const dir = shotAngleDeg < 0 ? "downhill" : "uphill";
  const equivYd = inclinedEquivalentRange(maxRangeYd, mag);
  const shownMax = Math.round(toDisplay(maxRangeYd, "distance", system));
  const shownEquiv = Math.round(toDisplay(equivYd, "distance", system));
  const suf = unitSuffix("distance", system);
  return (
    <div style={{ margin: "0 0 12px", padding: "8px 10px", background: C.inputBg,
                  border: `1px solid ${C.brass}`, font: "400 11.5px/1.5 'IBM Plex Mono',monospace",
                  color: C.ink }}>
      At {mag}&deg; {dir}, your {shownMax} {suf} shot holds like a flat ~{shownEquiv} {suf} shot &mdash;
      use that distance for your elevation hold. Windage and drift are unchanged.
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

