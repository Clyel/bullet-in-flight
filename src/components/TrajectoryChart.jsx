import React, { useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceArea, ReferenceLine, ReferenceDot,
} from "recharts";
import { C, label } from "./theme.js";
import { useUnits } from "../UnitsContext.jsx";
import { toDisplay, unitSuffix } from "../units.js";

const VITALS_RADIUS_IN = 3; // canonical — converted to the display unit below, same as every other length

export default function TrajectoryChart({ solution, maxRangeYd }) {
  const { system } = useUnits();
  const { path, transonicYd, subsonicYd, apex, crossings } = solution;
  const [showVitals, setShowVitals] = useState(false);

  const dist = (yd) => toDisplay(yd, "distance", system);
  const len = (inches) => toDisplay(inches, "length", system);
  const dSuf = unitSuffix("distance", system);
  const lSuf = unitSuffix("length", system);
  const vSuf = unitSuffix("velocity", system);

  // Thin the integration path down to something a chart can draw. Plotted
  // in display units from the start, so everything downstream (domain,
  // reference lines) can just work with what's already on-screen.
  const stride = Math.max(1, Math.ceil(path.length / 400));
  const data = path.filter((_, i) => i % stride === 0).map((p) => ({
    d: +dist(p.x).toFixed(2),
    h: +len(p.y).toFixed(2),
    v: Math.round(toDisplay(p.v, "velocity", system)),
    mach: +p.mach.toFixed(2),
  }));
  const tail = path[path.length - 1];
  data.push({ d: +dist(tail.x).toFixed(2), h: +len(tail.y).toFixed(2),
              v: Math.round(toDisplay(tail.v, "velocity", system)), mach: +tail.mach.toFixed(2) });

  // Y domain: tight around the actual trajectory, not recharts' auto-padded
  // "nice round numbers" (which could balloon a +2/-432in path out to a
  // -900/+2700 axis). 12in of headroom (canonical, converted below) past
  // whichever extreme it reaches.
  let minH = Infinity;
  let maxH = -Infinity;
  for (const p of path) {
    if (p.y < minH) minH = p.y;
    if (p.y > maxH) maxH = p.y;
  }
  const yDomain = [len(minH - 12), len(maxH + 12)];

  const swatch = (color) => ({
    display: "inline-block", width: 10, height: 10,
    background: color, opacity: 0.5, marginRight: 5,
  });

  return (
    <div style={{ background: C.card, border: `1.5px solid ${C.rule}`,
                  padding: "14px 10px 6px", marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingLeft: 6, marginBottom: 8 }}>
        <div style={{ ...label, color: C.ink }}>Flight path relative to line of sight</div>
        <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
          <input type="checkbox" checked={showVitals} onChange={(e) => setShowVitals(e.target.checked)} />
          <span style={{ ...label, color: C.ink }}>Vitals zero</span>
        </label>
      </div>

      <div style={{ width: "100%", height: 310 }}>
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 8, right: 20, bottom: 24, left: 6 }}>
            <CartesianGrid stroke={C.rule} strokeDasharray="2 4" />

            {transonicYd != null && (
              <ReferenceArea yAxisId="height" x1={dist(transonicYd)} x2={subsonicYd != null ? dist(subsonicYd) : dist(maxRangeYd)}
                             fill={C.brass} fillOpacity={0.16} />
            )}
            {subsonicYd != null && (
              <ReferenceArea yAxisId="height" x1={dist(subsonicYd)} x2={dist(maxRangeYd)} fill={C.ox} fillOpacity={0.16} />
            )}

            <ReferenceLine yAxisId="height" y={0} stroke={C.ink} strokeWidth={1.4} strokeDasharray="6 3" />

            {showVitals && (
              <>
                <ReferenceLine yAxisId="height" y={len(VITALS_RADIUS_IN)} stroke={C.vitals}
                               strokeWidth={1.4} strokeDasharray="3 3"
                               label={{ value: "VITALS ZERO", position: "insideBottomRight",
                                        fill: C.vitals, fontSize: 10, letterSpacing: "0.1em",
                                        fontFamily: "'Oswald',sans-serif" }} />
                <ReferenceLine yAxisId="height" y={len(-VITALS_RADIUS_IN)} stroke={C.vitals}
                               strokeWidth={1.4} strokeDasharray="3 3" />
              </>
            )}

            <XAxis dataKey="d" type="number" domain={[0, dist(maxRangeYd)]}
              tick={{ fill: C.muted, fontSize: 11, fontFamily: "'IBM Plex Mono',monospace" }}
              stroke={C.rule}
              label={{ value: `DISTANCE (${dSuf.toUpperCase()})`, position: "insideBottom", offset: -14,
                       fill: C.muted, fontSize: 10, letterSpacing: "0.14em",
                       fontFamily: "'Oswald',sans-serif" }} />
            <YAxis yAxisId="height" width={54} domain={yDomain} allowDataOverflow
              tick={{ fill: C.muted, fontSize: 11, fontFamily: "'IBM Plex Mono',monospace" }}
              tickFormatter={(val) => Math.round(val)}
              stroke={C.rule}
              label={{ value: `HEIGHT (${lSuf.toUpperCase()})`, angle: -90, position: "insideLeft", offset: 14,
                       fill: C.muted, fontSize: 10, letterSpacing: "0.14em",
                       fontFamily: "'Oswald',sans-serif" }} />
            {/* Hidden axis for the velocity/mach tooltip-only series, so their much
                larger range (fps, up to muzzle velocity) can't stretch the height axis. */}
            <YAxis yAxisId="helper" hide domain={["auto", "auto"]} />

            <Tooltip
              contentStyle={{ background: C.card, border: `1.5px solid ${C.ink}`,
                              borderRadius: 0, font: "400 12px 'IBM Plex Mono',monospace" }}
              labelFormatter={(d) => `${d} ${dSuf}`}
              formatter={(val, key) => {
                if (key === "h") return [`${val} ${lSuf}`, "Height"];
                if (key === "v") return [`${val} ${vSuf}`, "Velocity"];
                return [val, "Mach"];
              }} />

            <Line yAxisId="height" type="monotone" dataKey="h" stroke={C.steel} strokeWidth={2.2}
                  dot={false} isAnimationActive={false} />
            <Line yAxisId="helper" dataKey="v" stroke="none" dot={false} legendType="none" isAnimationActive={false} />
            <Line yAxisId="helper" dataKey="mach" stroke="none" dot={false} legendType="none" isAnimationActive={false} />

            {crossings.map((x, i) => (
              <ReferenceDot key={i} yAxisId="height" x={+dist(x).toFixed(2)} y={0} r={4}
                            fill={C.card} stroke={C.ink} strokeWidth={1.6} />
            ))}
            <ReferenceDot yAxisId="height" x={+dist(apex.range).toFixed(2)} y={+len(apex.height).toFixed(2)} r={3.5}
                          fill={C.brass} stroke={C.ink} strokeWidth={1.2} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", padding: "4px 6px 8px",
                    font: "400 10.5px 'IBM Plex Sans',sans-serif", color: C.muted }}>
        <span><i style={swatch(C.brass)} />Transonic (Mach 1.2 to 1.0)</span>
        <span><i style={swatch(C.ox)} />Subsonic</span>
        {showVitals && <span><i style={swatch(C.vitals)} />Vitals zero: &plusmn;{len(VITALS_RADIUS_IN).toFixed(1)} {lSuf}</span>}
        <span>Dashed line = line of sight</span>
        <span>Open dots = zeros, filled dot = max ordinate</span>
      </div>
    </div>
  );
}
