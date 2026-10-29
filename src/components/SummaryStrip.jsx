import React from "react";
import { C, label } from "./theme.js";
import { useUnitFormatters } from "../useUnitFormatters.js";
import { commas } from "../formatNumbers.js";

export default function SummaryStrip({ solution, row }) {
  const { dist, vel, len, energy, dSuf, vSuf, lSuf, eSuf } = useUnitFormatters();
  const { crossings, apex, subsonicYd } = solution;
  const near = crossings[0];

  const cells = [
    [`Speed at ${Math.round(dist(row.range))} ${dSuf}`, `${Math.round(vel(row.velocity))} ${vSuf}`],
    ["Energy there", `${Math.round(energy(row.energy))} ${eSuf}`],
    ["Height there", `${commas(len(row.height), 1)} ${lSuf}`],
    ["Peak height", `${len(apex.height).toFixed(1)} ${lSuf} @ ${Math.round(dist(apex.range))} ${dSuf}`],
    ["Near zero (rising)", near != null ? `${dist(near).toFixed(0)} ${dSuf}` : "—"],
    ["Goes subsonic", subsonicYd != null ? `${Math.round(dist(subsonicYd))} ${dSuf}` : "beyond range"],
  ];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(125px,1fr))",
                  gap: 1, background: C.rule, border: `1.5px solid ${C.rule}`, marginBottom: 16 }}>
      {cells.map(([k, val]) => (
        <div key={k} style={{ background: C.card, padding: "10px 12px" }}>
          <div style={label}>{k}</div>
          <div style={{ font: "500 16px 'IBM Plex Mono',monospace", marginTop: 3, color: C.ink }}>
            {val}
          </div>
        </div>
      ))}
    </div>
  );
}
