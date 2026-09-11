import React, { useState } from "react";
import { C, label } from "./theme.js";
import { useUnits } from "../UnitsContext.jsx";
import { useAuth } from "../AuthContext.jsx";
import { fieldDisplayValue, fieldCanonicalValue, unitSuffix } from "../units.js";

// A full bordered box, matching the catalog selects (same 1.5px C.rule
// border, same 7px 8px padding) so the form reads as one input system --
// underline-only fields reliably test as "not editable", and a subtle
// fill can't carry that signal on this sage/tan palette. The unit suffix
// lives inside the box, right-aligned and pointer-events:none, so a tap
// still lands on the field and it can't clip off the edge on mobile.
// Focus takes the border to C.ink via .bif-field:focus-within in styles.css.
export function Field({ label: text, hint, value, onChange, suffix, type, inputMode = "decimal" }) {
  return (
    <label style={{ display: "block", marginBottom: 14 }}>
      <span style={{ ...label, display: "block", marginBottom: 4 }}>{text}</span>
      <span className="bif-field"
            style={{ display: "flex", alignItems: "center", gap: 6,
                     border: `1.5px solid ${C.rule}`, background: C.inputBg, padding: "7px 8px" }}>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          type={type}
          inputMode={inputMode}
          style={{ flex: 1, minWidth: 0, border: "none", background: "transparent",
                   outline: "none", padding: 0,
                   font: "500 16px/1.2 'IBM Plex Mono',monospace", color: C.ink }}
        />
        {suffix && (
          <span style={{ flex: "none", font: "400 11px 'IBM Plex Mono',monospace",
                         color: C.muted, pointerEvents: "none" }}>
            {suffix}
          </span>
        )}
      </span>
      {hint && (
        <span style={{ display: "block", marginTop: 4,
                       font: "400 12px/1.4 'IBM Plex Sans',sans-serif", color: C.muted }}>
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

/**
 * The bordered, left-accented callout used for every "nothing to plot yet",
 * "couldn't solve", "double-check these values" message across Calculator,
 * Compare, Optimal Zero and Recoil. `tone` is a C.* colour (C.ox for
 * errors, C.brass for cautions).
 */
export function Notice({ tone, title, children }) {
  return (
    <div style={{ background: C.card, border: `1.5px solid ${tone}`, borderLeft: `5px solid ${tone}`,
                  padding: 14, marginBottom: 16 }}>
      <div style={{ font: "600 12px 'Oswald',sans-serif", letterSpacing: ".1em",
                    textTransform: "uppercase", color: tone }}>
        {title}
      </div>
      <div style={{ marginTop: 5, font: "400 12.5px 'IBM Plex Sans',sans-serif", color: C.ink }}>
        {children}
      </div>
    </div>
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

/**
 * The "where does this actually get saved" line shown next to a
 * save/add button — signed in, it's a plain status line; signed out, it's
 * also a nudge with a real link that opens the sign-up modal (via
 * AuthContext, so it works from any page, not just the header). `noun`
 * lets each page's wording match what it's actually saving ("saves" on
 * Calculator, "setups" on Recoil).
 */
export function SyncStatusHint({ signedIn, noun = "saves" }) {
  const { openAuthModal, authAvailable } = useAuth();
  const style = { marginTop: -6, marginBottom: 10, font: "400 12px/1.5 'IBM Plex Sans',sans-serif", color: C.muted };
  if (signedIn) {
    return <div style={style}>Signed in — {noun} sync to your account.</div>;
  }
  // Local-only build — no account to nudge toward; just state where data lives.
  if (!authAvailable) {
    return <div style={style}>{noun[0].toUpperCase() + noun.slice(1)} are saved on this device.</div>;
  }
  return (
    <div style={style}>
      Signed out — {noun} stay on this device only.{" "}
      <button
        onClick={() => openAuthModal("Sign up")}
        style={{ background: "none", border: "none", padding: 0, cursor: "pointer",
                 color: C.steel, textDecoration: "underline", font: "inherit" }}
      >
        Create a free account
      </button>{" "}
      to keep them everywhere.
    </div>
  );
}

/**
 * The "add them to my account" / "not now" pair shown under a device-local-
 * data-found notice — used identically by Calculator's saved-loads import
 * offer and Recoil's recoil-setups import offer, so it lives here instead
 * of being defined twice.
 */
export function ImportActions({ onImport, onDismiss }) {
  const [busy, setBusy] = useState(false);
  const handleImport = async () => {
    setBusy(true);
    await onImport();
    setBusy(false);
  };
  return (
    <div style={{ marginTop: 8, display: "flex", gap: 14 }}>
      <button
        onClick={handleImport}
        disabled={busy}
        style={{ background: "none", border: "none", padding: 0, cursor: busy ? "default" : "pointer",
                 color: C.ox, textDecoration: "underline", font: "600 12px 'IBM Plex Sans',sans-serif" }}
      >
        {busy ? "Adding…" : "Add them to my account"}
      </button>
      <button
        onClick={onDismiss}
        style={{ background: "none", border: "none", padding: 0, cursor: "pointer",
                 color: C.ox, textDecoration: "underline", font: "600 12px 'IBM Plex Sans',sans-serif" }}
      >
        Not now
      </button>
    </div>
  );
}

/**
 * Section heading for the numbered-step panels (Calculator, Compare,
 * Optimal Zero, Recoil) -- previously 4 separate inline copies of the same
 * tiny-caps `label` token, indistinguishable from the field-group
 * sub-labels underneath them except by color. A left badge now carries the
 * ordinal at a size/weight that actually reads as a heading; the section
 * name is mixed-case Oswald, the one deliberate exception to every other
 * label in the app being uppercase, because the case change itself is
 * doing hierarchy work that size alone wasn't.
 *
 * These are labeled narrative sections, not a wizard -- fields recompute
 * live in any order and every one has a working default -- so the badge is
 * a muted square (a reference number), not a filled/checked progress
 * token, and there's no connector line between one badge and the next.
 *
 * `n` renders the numbered badge. Pass `eyebrow` instead for a section
 * that isn't part of the numbered sequence (InputPanel's "Optional — The
 * wind" section) but still wants the same size/divider treatment. `first`
 * drops the divider and top margin for whichever section sits at the very
 * top of its panel.
 *
 * Pass `onToggle` (and `open`) to make the whole row a collapse button --
 * used by InputPanel to fold a settled section down to a one-line summary.
 * Without `onToggle` it's the same static `<div>` heading it always was.
 */
export function StepHead({ n, eyebrow, name, first, open, onToggle }) {
  const rowStyle = {
    display: "flex", alignItems: "center", gap: 10,
    borderTop: first ? "none" : `1px solid ${C.rule}`,
    paddingTop: first ? 0 : 14,
    margin: first ? "0 0 14px" : "32px 0 14px",
  };
  const marker = n != null ? (
    <span style={{ flexShrink: 0, width: 22, height: 22, display: "flex",
                   alignItems: "center", justifyContent: "center",
                   background: C.rule, color: C.ink, font: "600 11px 'Oswald',sans-serif" }}>
      {n}
    </span>
  ) : eyebrow ? (
    <span style={{ flexShrink: 0, font: "600 10px 'Oswald',sans-serif", letterSpacing: ".14em",
                   textTransform: "uppercase", color: C.muted }}>
      {eyebrow}
    </span>
  ) : null;
  const nameEl = (
    <span style={{ font: "600 15px 'Oswald',sans-serif", letterSpacing: ".01em", color: C.ink }}>
      {name}
    </span>
  );

  if (typeof onToggle !== "function") {
    return <div style={rowStyle}>{marker}{nameEl}</div>;
  }
  return (
    <button
      type="button"
      className="bif-step-toggle"
      onClick={onToggle}
      aria-expanded={open}
      style={{ ...rowStyle, width: "100%", background: "none", border: "none",
               borderTop: first ? "none" : `1px solid ${C.rule}`,
               padding: first ? 0 : "14px 0 0", cursor: "pointer",
               textAlign: "left", color: "inherit", font: "inherit" }}
    >
      {marker}
      {nameEl}
      <span aria-hidden="true"
            style={{ marginLeft: "auto", flexShrink: 0, fontSize: 11, lineHeight: 1,
                     color: C.muted, transition: "transform .12s ease",
                     transform: open ? "none" : "rotate(-90deg)" }}>
        ▾
      </span>
    </button>
  );
}

/**
 * Per-section collapse state for a numbered-step panel, persisted in
 * localStorage under `storageKey` as an array of the *collapsed* section
 * ids. Nothing collapses on its own once that key exists -- a section stays
 * however the user last left it, forever, including an explicit "everything
 * open" from Expand All. `defaultCollapsed` only seeds the very first visit,
 * before any key has ever been written (`localStorage.getItem` returning
 * `null`, not merely an empty array) -- a smarter starting value, not new
 * persistence logic. `ids` is the full ordered id list, used by the
 * expand/collapse-all control (`anyOpen` / `setAll`).
 */
export function useCollapsibleSteps(storageKey, ids, defaultCollapsed = []) {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw == null) return new Set(defaultCollapsed);
      const arr = JSON.parse(raw);
      return new Set(Array.isArray(arr) ? arr : []);
    } catch {
      return new Set(defaultCollapsed);
    }
  });

  const commit = (next) => {
    try {
      localStorage.setItem(storageKey, JSON.stringify([...next]));
    } catch {
      /* private mode / quota -- in-session state still works */
    }
    return next;
  };

  const toggle = (id) =>
    setCollapsed((s) => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return commit(next);
    });

  const setAll = (collapse) => setCollapsed(() => commit(new Set(collapse ? ids : [])));

  return {
    isOpen: (id) => !collapsed.has(id),
    anyOpen: ids.some((id) => !collapsed.has(id)),
    toggle,
    setAll,
  };
}

/**
 * Shown on Calculator / Optimal Zero when the tab's live rig fields (sight
 * height, vitals radius, atmosphere) differ from the saved "My rig". Save
 * pushes the current values to the shared store -- the other tab picks
 * them up next time it mounts; Reset pulls the saved ones back. Editing a
 * rig field never writes back on its own, so this is the only way a change
 * on one tab reaches the other.
 */
export function RigDriftBar({ drifted, onSave, onReset }) {
  if (!drifted) return null;
  const linkStyle = {
    background: "none", border: "none", padding: 0, cursor: "pointer",
    color: C.steel, textDecoration: "underline", font: "600 12px 'IBM Plex Sans',sans-serif",
  };
  return (
    <div style={{ margin: "0 0 20px", padding: "8px 10px", background: C.inputBg,
                  border: `1px solid ${C.brass}`, display: "flex", flexWrap: "wrap",
                  alignItems: "center", gap: "4px 14px",
                  font: "500 12px/1.5 'IBM Plex Sans',sans-serif", color: C.ink }}>
      <span>Rig differs from your saved one.</span>
      <span style={{ display: "flex", gap: 14 }}>
        <button onClick={onSave} style={linkStyle}>Save as my rig</button>
        <button onClick={onReset} style={linkStyle}>Reset to my rig</button>
      </span>
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
