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
 *
 * Deliberately tight — a lot of these end up taped to a stock, so the goal
 * is a compact reference card, not a spacious report. No `width` on the
 * table means columns size to their own content instead of stretching to
 * fill the page.
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
      <h1 style={{ textAlign: "center", font: "700 12px 'Oswald',sans-serif", textTransform: "uppercase",
                   letterSpacing: ".03em", margin: 0 }}>
        {title}
      </h1>
      <p style={{ textAlign: "center", font: "400 12px 'IBM Plex Sans',sans-serif", color: "#555", margin: "1px 0 8px" }}>
        Bullet in Flight — point-mass, {v.dragModel} drag curve
      </p>

      {/* width:"auto" is load-bearing, not decorative — styles.css has a
          GLOBAL `table { width: 100% }` rule (for the app's other tables,
          which do want full-width). Without an explicit override here this
          table inherits that and stretches to fill the page, spreading
          columns out with huge gaps. An earlier on-screen check missed this
          because it used a shrink-to-fit container that masked the effect;
          real print (a normal block filling the page) exposed it. */}
      <table style={{ borderCollapse: "collapse", margin: "0 auto", width: "auto" }}>
        <thead>
          <tr>
            {keys.map((key, i) => (
              <th key={key} style={{ border: "1px solid #999", padding: "2px 5px",
                                      textAlign: i === 0 ? "left" : "right",
                                      font: "600 12px 'Oswald',sans-serif", textTransform: "uppercase",
                                      letterSpacing: ".04em", whiteSpace: "nowrap" }}>
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
                  <td key={key} style={{ border: "1px solid #ccc", padding: "1px 5px",
                                          textAlign: i === 0 ? "left" : "right",
                                          font: "500 12px 'IBM Plex Mono',monospace", whiteSpace: "nowrap" }}>
                    {COLUMN_DEFS[key].fmt(r, system)}{i === keys.length - 1 && soft ? " †" : ""}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
      {hasSoftRows && (
        <p style={{ font: "400 12px 'IBM Plex Sans',sans-serif", color: "#555", margin: "3px 0 0" }}>
          † Transonic (Mach 1.2–1.0) or slower — treat as soft.
        </p>
      )}

      {/* width:"fit-content" is what makes margin:auto actually center this
          row instead of being a no-op — a flex container otherwise fills
          the full available block width (same reason the table needed its
          own explicit width override above), which would leave nothing
          for auto margins to center within. */}
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", width: "fit-content", margin: "8px auto 0" }}>
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

      <p style={{ font: "400 12px 'IBM Plex Sans',sans-serif", color: "#555", margin: "6px 0 0", textAlign: "center" }}>
        Barrel angle above line of sight: {solution.launchAngleDeg.toFixed(3)}&deg;. No spin drift or Coriolis modeled.
      </p>
    </div>,
    document.body
  );
}

function Section({ title, children }) {
  return (
    <div style={{ minWidth: 128 }}>
      <div style={{ font: "600 12px 'Oswald',sans-serif", textTransform: "uppercase", letterSpacing: ".06em",
                    color: "#555", borderBottom: "1px solid #999", paddingBottom: 1, marginBottom: 2 }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 10,
                  font: "400 12px 'IBM Plex Mono',monospace", lineHeight: 1.5 }}>
      <span style={{ color: "#555" }}>{label}</span>
      <span>{value}</span>
    </div>
  );
}
