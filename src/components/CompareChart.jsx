import React, { useMemo, useState } from "react";
import Plot from "./Plot.jsx";
import { C, label } from "./theme.js";
import { sampleAt } from "../ballistics/solver.js";
import { toDisplay } from "../units.js";
import { useUnitFormatters } from "../useUnitFormatters.js";

// Cycled by index when comparing more loads than named theme colors.
const PALETTE = [C.steel, C.ox, C.brass, "var(--c-series-a)", "var(--c-series-b)", "var(--c-series-c)"];
const SAMPLES = 250;

/** results: [{ id, name, vitalsRadiusIn, solution }]. atYd: the "Compare at" distance (canonical yards) driving the chart's scale. */
export default function CompareChart({ results, atYd }) {
  const { system, dist, len, dSuf, lSuf } = useUnitFormatters();
  const [showVitals, setShowVitals] = useState(false);

  // The whole sample grid is rebuilt only when the loads, the "Compare at"
  // distance, or the unit system change — not on the local `showVitals`
  // toggle or an unrelated re-render. It's SAMPLES * results *
  // sampleAt(~3000-pt path) of work.
  const { series, xs, yDomain, distinctRadii, maxRangeCanonical } = useMemo(() => {
    const distc = (yd) => toDisplay(yd, "distance", system);
    const lenc = (inches) => toDisplay(inches, "length", system);

    // Compared loads carry their own vitals radius (a deer load and a moose
    // load saved separately can genuinely differ) — one band per distinct
    // value present. Loads saved before this field existed have none.
    const distinctRadii = [...new Set(
      results.map((r) => r.vitalsRadiusIn).filter((r) => Number.isFinite(r) && r > 0)
    )].sort((a, b) => a - b);

    // The chart zooms to "Compare at"; falls back to the longest selected
    // load's own range if it's empty/invalid so it never collapses.
    const maxRangeCanonical = Number.isFinite(atYd) && atYd > 0
      ? atYd
      : Math.max(...results.map((r) => r.solution.last.range));

    // A shared x-grid; each load re-sampled onto it (in canonical yards —
    // sampleAt only knows canonical), then converted to display units. A
    // load's line goes null past its own charted distance rather than
    // holding flat, so a shorter-range load doesn't imply data it lacks.
    const xs = [];
    for (let i = 0; i <= SAMPLES; i++) xs.push(+distc((maxRangeCanonical * i) / SAMPLES).toFixed(2));

    let minH = Infinity;
    let maxH = -Infinity;
    const series = results.map((r, idx) => ({
      key: r.id,
      name: r.name,
      color: PALETTE[idx % PALETTE.length],
      points: xs.map((dDisplay, i) => {
        const dCanonical = (maxRangeCanonical * i) / SAMPLES;
        if (dCanonical > r.solution.last.range) return null;
        const p = sampleAt(r.solution.path, dCanonical);
        if (p.y < minH) minH = p.y;
        if (p.y > maxH) maxH = p.y;
        return { x: dDisplay, y: +lenc(p.y).toFixed(2) };
      }),
    }));

    const yDomain = Number.isFinite(minH) ? [lenc(minH - 12), lenc(maxH + 12)] : [lenc(-12), lenc(12)];
    return { series, xs, yDomain, distinctRadii, maxRangeCanonical };
  }, [results, atYd, system]);

  const atInRange = Number.isFinite(atYd) && atYd > 0 && atYd <= maxRangeCanonical;

  const ariaLabel = useMemo(() => {
    const names = series.map((s) => s.name).join(", ");
    const n = series.length;
    return `Line chart overlaying ${n} load${n === 1 ? "" : "s"} (${names}): height above `
      + `the line of sight versus distance, out to ${Math.round(dist(maxRangeCanonical))} ${dSuf}. `
      + `The compare table below has the full numbers.`;
  }, [series, dist, maxRangeCanonical, dSuf]);

  return (
    <div style={{ background: C.card, border: `1.5px solid ${C.rule}`,
                  padding: "14px 10px 6px", marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingLeft: 6, marginBottom: 8 }}>
        <div style={{ ...label, color: C.ink }}>Overlaid trajectories</div>
        <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
          <input type="checkbox" checked={showVitals} onChange={(e) => setShowVitals(e.target.checked)} />
          <span style={{ ...label, color: C.ink }}>Vitals zero</span>
        </label>
      </div>

      <Plot
        height={340}
        legend
        series={series}
        xValues={xs}
        ariaLabel={ariaLabel}
        xDomain={[0, dist(maxRangeCanonical)]}
        yDomain={yDomain}
        xLabel={`DISTANCE (${dSuf.toUpperCase()})`}
        yLabel={`HEIGHT (${lSuf.toUpperCase()})`}
        xFormat={(v) => String(Math.round(v))}
        yFormat={(v) => String(Math.round(v))}
        refLines={[
          { axis: "y", value: 0, color: C.ink, dash: "6 3" },
          ...(atInRange
            ? [{ axis: "x", value: dist(atYd), color: C.brass, label: "COMPARE AT" }]
            : []),
          ...(showVitals
            ? distinctRadii.flatMap((radiusIn) => [
                { axis: "y", value: len(radiusIn), color: C.vitals, label: `${radiusIn}${lSuf.toUpperCase()} VITALS` },
                { axis: "y", value: len(-radiusIn), color: C.vitals },
              ])
            : []),
        ]}
        tooltipRows={(xVal) => {
          const i = xs.indexOf(xVal);
          return series
            .map((s) => {
              const p = i >= 0 ? s.points[i] : null;
              return p ? { label: s.name, value: `${p.y} ${lSuf}`, color: s.color } : null;
            })
            .filter(Boolean);
        }}
      />
    </div>
  );
}
