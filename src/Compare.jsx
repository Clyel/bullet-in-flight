import React, { useEffect, useMemo, useState } from "react";
import { C, label } from "./components/theme.js";
import { UnitField } from "./components/ui.jsx";
import CompareChart from "./components/CompareChart.jsx";
import CompareTable from "./components/CompareTable.jsx";
import { listSavedLoads } from "./storage/savedLoads.js";
import { num, solveFromForm } from "./solveFromForm.js";

export default function Compare() {
  // Loaded once per mount — switching to this tab re-mounts it, which is
  // when a load saved on the Calculator tab should show up here.
  const [savedLoads] = useState(() => listSavedLoads());
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
        results.push({ id: l.id, name: l.name, grains: num(l.grains), solution: solveFromForm(l) });
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
        <div style={{ ...label, color: C.ink, marginBottom: 12 }}>Datasets to compare</div>
        {savedLoads.map((l) => (
          <label key={l.id} style={{ display: "flex", alignItems: "center", gap: 8,
                                      marginBottom: 8, cursor: "pointer" }}>
            <input type="checkbox" checked={selectedIds.has(l.id)} onChange={() => toggle(l.id)} />
            <span style={{ font: "500 13px 'IBM Plex Sans',sans-serif", color: C.ink }}>{l.name}</span>
          </label>
        ))}

        <div style={{ ...label, color: C.ink, margin: "20px 0 12px" }}>Compare at</div>
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
