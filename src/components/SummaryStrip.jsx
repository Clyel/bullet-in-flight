import React from "react";
import { C, label } from "./theme.js";
import { useUnitFormatters } from "../useUnitFormatters.js";

export default function SummaryStrip({ solution, maxRangeYd }) {
  const { dist, vel, len, energy, dSuf, vSuf, lSuf, eSuf } = useUnitFormatters();
  const { last, crossings, apex, subsonicYd } = solution;
  const near = crossings[0];

  const cells = [
    [`At ${Math.round(dist(maxRangeYd))} ${dSuf}`, `${Math.round(vel(last.velocity))} ${vSuf}`],
    ["Energy there", `${Math.round(energy(last.energy))} ${eSuf}`],
    ["Height there", `${len(last.height).toFixed(1)} ${lSuf}`],
    ["Max ordinate", `${len(apex.height).toFixed(1)} ${lSuf} @ ${Math.round(dist(apex.range))} ${dSuf}`],
    ["Near zero", near != null ? `${dist(near).toFixed(0)} ${dSuf}` : "—"],
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
