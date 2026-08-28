import React, { useMemo, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceArea, ReferenceLine, ReferenceDot,
} from "recharts";
import { C, label } from "./theme.js";
import { useUnits } from "../UnitsContext.jsx";
import { toDisplay, unitSuffix } from "../units.js";
import { vitalsWindow, optimalSightIn } from "../ballistics/vitalsWindow.js";

export default function TrajectoryChart({ solution, maxRangeYd, vitalsRadiusIn, baseBallisticParams }) {
  const { system } = useUnits();
  const { path, transonicYd, subsonicYd, apex, crossings } = solution;
  const [showVitals, setShowVitals] = useState(false);
  const [showOptimal, setShowOptimal] = useState(false);

  const hasVitalsRadius = Number.isFinite(vitalsRadiusIn) && vitalsRadiusIn > 0;

  // Cheap — a single scan of the already-computed path. Live, no toggle needed.
  const currentWindow = useMemo(
    () => (hasVitalsRadius ? vitalsWindow(path, vitalsRadiusIn) : null),
    [path, vitalsRadiusIn, hasVitalsRadius]
  );

  // Not cheap (an outer search wrapping the solver) — only computed while
  // the toggle is actually on, and only recomputed when the ammo/sights/air
  // or radius actually change (JSON.stringify keeps this from re-running on
  // every unrelated re-render, matching the pattern already used for the
  // main solve in Calculator.jsx).
  const optimal = useMemo(() => {
    if (!showOptimal || !hasVitalsRadius) return { result: null, error: null };
    try {
      return { result: optimalSightIn(baseBallisticParams, vitalsRadiusIn), error: null };
    } catch (e) {
      return { result: null, error: e.message };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showOptimal, hasVitalsRadius, vitalsRadiusIn, JSON.stringify(baseBallisticParams)]);

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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap",
                    gap: 10, paddingLeft: 6, marginBottom: 8 }}>
        <div style={{ ...label, color: C.ink }}>Flight path relative to line of sight</div>
        <div style={{ display: "flex", gap: 14 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
            <input type="checkbox" checked={showVitals} onChange={(e) => setShowVitals(e.target.checked)} />
            <span style={{ ...label, color: C.ink }}>Vitals zero</span>
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 6,
                          cursor: hasVitalsRadius ? "pointer" : "default", opacity: hasVitalsRadius ? 1 : 0.4 }}>
            <input type="checkbox" checked={showOptimal} disabled={!hasVitalsRadius}
                   onChange={(e) => setShowOptimal(e.target.checked)} />
            <span style={{ ...label, color: C.ink }}>Optimal sight-in</span>
          </label>
        </div>
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

            {showVitals && hasVitalsRadius && (
              <>
                <ReferenceLine yAxisId="height" y={len(vitalsRadiusIn)} stroke={C.vitals}
                               strokeWidth={1.4} strokeDasharray="3 3"
                               label={{ value: "VITALS ZERO", position: "insideBottomRight",
                                        fill: C.vitals, fontSize: 10, letterSpacing: "0.1em",
                                        fontFamily: "'Oswald',sans-serif" }} />
                <ReferenceLine yAxisId="height" y={len(-vitalsRadiusIn)} stroke={C.vitals}
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
        {showVitals && hasVitalsRadius && (
          <span><i style={swatch(C.vitals)} />Vitals zero: &plusmn;{len(vitalsRadiusIn).toFixed(1)} {lSuf}</span>
        )}
        <span>Dashed line = line of sight</span>
        <span>Open dots = zeros, filled dot = max ordinate</span>
      </div>

      {hasVitalsRadius && currentWindow && (
        <div style={{ padding: "0 6px 10px", font: "400 11.5px/1.5 'IBM Plex Mono',monospace", color: C.ink }}>
          Vitals window at your current zero: {dist(currentWindow.spanYd).toFixed(0)} {dSuf}{" "}
          ({dist(currentWindow.entryYd).toFixed(0)}&ndash;{dist(currentWindow.exitYd).toFixed(0)} {dSuf})
          {currentWindow.exitReason === "high" && " — cut short by poking above the vitals radius, not by falling below it"}
        </div>
      )}

      {showOptimal && hasVitalsRadius && (
        <div style={{ padding: "0 6px 10px", font: "400 11.5px/1.5 'IBM Plex Mono',monospace", color: C.vitals }}>
          {optimal.error
            ? `Optimal sight-in: ${optimal.error}`
            : optimal.result && (
                <>
                  Optimal sight-in: {dist(optimal.result.zeroRangeYd).toFixed(0)} {dSuf} zero &rarr; vitals window{" "}
                  {dist(optimal.result.spanYd).toFixed(0)} {dSuf}{" "}
                  ({dist(optimal.result.entryYd).toFixed(0)}&ndash;{dist(optimal.result.exitYd).toFixed(0)} {dSuf})
                </>
              )}
        </div>
      )}
    </div>
  );
}
