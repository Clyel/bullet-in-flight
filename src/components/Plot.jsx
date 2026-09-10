import React, { useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { C } from "./theme.js";

// A small dependency-free SVG line plot — enough to replace what
// TrajectoryChart and CompareChart actually use recharts for (a few line
// series, a tight manual y-domain, dashed reference lines / shaded bands /
// marker dots, a hover crosshair + tooltip, an optional legend). recharts
// + its d3 bundle is ~107 KB gzip for exactly this; RecoilBars already set
// the "hand-roll the SVG" precedent in this codebase.
//
// Everything is drawn in the display unit the caller passes in — the plot
// does no unit conversion, same contract recharts had here.

const MONO = "'IBM Plex Mono',monospace";
const OSWALD = "'Oswald',sans-serif";

/** ~`count` round tick values spanning [min,max] (the "nice numbers" algorithm). */
function niceTicks(min, max, count = 5) {
  if (!(max > min)) return [min];
  const span = max - min;
  const step0 = span / count;
  const mag = 10 ** Math.floor(Math.log10(step0));
  const norm = step0 / mag;
  const step = (norm >= 5 ? 10 : norm >= 2 ? 5 : norm >= 1 ? 2 : 1) * mag;
  const ticks = [];
  for (let t = Math.ceil(min / step) * step; t <= max + step * 1e-9; t += step) {
    ticks.push(Math.round(t * 1e6) / 1e6);
  }
  return ticks;
}

/** Build an SVG path from points, breaking the line wherever a point is null. */
function linePath(points, sx, sy) {
  let d = "";
  let pen = false;
  for (const p of points) {
    if (p == null || !Number.isFinite(p.x) || !Number.isFinite(p.y)) { pen = false; continue; }
    d += `${pen ? "L" : "M"}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`;
    pen = true;
  }
  return d;
}

/**
 * @param series    [{ key, name?, color, points: Array<{x,y}|null> }]
 * @param xDomain   [min, max] in display units
 * @param yDomain   [min, max] in display units
 * @param xLabel/yLabel  axis titles (already unit-suffixed)
 * @param xFormat/yFormat (value) => string  for tick + tooltip labels
 * @param refLines  [{ axis:'x'|'y', value, color, label?, labelAnchor?:'start'|'end' }]
 * @param refAreas  [{ x1, x2, color }]   shaded vertical band, x in display units
 * @param refDots   [{ x, y, r, fill, stroke }]
 * @param height    px
 * @param legend    boolean — render series name+swatch above the plot
 * @param tooltipRows (hoveredXValue) => Array<{ label, value, color? }>  tooltip body
 * @param xValues   optional ascending list of x-values (display units) the hover
 *                  crosshair snaps to. Defaults to the union of every series'
 *                  x-values — pass it when the series don't share one grid (e.g.
 *                  Compare, where a shorter-range load's line stops early).
 * @param ariaLabel optional one-line text alternative. Sets role="img" +
 *                  aria-label; the range / compare tables remain the full
 *                  text alternative to the chart.
 */
export default function Plot({
  series, xDomain, yDomain, xLabel, yLabel, xFormat = String, yFormat = String,
  refLines = [], refAreas = [], refDots = [], height = 320, legend = false, tooltipRows,
  xValues, ariaLabel,
}) {
  const clipId = useId();
  const wrapRef = useRef(null);
  const [w, setW] = useState(0);
  const [hoverX, setHoverX] = useState(null); // pixel x within the plot area, or null

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    setW(el.clientWidth);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Reserve room above the plot for the legend row when there is one, so it
  // doesn't sit on top of a series line that reaches the top of the y-range.
  const m = { top: legend ? 34 : 10, right: 22, bottom: 42, left: 54 };
  const iw = Math.max(0, w - m.left - m.right);
  const ih = Math.max(0, height - m.top - m.bottom);
  const [x0, x1] = xDomain;
  const [y0, y1] = yDomain;
  const sx = (v) => m.left + ((v - x0) / (x1 - x0 || 1)) * iw;
  const sy = (v) => m.top + (1 - (v - y0) / (y1 - y0 || 1)) * ih;
  const xTicks = useMemo(() => niceTicks(x0, x1, 6), [x0, x1]);
  const yTicks = useMemo(() => niceTicks(y0, y1, 5), [y0, y1]);

  // Hover: snap to the nearest x among `xValues` if given, else the union of
  // every series' x-values — not just series[0], which on the Compare chart
  // could be a shorter-range load and would strand the crosshair at its last
  // point once the pointer moved past it.
  const hover = useMemo(() => {
    if (hoverX == null || !series.length) return null;
    const xVal = x0 + ((hoverX - m.left) / (iw || 1)) * (x1 - x0);
    let best = null;
    let bestErr = Infinity;
    const consider = (x) => {
      if (x == null || !Number.isFinite(x)) return;
      const err = Math.abs(x - xVal);
      if (err < bestErr) { bestErr = err; best = x; }
    };
    if (xValues) {
      for (const x of xValues) consider(x);
    } else {
      for (const s of series) for (const p of s.points) if (p != null) consider(p.x);
    }
    return best == null ? null : { xValue: best, px: sx(best) };
  }, [hoverX, series, xValues, x0, x1, iw, m.left]);

  const setHoverFromClientX = (target, clientX) => {
    const px = clientX - target.getBoundingClientRect().left;
    setHoverX(px >= m.left && px <= m.left + iw ? px : null);
  };
  const onMove = (e) => setHoverFromClientX(e.currentTarget, e.clientX);
  // Touch: drag across the plot to inspect (mobile has no hover). Don't
  // preventDefault — a plain tap should still scroll the page normally.
  const onTouch = (e) => e.touches[0] && setHoverFromClientX(e.currentTarget, e.touches[0].clientX);

  const rows = hover && tooltipRows ? tooltipRows(hover.xValue) : null;
  // Tooltip box sits left or right of the crosshair depending on room.
  const tipRight = hover ? hover.px < m.left + iw / 2 : true;

  return (
    <div ref={wrapRef} style={{ position: "relative", width: "100%", height }}>
      {legend && (
        <div style={{ position: "absolute", top: 0, left: m.left, right: m.right, display: "flex",
                      flexWrap: "wrap", gap: "2px 14px", font: `400 11px ${OSWALD}`, color: C.muted, zIndex: 1 }}>
          {series.map((s) => (
            <span key={s.key} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
              <i style={{ width: 12, height: 2.5, background: s.color, display: "inline-block" }} />
              {s.name ?? s.key}
            </span>
          ))}
        </div>
      )}

      {w > 0 && (
        <svg width={w} height={height} onMouseMove={onMove} onMouseLeave={() => setHoverX(null)}
             onTouchStart={onTouch} onTouchMove={onTouch}
             {...(ariaLabel ? { role: "img", "aria-label": ariaLabel } : {})}
             style={{ display: "block", overflow: "visible" }}>
          {/* Clip everything data-driven to the plot rect. The domains are
              computed from the data today so nothing spills, but a refArea or
              refLine whose value fell outside the domain would otherwise draw
              across the margins and axis labels. */}
          <defs>
            <clipPath id={clipId}>
              <rect x={m.left} y={m.top} width={iw} height={ih} />
            </clipPath>
          </defs>

          <g clipPath={`url(#${clipId})`}>
          {/* shaded bands */}
          {refAreas.map((a, i) => (
            <rect key={`a${i}`} x={sx(Math.min(a.x1, a.x2))} y={m.top}
                  width={Math.abs(sx(a.x2) - sx(a.x1))} height={ih} fill={a.color} fillOpacity={0.16} />
          ))}
          </g>

          {/* grid */}
          {xTicks.map((t) => (
            <line key={`gx${t}`} x1={sx(t)} x2={sx(t)} y1={m.top} y2={m.top + ih}
                  stroke={C.rule} strokeDasharray="2 4" />
          ))}
          {yTicks.map((t) => (
            <line key={`gy${t}`} x1={m.left} x2={m.left + iw} y1={sy(t)} y2={sy(t)}
                  stroke={C.rule} strokeDasharray="2 4" />
          ))}

          <g clipPath={`url(#${clipId})`}>
          {/* reference lines */}
          {refLines.map((r, i) => {
            const isX = r.axis === "x";
            const x1p = isX ? sx(r.value) : m.left;
            const x2p = isX ? sx(r.value) : m.left + iw;
            const y1p = isX ? m.top : sy(r.value);
            const y2p = isX ? m.top + ih : sy(r.value);
            return (
              <g key={`r${i}`}>
                <line x1={x1p} x2={x2p} y1={y1p} y2={y2p} stroke={r.color}
                      strokeWidth={1.4} strokeDasharray={r.dash ?? "3 3"} />
                {r.label && (
                  <text x={isX ? x1p + 3 : x2p - 3} y={isX ? m.top + 11 : y1p - 3}
                        textAnchor={isX ? "start" : "end"} fill={r.color}
                        style={{ font: `600 10px ${OSWALD}`, letterSpacing: "0.1em" }}>
                    {r.label}
                  </text>
                )}
              </g>
            );
          })}

          {/* series */}
          {series.map((s) => (
            <path key={s.key} d={linePath(s.points, sx, sy)} fill="none"
                  stroke={s.color} strokeWidth={2.2} strokeLinejoin="round" />
          ))}
          </g>

          {/* marker dots — always in-domain by construction, drawn unclipped so
              a dot sitting on the axis isn't sliced by the clip rect edge */}
          {refDots.map((d, i) => (
            <circle key={`d${i}`} cx={sx(d.x)} cy={sy(d.y)} r={d.r ?? 3.5}
                    fill={d.fill} stroke={d.stroke} strokeWidth={d.strokeWidth ?? 1.4} />
          ))}

          {/* axes */}
          <line x1={m.left} x2={m.left + iw} y1={m.top + ih} y2={m.top + ih} stroke={C.rule} />
          <line x1={m.left} x2={m.left} y1={m.top} y2={m.top + ih} stroke={C.rule} />
          {xTicks.map((t) => (
            <text key={`tx${t}`} x={sx(t)} y={m.top + ih + 16} textAnchor="middle"
                  fill={C.muted} style={{ font: `400 11px ${MONO}` }}>{xFormat(t)}</text>
          ))}
          {yTicks.map((t) => (
            <text key={`ty${t}`} x={m.left - 8} y={sy(t) + 4} textAnchor="end"
                  fill={C.muted} style={{ font: `400 11px ${MONO}` }}>{yFormat(t)}</text>
          ))}
          <text x={m.left + iw / 2} y={height - 6} textAnchor="middle" fill={C.muted}
                style={{ font: `600 10px ${OSWALD}`, letterSpacing: "0.14em" }}>{xLabel}</text>
          <text x={14} y={m.top + ih / 2} textAnchor="middle" fill={C.muted}
                transform={`rotate(-90 14 ${m.top + ih / 2})`}
                style={{ font: `600 10px ${OSWALD}`, letterSpacing: "0.14em" }}>{yLabel}</text>

          {/* crosshair */}
          {hover && (
            <line x1={hover.px} x2={hover.px} y1={m.top} y2={m.top + ih}
                  stroke={C.ink} strokeWidth={1} strokeDasharray="2 2" />
          )}
        </svg>
      )}

      {rows && rows.length > 0 && (
        <div style={{
          position: "absolute", top: m.top + 4,
          [tipRight ? "left" : "right"]: tipRight ? hover.px + 10 : w - hover.px + 10,
          background: C.card, border: `1.5px solid ${C.ink}`, padding: "5px 8px", pointerEvents: "none",
          font: `400 12px ${MONO}`, color: C.ink, whiteSpace: "nowrap", zIndex: 2,
        }}>
          <div style={{ color: C.muted, marginBottom: 2 }}>{xFormat(hover.xValue)}</div>
          {rows.map((row, i) => (
            <div key={i} style={{ display: "flex", gap: 10, justifyContent: "space-between" }}>
              <span style={{ color: row.color ?? C.muted }}>{row.label}</span>
              <span>{row.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
