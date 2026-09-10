import React from "react";
import { C, numeric } from "./theme.js";
import { sampleAt, energyFtLb } from "../ballistics/solver.js";
import { useUnitFormatters } from "../useUnitFormatters.js";
import { commas } from "./RangeTable.jsx";

/** results: [{ id, name, grains, solution }]. atYd: the single distance to compare at (canonical yards). */
export default function CompareTable({ results, atYd }) {
  const { dist, vel, len, energy, dSuf, vSuf, lSuf, eSuf } = useUnitFormatters();

  return (
    <div style={{ background: C.card, border: `1.5px solid ${C.rule}`, overflowX: "auto" }}>
      <table>
        <thead>
          <tr style={{ background: C.ink }}>
            {["Load", `Muzzle Velocity (${vSuf})`, `Muzzle Energy (${eSuf})`,
              `Velocity at Range (${vSuf})`, `Energy at Range (${eSuf})`, `Height (${lSuf})`].map((head, i) => (
              <th key={head} scope="col"
                  style={{ padding: "9px 12px", textAlign: i === 0 ? "left" : "right",
                           font: "600 10px 'Oswald',sans-serif", letterSpacing: ".12em",
                           textTransform: "uppercase", color: C.card, whiteSpace: "nowrap" }}>
                {head}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {results.map((r, i) => {
            const beyond = atYd > r.solution.last.range;
            const p = beyond ? null : sampleAt(r.solution.path, atYd);
            // Muzzle is range 0 -- always within any load's charted distance,
            // so this stays populated even for a row whose "at range" columns
            // fall back to the "beyond charted distance" message below.
            const muzzle = sampleAt(r.solution.path, 0);
            const bg = i % 2 ? C.cardAlt : C.card;
            return (
              <tr key={r.id} style={{ background: bg }}>
                <td style={{ ...numeric, padding: "7px 12px", fontWeight: 600 }}>{r.name}</td>
                <td style={{ ...numeric, padding: "7px 12px", textAlign: "right" }}>{commas(vel(muzzle.v), 0)}</td>
                <td style={{ ...numeric, padding: "7px 12px", textAlign: "right" }}>{commas(energy(energyFtLb(r.grains, muzzle.v)), 0)}</td>
                {beyond ? (
                  <td colSpan={3} style={{ ...numeric, padding: "7px 12px", textAlign: "right", color: C.muted }}>
                    beyond this load&rsquo;s charted distance ({dist(r.solution.last.range).toFixed(0)} {dSuf})
                  </td>
                ) : (
                  <>
                    <td style={{ ...numeric, padding: "7px 12px", textAlign: "right" }}>{commas(vel(p.v), 0)}</td>
                    <td style={{ ...numeric, padding: "7px 12px", textAlign: "right" }}>{commas(energy(energyFtLb(r.grains, p.v)), 0)}</td>
                    <td style={{ ...numeric, padding: "7px 12px", textAlign: "right",
                                 color: p.y >= 0 ? C.ink : C.steel }}>{commas(len(p.y), 1)}</td>
                  </>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
