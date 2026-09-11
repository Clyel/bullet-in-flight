import React, { useEffect, useMemo, useRef, useState } from "react";
import { C, label } from "./components/theme.js";
import { UnitField, StepHead, Notice } from "./components/ui.jsx";
import CommercialLoadPicker from "./components/CommercialLoadPicker.jsx";
import CompareChart from "./components/CompareChart.jsx";
import CompareTable from "./components/CompareTable.jsx";
import { useSavedLoads } from "./storage/useSavedLoads.js";
import { useMyRig } from "./storage/useMyRig.js";
import { num, solveFromForm } from "./solveFromForm.js";

// Everything solveFromForm/CompareChart need that isn't ammo: the shared
// rig (sight/vitals/atmosphere) plus the same zero / distance / step the
// Calculator starts a fresh load at. Wind stays out — Compare has no wind
// input, and a saved dataset with no wind is what the rest of the tab
// already expects.
function datasetFromAmmo(ammo, rig) {
  return {
    cartridge: ammo.cartridge,
    bullet: `${ammo.grains}gr ${ammo.bullet}${ammo.bcSource !== "published" ? " (derived BC)" : ""}`,
    manufacturer: ammo.manufacturer,
    bcSource: ammo.bcSource,
    muzzleVelocity: String(ammo.muzzleVelocity),
    ballisticCoefficient: String(ammo.ballisticCoefficient),
    grains: String(ammo.grains),
    dragModel: ammo.dragModel,
    zeroRangeYd: "200",
    maxRangeYd: "500",
    tableStepYd: "100",
    windSpeedMph: "",
    windClock: "",
    ...rig, // sightHeight, vitalsRadiusIn, tempF, pressInHg, altitudeFt
  };
}

const datasetName = (ammo) =>
  `${ammo.cartridge} · ${ammo.grains}gr ${ammo.bullet}`.slice(0, 80);

export default function Compare() {
  // useSavedLoads re-fetches on mount, which is when a load saved on the
  // Calculator tab (or synced from the cloud) should show up here.
  const { savedLoads, save } = useSavedLoads();
  const { rig } = useMyRig();
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [atYd, setAtYd] = useState("500");
  const [atYdTouched, setAtYdTouched] = useState(false);
  const [addError, setAddError] = useState("");
  // A round picked from the catalog is saved by name; once it lands in
  // savedLoads (async, via the storage layer) this pulls it into the
  // comparison so the pick feels immediate.
  const pendingSelectName = useRef(null);

  const toggle = (id) => {
    setSelectedIds((s) => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleAddCatalogRound = async (ammo) => {
    setAddError("");
    const name = datasetName(ammo);
    // Set the pending-select before saving: save() refreshes savedLoads,
    // and outside React's batching (this is past an await) that state
    // update can flush and run the effect below before this line would
    // otherwise reach it.
    pendingSelectName.current = name;
    const ok = await save(name, datasetFromAmmo(ammo, rig));
    if (!ok) {
      pendingSelectName.current = null;
      setAddError("Couldn't add that round.");
    }
  };

  useEffect(() => {
    if (!pendingSelectName.current) return;
    const added = savedLoads.find((l) => l.name === pendingSelectName.current);
    if (added) {
      setSelectedIds((s) => new Set(s).add(added.id));
      pendingSelectName.current = null;
    }
  }, [savedLoads]);

  const { results, failed } = useMemo(() => {
    const results = [];
    const failed = [];
    for (const l of savedLoads) {
      if (!selectedIds.has(l.id)) continue;
      try {
        // vitalsRadiusIn may be missing on datasets saved before this field
        // existed — num(undefined) is NaN, which CompareChart treats as
        // "this load has no vitals radius" rather than crashing on it.
        results.push({
          id: l.id, name: l.name, grains: num(l.grains), vitalsRadiusIn: num(l.vitalsRadiusIn),
          solution: solveFromForm(l),
        });
      } catch (e) {
        failed.push({ id: l.id, name: l.name, message: e.message });
      }
    }
    return { results, failed };
  }, [savedLoads, selectedIds]);

  // "Compare at" starts pointed at the shortest selected load's own charted
  // range, so a fresh selection always shows full data in every row instead
  // of "beyond this load's charted distance" placeholders. Once the user
  // types their own distance, their choice sticks — this only sets the
  // starting point.
  useEffect(() => {
    if (atYdTouched || results.length === 0) return;
    const minRange = Math.min(...results.map((r) => r.solution.last.range));
    setAtYd(String(minRange));
  }, [results, atYdTouched]);

  const atYdNum = num(atYd);

  const catalogPicker = (
    <>
      <span style={{ ...label, display: "block", marginBottom: 5, color: C.muted }}>
        Add a round from the catalog
      </span>
      <CommercialLoadPicker onSelect={handleAddCatalogRound} resetLoadAfterSelect />
      <div style={{ marginBottom: 4, font: "400 12px/1.5 'IBM Plex Sans',sans-serif", color: C.muted }}>
        Loaded at your saved rig's sight height and conditions, a 200&nbsp;yd zero, out to 500&nbsp;yd — it's
        saved as a dataset and added to the comparison. Tune it on the Calculator tab.
      </div>
      {addError && (
        <div style={{ marginBottom: 8, font: "500 11px/1.4 'IBM Plex Sans',sans-serif", color: C.ox }}>
          {addError}
        </div>
      )}
    </>
  );

  if (savedLoads.length === 0) {
    return (
      <div className="bif-grid">
        <div style={{ background: C.card, border: `1.5px solid ${C.rule}`, padding: 16 }}>
          <StepHead n={1} name="Datasets to compare" first />
          {catalogPicker}
        </div>
        <div>
          <Notice tone={C.brass} title="Nothing to compare yet">
            Pick a round from the catalog on the left to start, or save a load from the Calculator tab and
            come back — every saved dataset shows up here.
          </Notice>
        </div>
      </div>
    );
  }

  return (
    <div className="bif-grid">
      <div style={{ background: C.card, border: `1.5px solid ${C.rule}`, padding: 16 }}>
        <StepHead n={1} name="Datasets to compare" first />
        {savedLoads.map((l) => (
          <label key={l.id} style={{ display: "flex", alignItems: "center", gap: 8,
                                      marginBottom: 8, cursor: "pointer" }}>
            <input type="checkbox" checked={selectedIds.has(l.id)} onChange={() => toggle(l.id)} />
            <span style={{ font: "500 13px 'IBM Plex Sans',sans-serif", color: C.ink }}>{l.name}</span>
          </label>
        ))}

        <div style={{ marginTop: 16 }}>{catalogPicker}</div>

        <StepHead n={2} name="Compare at" />
        <UnitField
          label="Distance"
          category="distance"
          value={atYd}
          onChange={(v) => { setAtYd(v); setAtYdTouched(true); }}
        />
      </div>

      <div>
        {failed.length > 0 && (
          <Notice tone={C.ox} title="Couldn't solve some datasets">
            {failed.map((f) => `${f.name}: ${f.message}`).join(" — ")}
          </Notice>
        )}

        {results.length === 0 ? (
          <Notice tone={C.brass} title="Nothing selected">
            Check off one or more saved datasets to overlay their trajectories.
          </Notice>
        ) : (
          <>
            <CompareChart results={results} atYd={atYdNum} />
            {Number.isFinite(atYdNum) && <CompareTable results={results} atYd={atYdNum} />}
          </>
        )}
      </div>
    </div>
  );
}
