import React, { Suspense, lazy, useEffect, useMemo, useState } from "react";
import { C } from "./components/theme.js";
import { UnitField, StepHead, ChartFallback, Notice } from "./components/ui.jsx";
import CompareTable from "./components/CompareTable.jsx";

// Shares the lazy recharts chunk with Calculator's TrajectoryChart — see
// the note there. This whole tab is already lazy, but keeping the chart a
// separate dynamic import means the two chart components pull one shared
// recharts chunk rather than baking a copy into each tab.
const CompareChart = lazy(() => import("./components/CompareChart.jsx"));
import { useSavedLoads } from "./storage/useSavedLoads.js";
import { num, solveFromForm } from "./solveFromForm.js";

export default function Compare() {
  // useSavedLoads re-fetches on mount, which is when a load saved on the
  // Calculator tab (or synced from the cloud) should show up here.
  const { savedLoads } = useSavedLoads();
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [atYd, setAtYd] = useState("500");
  const [atYdTouched, setAtYdTouched] = useState(false);

  const toggle = (id) => {
    setSelectedIds((s) => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

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

  if (savedLoads.length === 0) {
    return (
      <Notice tone={C.ox} title="No saved datasets yet">
        Save a load from the Calculator tab first, then come back here to compare it against others.
      </Notice>
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
            <Suspense fallback={<ChartFallback height={360} />}>
              <CompareChart results={results} atYd={atYdNum} />
            </Suspense>
            {Number.isFinite(atYdNum) && <CompareTable results={results} atYd={atYdNum} />}
          </>
        )}
      </div>
    </div>
  );
}

