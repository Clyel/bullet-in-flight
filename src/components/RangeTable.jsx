import React from "react";
import { C, numeric } from "./theme.js";
import { inchesToMOA, inchesToMIL } from "../ballistics/angular.js";
import { useUnits } from "../UnitsContext.jsx";
import { toDisplay, unitSuffix } from "../units.js";

/** Fixed-decimal formatting with a thousands separator, e.g. -432.0 -> "-432.0", 2626 -> "2,626". */
export const commas = (n, digits) => n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });

/** Signed value -> "3.1 L" / "3.1 R" / "0.0", matching the windage column's convention. */
const lr = (value, digits) =>
  Math.abs(value) < 0.5 * 10 ** -digits ? (0).toFixed(digits) : `${commas(Math.abs(value), digits)} ${value < 0 ? "L" : "R"}`;

/** Undefined at zero range (angular correction isn't meaningful at the muzzle). */
export const angular = (val, digits) => (val == null ? "—" : commas(val, digits));

// MOA/MIL are unit-agnostic angles computed straight from canonical
// inches/yards — they never need a metric variant, so those column defs
// intentionally never touch `system`. Exported so DopeChart.jsx (the
// printable card) can build the exact same column set/formatting — no risk
// of the printed numbers drifting from what's on screen.
export const COLUMN_DEFS = {
  range:      { head: (sys) => `Range (${unitSuffix("distance", sys)})`,
                fmt: (r, sys) => commas(toDisplay(r.range, "distance", sys), 0) },
  velocity:   { head: (sys) => `Velocity (${unitSuffix("velocity", sys)})`,
                fmt: (r, sys) => commas(toDisplay(r.velocity, "velocity", sys), 0) },
  energy:     { head: () => "Energy (ft·lb)", fmt: (r) => commas(r.energy, 0) },
  height:     { head: (sys) => `Height (${unitSuffix("length", sys)})`,
                fmt: (r, sys) => commas(toDisplay(r.height, "length", sys), 1),
                color: (r) => (r.height >= 0 ? C.ink : C.steel) },
  heightMOA:  { head: () => "Height (MOA)", fmt: (r) => angular(inchesToMOA(r.height, r.range), 2),
                color: (r) => (r.height >= 0 ? C.ink : C.steel) },
  heightMIL:  { head: () => "Height (MIL)", fmt: (r) => angular(inchesToMIL(r.height, r.range), 1),
                color: (r) => (r.height >= 0 ? C.ink : C.steel) },
  windage:    { head: (sys) => `Windage (${unitSuffix("length", sys)})`,
                fmt: (r, sys) => lr(toDisplay(r.windage, "length", sys), 1) },
  windageMOA: { head: () => "Windage (MOA)", fmt: (r) => (r.range > 0 ? lr(inchesToMOA(r.windage, r.range), 2) : "—") },
  windageMIL: { head: () => "Windage (MIL)", fmt: (r) => (r.range > 0 ? lr(inchesToMIL(r.windage, r.range), 1) : "—") },
  time:       { head: () => "Time (s)", fmt: (r) => r.time.toFixed(3), color: () => C.muted },
  mach:       { head: () => "Mach", fmt: (r) => r.mach.toFixed(2) },
};

/**
 * The column set DopeChart.jsx (the printable card) uses — range/velocity/
 * energy/height plus the same conditional MOA/MIL/windage variants as the
 * live table, but never time/mach as columns (mach still drives the
 * transonic-flag footnote there, just isn't printed as its own column).
 */
export function dopeColumnKeys({ showWindage, showMOA, showMIL }) {
  return [
    "range", "velocity", "energy", "height",
    ...(showMOA ? ["heightMOA"] : []),
    ...(showMIL ? ["heightMIL"] : []),
    ...(showWindage ? ["windage"] : []),
    ...(showWindage && showMOA ? ["windageMOA"] : []),
    ...(showWindage && showMIL ? ["windageMIL"] : []),
  ];
}

export default function RangeTable({ rows, showWindage, showMOA, showMIL }) {
  const { system } = useUnits();
  const keys = [...dopeColumnKeys({ showWindage, showMOA, showMIL }), "time", "mach"];

  return (
    <div style={{ background: C.card, border: `1.5px solid ${C.rule}`, overflowX: "auto" }}>
      <table>
        <thead>
          <tr style={{ background: C.ink }}>
            {keys.map((key, i) => (
              <th key={key} scope="col"
                  style={{ padding: "9px 12px", textAlign: i === 0 ? "left" : "right",
                           font: "600 10px 'Oswald',sans-serif", letterSpacing: ".12em",
                           textTransform: "uppercase", color: C.card, whiteSpace: "nowrap" }}>
                {COLUMN_DEFS[key].head(system)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const subsonic = r.mach < 1.0;
            const transonic = r.mach >= 1.0 && r.mach < 1.2;
            const bg = subsonic
              ? "rgba(140,59,46,.10)"
              : transonic
              ? "rgba(138,106,23,.12)"
              : i % 2
              ? C.cardAlt
              : C.card;
            return (
              <tr key={r.range} style={{ background: bg }}>
                {keys.map((key, ci) => {
                  const col = COLUMN_DEFS[key];
                  const color = key === "mach"
                    ? (subsonic ? C.ox : transonic ? C.brass : C.muted)
                    : col.color ? col.color(r) : C.ink;
                  return (
                    <td key={key}
                        style={{ ...numeric, padding: "7px 12px",
                                 textAlign: ci === 0 ? "left" : "right",
                                 fontWeight: ci === 0 ? 600 : key === "mach" && (subsonic || transonic) ? 600 : 400,
                                 color }}>
                      {col.fmt(r, system)}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
