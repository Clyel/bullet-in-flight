import React from "react";
import { C, label } from "./theme.js";
import { useUnits } from "../UnitsContext.jsx";
import { fieldDisplayValue, fieldCanonicalValue, unitSuffix } from "../units.js";

export function Field({ label: text, hint, value, onChange, suffix, inputMode = "decimal" }) {
  return (
    <label style={{ display: "block", marginBottom: 14 }}>
      <span style={{ ...label, display: "block" }}>{text}</span>
      <span style={{ display: "flex", alignItems: "baseline", gap: 6,
                     borderBottom: `1.5px solid ${C.rule}`, paddingBottom: 3 }}>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          inputMode={inputMode}
          style={{ flex: 1, minWidth: 0, border: "none", background: "transparent",
                   outline: "none", padding: "2px 0",
                   font: "500 19px/1.2 'IBM Plex Mono',monospace", color: C.ink }}
        />
        {suffix && (
          <span style={{ font: "400 11px 'IBM Plex Mono',monospace", color: C.muted }}>
            {suffix}
          </span>
        )}
      </span>
      {hint && (
        <span style={{ display: "block", marginTop: 3,
                       font: "400 10.5px/1.4 'IBM Plex Sans',sans-serif", color: C.muted }}>
          {hint}
        </span>
      )}
    </label>
  );
}

/**
 * A Field whose value/suffix track the current unit system. `value`/
 * `onChange` still deal in the canonical (always-imperial) string that form
 * state stores — this just wraps the display/parse conversion around it.
 */
export function UnitField({ label: text, hint, category, value, onChange }) {
  const { system } = useUnits();
  return (
    <Field
      label={text}
      hint={hint}
      value={fieldDisplayValue(value, category, system)}
      onChange={(typed) => onChange(fieldCanonicalValue(typed, category, system))}
      suffix={unitSuffix(category, system)}
    />
  );
}

export function Segmented({ options, value, onChange }) {
  return (
    <div style={{ display: "flex", border: `1.5px solid ${C.rule}` }}>
      {options.map((o) => (
        <button
          key={o}
          onClick={() => onChange(o)}
          aria-pressed={value === o}
          style={{ flex: 1, padding: "7px 4px", border: "none", cursor: "pointer",
                   background: value === o ? C.ink : "transparent",
                   color: value === o ? C.card : C.muted,
                   font: "600 11px 'Oswald',sans-serif", letterSpacing: ".1em" }}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

export function Panel({ title, children, style }) {
  return (
    <div style={{ background: C.card, border: `1.5px solid ${C.rule}`, ...style }}>
      {title && (
        <div style={{ ...label, color: C.ink, padding: "12px 14px 0" }}>{title}</div>
      )}
      {children}
    </div>
  );
}
