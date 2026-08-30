import React, { useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine,
} from "recharts";
import { C, label } from "./theme.js";
import { sampleAt } from "../ballistics/solver.js";
import { useUnits } from "../UnitsContext.jsx";
import { toDisplay, unitSuffix } from "../units.js";

// Cycled by index when comparing more loads than named theme colors.
const PALETTE = [C.steel, C.ox, C.brass, "#5B6B41", "#5B4B6E", "#A45A2A"];
const SAMPLES = 250;

/** results: [{ id, name, vitalsRadiusIn, solution }]. atYd: the "Compare at" distance (canonical yards) driving the chart's scale. */
export default function CompareChart({ results, atYd }) {
  const { system } = useUnits();
  const [showVitals, setShowVitals] = useState(false);
  const dist = (yd) => toDisplay(yd, "distance", system);
  const len = (inches) => toDisplay(inches, "length", system);
  const dSuf = unitSuffix("distance", system);
  const lSuf = unitSuffix("length", system);

  // Compared loads carry their own vitals radius (a deer load and a moose
  // load saved separately can genuinely differ) — draw one band per
  // distinct value present rather than assuming they all match. Loads
  // saved before this field existed have no radius and just don't get a
  // band, instead of breaking the chart for everyone else in the overlay.
  const distinctRadii = [...new Set(
    results.map((r) => r.vitalsRadiusIn).filter((r) => Number.isFinite(r) && r > 0)
  )].sort((a, b) => a - b);

  // The chart zooms to whatever "Compare at" is set to, so typing a closer
  // distance actually zooms in instead of always showing the full charted
  // range. Falls back to the longest selected load's own range if "Compare
  // at" is empty/invalid, so the chart never collapses to nothing.
  const maxRangeCanonical = Number.isFinite(atYd) && atYd > 0
    ? atYd
    : Math.max(...results.map((r) => r.solution.last.range));

  // One shared x-grid so every line's series lives in a single recharts
  // `data` array (needed for the tooltip/crosshair to work across series) —
  // each load's own path is re-sampled onto it via the solver's sampleAt,
  // in canonical yards (sampleAt only understands canonical), then both
  // axes are converted to the display unit for the row itself. A load's
  // line stops (null) past its own charted distance rather than holding
  // flat, so a shorter-range load doesn't imply data it doesn't have.
  const data = [];
  let minH = Infinity;
  let maxH = -Infinity;
  for (let i = 0; i <= SAMPLES; i++) {
    const dCanonical = (maxRangeCanonical * i) / SAMPLES;
    const row = { d: +dist(dCanonical).toFixed(2) };
    for (const r of results) {
      if (dCanonical <= r.solution.last.range) {
        const p = sampleAt(r.solution.path, dCanonical);
        row[r.id] = +len(p.y).toFixed(2);
        if (p.y < minH) minH = p.y;
        if (p.y > maxH) maxH = p.y;
      } else {
        row[r.id] = null;
      }
    }
    data.push(row);
  }
  const yDomain = Number.isFinite(minH) ? [len(minH - 12), len(maxH + 12)] : [len(-12), len(12)];

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

      <div style={{ width: "100%", height: 340 }}>
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 8, right: 20, bottom: 30, left: 6 }}>
            <CartesianGrid stroke={C.rule} strokeDasharray="2 4" />
            <ReferenceLine y={0} stroke={C.ink} strokeWidth={1.4} strokeDasharray="6 3" />

            {Number.isFinite(atYd) && atYd > 0 && atYd <= maxRangeCanonical && (
              <ReferenceLine x={+dist(atYd).toFixed(2)} stroke={C.brass} strokeWidth={1.4} strokeDasharray="3 3"
                             label={{ value: "COMPARE AT", position: "insideTopRight",
                                      fill: C.brass, fontSize: 10, letterSpacing: "0.1em",
                                      fontFamily: "'Oswald',sans-serif" }} />
            )}

            {showVitals && distinctRadii.map((radiusIn) => (
              <React.Fragment key={radiusIn}>
                <ReferenceLine y={len(radiusIn)} stroke={C.vitals} strokeWidth={1.4} strokeDasharray="3 3"
                               label={{ value: `${radiusIn}${lSuf.toUpperCase()} VITALS`, position: "insideBottomRight",
                                        fill: C.vitals, fontSize: 10, letterSpacing: "0.1em",
                                        fontFamily: "'Oswald',sans-serif" }} />
                <ReferenceLine y={len(-radiusIn)} stroke={C.vitals} strokeWidth={1.4} strokeDasharray="3 3" />
              </React.Fragment>
            ))}

            <XAxis dataKey="d" type="number" domain={[0, dist(maxRangeCanonical)]}
              tick={{ fill: C.muted, fontSize: 11, fontFamily: "'IBM Plex Mono',monospace" }}
              stroke={C.rule}
              label={{ value: `DISTANCE (${dSuf.toUpperCase()})`, position: "bottom", offset: 8,
                       fill: C.muted, fontSize: 10, letterSpacing: "0.14em",
                       fontFamily: "'Oswald',sans-serif" }} />
            <YAxis width={54} domain={yDomain} allowDataOverflow
              tick={{ fill: C.muted, fontSize: 11, fontFamily: "'IBM Plex Mono',monospace" }}
              tickFormatter={(val) => Math.round(val)}
              stroke={C.rule}
              label={{ value: `HEIGHT (${lSuf.toUpperCase()})`, angle: -90, position: "insideLeft", offset: 14,
                       fill: C.muted, fontSize: 10, letterSpacing: "0.14em",
                       fontFamily: "'Oswald',sans-serif" }} />

            <Tooltip
              contentStyle={{ background: C.card, border: `1.5px solid ${C.ink}`,
                              borderRadius: 0, font: "400 12px 'IBM Plex Mono',monospace" }}
              labelFormatter={(d) => `${d} ${dSuf}`}
              formatter={(val) => (val == null ? null : [`${val} ${lSuf}`, undefined])} />
            <Legend verticalAlign="top" height={42}
                    wrapperStyle={{ fontSize: 11, fontFamily: "'IBM Plex Sans',sans-serif", color: C.muted }} />

            {results.map((r, i) => (
              <Line key={r.id} type="monotone" dataKey={r.id} name={r.name}
                    stroke={PALETTE[i % PALETTE.length]} strokeWidth={2.2}
                    dot={false} connectNulls={false} isAnimationActive={false} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
