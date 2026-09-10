import React, { useMemo, useState } from "react";
import Plot from "./Plot.jsx";
import { C, label } from "./theme.js";
import { toDisplay } from "../units.js";
import { useUnitFormatters } from "../useUnitFormatters.js";
import { vitalsWindow, optimalSightIn } from "../ballistics/vitalsWindow.js";

export default function TrajectoryChart({ solution, maxRangeYd, vitalsRadiusIn, baseBallisticParams }) {
  const { system, dist, len, dSuf, lSuf, vSuf } = useUnitFormatters();
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
  // the toggle is on. `baseBallisticParams` is memoised by the caller
  // (Calculator) so it's stable per input set, hence safe as an identity
  // dep here instead of stringifying it every render.
  const optimal = useMemo(() => {
    if (!showOptimal || !hasVitalsRadius) return { result: null, error: null };
    try {
      return { result: optimalSightIn(baseBallisticParams, vitalsRadiusIn), error: null };
    } catch (e) {
      return { result: null, error: e.message };
    }
  }, [showOptimal, hasVitalsRadius, vitalsRadiusIn, baseBallisticParams]);

  // Thin the integration path down to something a chart can draw, and find
  // the y-extent for a tight domain (not recharts' auto-padded round
  // numbers, which could balloon a +2/-432in path out to -900/+2700).
  // Rebuilt only when the path or unit system changes — not on the local
  // vitals/optimal toggles or an unrelated parent re-render.
  const { data, yDomain } = useMemo(() => {
    const distc = (yd) => toDisplay(yd, "distance", system);
    const lenc = (inches) => toDisplay(inches, "length", system);

    const stride = Math.max(1, Math.ceil(path.length / 400));
    const data = path.filter((_, i) => i % stride === 0).map((p) => ({
      d: +distc(p.x).toFixed(2),
      h: +lenc(p.y).toFixed(2),
      v: Math.round(toDisplay(p.v, "velocity", system)),
      mach: +p.mach.toFixed(2),
    }));
    const tail = path[path.length - 1];
    data.push({ d: +distc(tail.x).toFixed(2), h: +lenc(tail.y).toFixed(2),
                v: Math.round(toDisplay(tail.v, "velocity", system)), mach: +tail.mach.toFixed(2) });

    let minH = Infinity;
    let maxH = -Infinity;
    for (const p of path) {
      if (p.y < minH) minH = p.y;
      if (p.y > maxH) maxH = p.y;
    }
    return { data, yDomain: [lenc(minH - 12), lenc(maxH + 12)] };
  }, [path, system]);

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

      <Plot
        height={310}
        series={[{ key: "h", color: C.steel, points: data.map((p) => ({ x: p.d, y: p.h })) }]}
        xDomain={[0, dist(maxRangeYd)]}
        yDomain={yDomain}
        xLabel={`DISTANCE (${dSuf.toUpperCase()})`}
        yLabel={`HEIGHT (${lSuf.toUpperCase()})`}
        xFormat={(v) => String(Math.round(v))}
        yFormat={(v) => String(Math.round(v))}
        refAreas={[
          transonicYd != null && {
            x1: dist(transonicYd),
            x2: subsonicYd != null ? dist(subsonicYd) : dist(maxRangeYd),
            color: C.brass,
          },
          subsonicYd != null && { x1: dist(subsonicYd), x2: dist(maxRangeYd), color: C.ox },
        ].filter(Boolean)}
        refLines={[
          { axis: "y", value: 0, color: C.ink, dash: "6 3" },
          ...(showVitals && hasVitalsRadius
            ? [
                { axis: "y", value: len(vitalsRadiusIn), color: C.vitals, label: "VITALS ZERO" },
                { axis: "y", value: len(-vitalsRadiusIn), color: C.vitals },
              ]
            : []),
        ]}
        refDots={[
          ...crossings.map((x) => ({
            x: dist(x), y: 0, r: 4, fill: C.card, stroke: C.ink, strokeWidth: 1.6,
          })),
          {
            x: dist(apex.range), y: len(apex.height), r: 3.5,
            fill: C.brass, stroke: C.ink, strokeWidth: 1.2,
          },
        ]}
        tooltipRows={(xVal) => {
          const p = data.find((row) => row.d === xVal) ?? data[data.length - 1];
          return [
            { label: "Height", value: `${p.h} ${lSuf}`, color: C.steel },
            { label: "Velocity", value: `${p.v} ${vSuf}` },
            { label: "Mach", value: String(p.mach) },
          ];
        }}
      />

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
