import React from "react";
import { C } from "./theme.js";
import { useUnitFormatters } from "../useUnitFormatters.js";
import { describeShot } from "../describeShot.js";
import { inclinedEquivalentRange } from "../ballistics/inclineComp.js";

/**
 * The answer in a sentence, above the tiles and chart: "Zeroed at 200 yd, at
 * [300 yd] your bullet lands 14.8 in (4.7 MOA) below where you aimed." The
 * distance is a dropdown of the range table's own rows, so a shooter who wants
 * 300 yd doesn't have to know the tiles follow "Distance out to" (which lives
 * in a collapsible section). The picked row lives in Calculator, which also
 * feeds it to the speed/energy/height tiles so the page never shows two
 * different answers at once.
 */
export default function AnswerLine({ choices, row, onPick, zeroYd, shotAngleDeg, showMIL, showMOA }) {
  const { system, dist, dSuf } = useUnitFormatters();
  if (!row) return null;

  // Metric shooters think in mils; otherwise MOA unless only MIL is switched on.
  const angle = showMOA ? "MOA" : showMIL || system === "metric" ? "MIL" : "MOA";
  const { height, wind } = describeShot(row, { system, angle });

  // These numbers are for a level shot. Same threshold as the note below the tiles.
  const slope = Math.abs(shotAngleDeg);
  const inclined = Number.isFinite(slope) && slope >= 5 && slope < 90;
  const holdYd = inclined ? inclinedEquivalentRange(row.range, slope) : null;

  return (
    <div style={{ marginBottom: 14, padding: "10px 12px", background: C.card, border: `1.5px solid ${C.rule}`,
                  font: "400 15px/1.7 'IBM Plex Sans',sans-serif", color: C.ink }}>
      Zeroed at {Math.round(dist(zeroYd))} {dSuf}, at{" "}
      <select
        className="bif-tap"
        aria-label="Distance for this answer"
        value={row.range}
        onChange={(e) => onPick(Number(e.target.value))}
        style={{ padding: "3px 6px", border: `1.5px solid ${C.rule}`, background: C.inputBg, color: C.ink,
                 font: "600 14px 'IBM Plex Mono',monospace" }}
      >
        {choices.map((r) => (
          <option key={r.range} value={r.range}>{Math.round(dist(r.range))} {dSuf}</option>
        ))}
      </select>
      {" "}
      {height}
      {wind && <> {wind}</>}
      {inclined && (
        <> That is for a level shot. At your {slope}&deg; {shotAngleDeg < 0 ? "downhill" : "uphill"} angle,
          hold for about {Math.round(dist(holdYd))} {dSuf} instead (see the table).</>
      )}
    </div>
  );
}
