import React from "react";
import { createPortal } from "react-dom";
import { COLUMN_DEFS, commas, dopeColumnKeys } from "./RangeTable.jsx";
import { useUnits } from "../UnitsContext.jsx";
import { toDisplay, unitSuffix } from "../units.js";
import { num, isWindActive } from "../solveFromForm.js";

/**
 * A print-only dope chart: title, range table, then the load/sights/
 * conditions that produced it. Rendered via a portal straight onto
 * document.body — it needs to sit OUTSIDE the normal app's DOM (which
 * print CSS hides wholesale), not nested inside it, or hiding the app
 * would hide this too.
 *
 * Columns mirror whatever's showing on the live RangeTable (same
 * showMOA/showMIL toggle state, windage only if wind is active) via the
 * exact same COLUMN_DEFS/dopeColumnKeys RangeTable itself uses, so the
 * printed numbers can never drift from what's on screen.
 */
export default function DopeChart({ v, solution, saveName, showMOA, showMIL }) {
  const { system } = useUnits();
  const windActive = isWindActive(v);
  const title = saveName.trim() || "Dope Chart";
  const keys = dopeColumnKeys({ showWindage: windActive, showMOA, showMIL });
  const hasSoftRows = solution.rows.some((r) => r.mach < 1.2);

  // Digits per field mirror what's already used for the same kind of value
  // elsewhere in the app (velocity/range/temp/altitude whole numbers,
  // pressure to hundredths, height/wind speed to tenths).
  const field = (value, category, digits = 0) =>
    Number.isFinite(num(value))
      ? `${commas(toDisplay(num(value), category, system), digits)} ${unitSuffix(category, system)}`
      : "—";

  return createPortal(
    <div className="dope-print-root">
      <h1 style={{ textAlign: "center", font: "700 22px 'Oswald',sans-serif", textTransform: "uppercase",
                   letterSpacing: ".04em", margin: "0 0 4px" }}>
        {title}
      </h1>
      <p style={{ textAlign: "center", font: "400 11px 'IBM Plex Sans',sans-serif", color: "#444", margin: "0 0 18px" }}>
        Bullet in Flight — point-mass trajectory, {v.dragModel} standard drag curve
      </p>

      <table style={{ borderCollapse: "collapse", width: "100%", marginBottom: 6 }}>
        <thead>
          <tr>
            {keys.map((key, i) => (
              <th key={key} style={{ border: "1px solid #999", padding: "5px 8px",
                                      textAlign: i === 0 ? "left" : "right",
                                      font: "600 10px 'Oswald',sans-serif", textTransform: "uppercase",
                                      letterSpacing: ".06em" }}>
                {COLUMN_DEFS[key].head(system)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {solution.rows.map((r) => {
            const soft = r.mach < 1.2;
            return (
              <tr key={r.range}>
                {keys.map((key, i) => (
                  <td key={key} style={{ border: "1px solid #ccc", padding: "4px 8px",
                                          textAlign: i === 0 ? "left" : "right",
                                          font: "500 12px 'IBM Plex Mono',monospace" }}>
                    {COLUMN_DEFS[key].fmt(r, system)}{i === keys.length - 1 && soft ? " †" : ""}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
      {hasSoftRows && (
        <p style={{ font: "400 10px 'IBM Plex Sans',sans-serif", color: "#555", margin: "0 0 18px" }}>
          † Transonic (Mach 1.2–1.0) or slower — standard drag curves diverge most from a real bullet's measured
          drag in this band; treat these rows as soft.
        </p>
      )}

      <div style={{ display: "flex", gap: 24, marginTop: 14, flexWrap: "wrap" }}>
        <Section title="The Load">
          <Row label="Muzzle velocity" value={field(v.muzzleVelocity, "velocity")} />
          <Row label="Bullet weight" value={Number.isFinite(num(v.grains)) ? `${v.grains} gr` : "—"} />
          <Row label="Drag model" value={v.dragModel} />
          <Row label="Ballistic coefficient" value={v.ballisticCoefficient} />
        </Section>
        <Section title="The Sights">
          <Row label="Sight height" value={field(v.sightHeight, "length", 1)} />
          <Row label="Zero range" value={field(v.zeroRangeYd, "distance")} />
        </Section>
        <Section title="Conditions">
          <Row label="Temperature" value={field(v.tempF, "temperature")} />
          <Row label="Station pressure" value={field(v.pressInHg, "pressure", 2)} />
          <Row label="Altitude" value={field(v.altitudeFt, "altitude")} />
          {windActive && (
            <Row label="Wind" value={`${field(v.windSpeedMph, "windSpeed", 1)} from ${v.windClock} o'clock`} />
          )}
        </Section>
      </div>

      <p style={{ font: "400 10px 'IBM Plex Sans',sans-serif", color: "#555", marginTop: 18 }}>
        Barrel angle above the line of sight: {solution.launchAngleDeg.toFixed(3)}&deg;. No spin drift or Coriolis
        modeled in this version.
      </p>
    </div>,
    document.body
  );
}

function Section({ title, children }) {
  return (
    <div style={{ minWidth: 160 }}>
      <div style={{ font: "600 10px 'Oswald',sans-serif", textTransform: "uppercase", letterSpacing: ".08em",
                    color: "#555", borderBottom: "1px solid #999", paddingBottom: 3, marginBottom: 5 }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12,
                  font: "400 11px 'IBM Plex Mono',monospace", marginBottom: 3 }}>
      <span style={{ color: "#555" }}>{label}</span>
      <span>{value}</span>
    </div>
  );
}
