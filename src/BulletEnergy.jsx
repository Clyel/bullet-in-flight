import React, { useMemo, useState } from "react";
import { C, label, numeric } from "./components/theme.js";
import { StepHead } from "./components/ui.jsx";
import CommercialLoadPicker from "./components/CommercialLoadPicker.jsx";
import { energyFtLb } from "./ballistics/solver.js";
import { num } from "./solveFromForm.js";
import { fieldDisplayValue, fieldCanonicalValue } from "./units.js";
import { useUnitFormatters } from "./useUnitFormatters.js";

// Muzzle energy only -- E = (grains * fps^2) / 450437, the exact formula
// RangeTable/SummaryStrip/Recoil already use (src/ballistics/solver.js).
// Zero new physics, so no independent fixtures needed here -- this tab is a
// pure passthrough to an already-fixture-validated function.
//
// Deliberately simple, per the original ask: a handful of live weight+
// velocity rows and their energy, nothing else -- no rig, no zero, no
// conditions, no persistence. Session-only state, same "scratch pad" feel
// as the reference tool this was modeled on (larrywillis.com/bullet-
// energy.html) had with its own Reset button, just live instead of
// button-triggered like every other calculation in this app.
let nextRowId = 1;
const makeRow = () => ({ id: nextRowId++, grains: "", muzzleVelocity: "" });

export default function BulletEnergy() {
  const [rows, setRows] = useState(() => [makeRow(), makeRow()]);
  const { system, vel, energy, vSuf, eSuf } = useUnitFormatters();

  const setField = (id, key) => (val) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, [key]: val } : r)));

  const addRow = () => setRows((rs) => [...rs, makeRow()]);
  const removeRow = (id) => setRows((rs) => rs.filter((r) => r.id !== id));

  // A catalog pick fills the first still-blank row rather than always
  // appending -- the common case is picking a round or two right after
  // landing on the tab, while the two starter rows are still empty, and
  // appending there would leave those two sitting unused above the pick.
  // Once every row has something in it, it appends, same as "+ Add row".
  // Mirrors Compare/OptimalZero's own "picker adds to the list" pattern,
  // not a per-row picker -- keeps every row's entry mechanism identical
  // (type the numbers, or let a pick fill them in) instead of cluttering
  // every row with its own cascading picker.
  const handleAddCatalogRow = (ammo) => {
    const filled = { grains: String(ammo.grains), muzzleVelocity: String(ammo.muzzleVelocity) };
    setRows((rs) => {
      const blankIdx = rs.findIndex((r) => !r.grains.trim() && !r.muzzleVelocity.trim());
      if (blankIdx === -1) return [...rs, { id: nextRowId++, ...filled }];
      const next = [...rs];
      next[blankIdx] = { ...next[blankIdx], ...filled };
      return next;
    });
  };

  // grains/muzzleVelocity stay canonical strings in state (this app's usual
  // form-state convention) -- num() + energyFtLb() happen at render, same as
  // every other live-computed value in this app.
  const results = useMemo(() => rows.map((r) => {
    const g = num(r.grains);
    const mv = num(r.muzzleVelocity);
    const valid = g > 0 && mv > 0;
    return { ...r, energyFtLb: valid ? energyFtLb(g, mv) : null, label: valid ? `${g}gr @ ${Math.round(vel(mv))} ${vSuf}` : null };
  }), [rows, vel, vSuf]);

  const comparable = results.filter((r) => r.energyFtLb != null);

  const inputStyle = {
    width: "100%", minWidth: 90, padding: "6px 7px", border: `1.5px solid ${C.rule}`,
    background: C.inputBg, color: C.ink, font: "500 13px 'IBM Plex Mono',monospace",
  };
  const th = { padding: "9px 12px", textAlign: "left", font: "600 10px 'Oswald',sans-serif",
               letterSpacing: ".12em", textTransform: "uppercase", color: C.card, whiteSpace: "nowrap" };
  const sub = { ...label, display: "block", marginBottom: 5 };

  return (
    <div>
      <StepHead n={1} name="Compare loads" first />
      <p style={{ marginTop: 0, marginBottom: 16, font: "400 12.5px/1.5 'IBM Plex Sans',sans-serif", color: C.muted }}>
        Muzzle energy — how hard a bullet hits leaving the barrel, not what's left of it downrange
        (the Calculator's range table already shows that for one specific load). Enter a bullet weight and
        velocity per row to compare a few at once.
      </p>

      <span style={sub}>Add from the catalog</span>
      <CommercialLoadPicker onSelect={handleAddCatalogRow} resetLoadAfterSelect />
      <div style={{ marginBottom: 16, font: "400 12px/1.5 'IBM Plex Sans',sans-serif", color: C.muted }}>
        Fills weight and muzzle velocity into a row below — edit the numbers afterward if you like, or
        just type your own in a row instead.
      </div>

      <div style={{ background: C.card, border: `1.5px solid ${C.rule}`, overflowX: "auto", marginBottom: 12 }}>
        <table>
          <thead>
            <tr style={{ background: C.ink }}>
              <th style={th}>Bullet weight (gr)</th>
              <th style={th}>Velocity ({vSuf})</th>
              <th style={{ ...th, textAlign: "right" }}>Energy ({eSuf})</th>
              <th style={th} aria-hidden="true" />
            </tr>
          </thead>
          <tbody>
            {results.map((r, i) => (
              <tr key={r.id} style={{ background: i % 2 ? C.cardAlt : C.card }}>
                <td style={{ padding: "7px 12px" }}>
                  <input
                    inputMode="decimal"
                    aria-label={`Row ${i + 1} bullet weight`}
                    value={r.grains}
                    onChange={(e) => setField(r.id, "grains")(e.target.value)}
                    style={inputStyle}
                  />
                </td>
                <td style={{ padding: "7px 12px" }}>
                  <input
                    inputMode="decimal"
                    aria-label={`Row ${i + 1} velocity`}
                    value={fieldDisplayValue(r.muzzleVelocity, "velocity", system)}
                    onChange={(e) => setField(r.id, "muzzleVelocity")(fieldCanonicalValue(e.target.value, "velocity", system))}
                    style={inputStyle}
                  />
                </td>
                <td style={{ ...numeric, padding: "7px 12px", textAlign: "right", fontWeight: 600 }}>
                  {r.energyFtLb != null ? energy(r.energyFtLb).toFixed(1) : <span style={{ color: C.muted, fontWeight: 400 }}>—</span>}
                </td>
                <td style={{ padding: "7px 8px", textAlign: "center" }}>
                  {rows.length > 1 && (
                    <button
                      onClick={() => removeRow(r.id)}
                      aria-label={`Remove row ${i + 1}`}
                      style={{ background: "none", border: "none", cursor: "pointer", color: C.ox,
                               font: "600 14px 'IBM Plex Mono',monospace", padding: "0 4px" }}
                    >
                      &times;
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button
        onClick={addRow}
        style={{ background: "none", border: "none", padding: 0, cursor: "pointer", marginBottom: 20,
                 color: C.steel, textDecoration: "underline", font: "600 11px 'IBM Plex Sans',sans-serif" }}
      >
        + Add row
      </button>

      {comparable.length >= 2 && <EnergyBars results={comparable} />}

      <p style={{ marginTop: 20, font: "400 11px/1.5 'IBM Plex Sans',sans-serif", color: C.muted }}>
        <strong style={{ color: C.ink }}>Muzzle energy</strong> only — kinetic energy the instant the bullet
        leaves the barrel (E = weight&times;velocity&sup2; / 450,437), not downrange energy after drag has
        slowed it. Same formula the Calculator's range table and Recoil tab already use.
      </p>
    </div>
  );
}

// Mirrors Recoil.jsx's own RecoilBars -- same plain-inline-SVG-free bar
// pattern (a handful of static bars don't need Plot.jsx's full axis
// machinery), same unit-invariant width ratio. Not shared as a component
// since the two call sites' row shape (name+id vs weight/velocity-derived
// label) differ enough that extracting it would need its own abstraction;
// worth revisiting if a third comparison bar shows up somewhere.
function EnergyBars({ results }) {
  const { energy, eSuf } = useUnitFormatters();
  const max = Math.max(...results.map((r) => r.energyFtLb), 1);
  return (
    <div style={{ background: C.card, border: `1.5px solid ${C.rule}`, padding: "14px 16px", marginBottom: 16 }}>
      <div style={{ ...label, color: C.ink, marginBottom: 10 }}>Energy, compared</div>
      {results.map((r) => (
        <div key={r.id} style={{ marginBottom: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between",
                        font: "500 11px 'IBM Plex Sans',sans-serif", color: C.ink, marginBottom: 2 }}>
            <span>{r.label}</span>
            <span style={{ ...numeric }}>{energy(r.energyFtLb).toFixed(1)} {eSuf}</span>
          </div>
          <div style={{ height: 10, background: C.field }}>
            <div style={{ height: "100%", width: `${(r.energyFtLb / max) * 100}%`, background: C.ox,
                          transition: "width 200ms" }} />
          </div>
        </div>
      ))}
    </div>
  );
}
