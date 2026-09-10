import React, { useId, useMemo, useState } from "react";
import { C, label } from "./theme.js";
import { COMMERCIAL_AMMO } from "../data/commercialAmmo.js";

// The full explanation (why it's approximated, how) lives once in Help's
// FAQ -- this is the terse, just-in-time version: shown only on a load
// that's actually derived, right where its number appears, not as a
// standing paragraph everyone reads whether or not it applies to them.
const DERIVED_BC_NOTE = " (derived BC — approximated from published velocity data, not a manufacturer figure)";

/**
 * Caliber -> Manufacturer -> Load: each choice narrows the next select's
 * options, so picking one of ~1,500 loads never means scanning a single huge
 * list. Auto-advances past a step when it only has one option, all the way
 * through to auto-applying the load itself if a caliber+manufacturer combo
 * has just one.
 *
 * onSelect(ammo) fires with the FULL catalog entry (not just its id) once a
 * load is resolved, whether by explicit pick or auto-apply.
 *
 * resetLoadAfterSelect: if true, the Load select snaps back to blank right
 * after firing onSelect (Caliber/Manufacturer stay put) — for a picker used
 * to build up a list of several loads one at a time. If false (default),
 * the selection and its "Filled in: ..." confirmation stay visible — for a
 * picker that's filling a single form's fields.
 */
export default function CommercialLoadPicker({ onSelect, resetLoadAfterSelect = false }) {
  const [caliber, setCaliber] = useState("");
  const [manufacturer, setManufacturer] = useState("");
  const [loadId, setLoadId] = useState("");
  // Only meaningful when resetLoadAfterSelect is true: the Load select
  // itself snaps back to blank right after a successful add (so the next
  // pick starts clean), but caliber/manufacturer stay put -- without this,
  // that reset was indistinguishable from "never picked anything," so the
  // amber "Pick a load above" warning stuck around permanently after every
  // single add on Optimal Zero/Recoil. Cleared the moment caliber or
  // manufacturer changes, same as loadId itself.
  const [lastApplied, setLastApplied] = useState(null);

  const calibers = useMemo(
    () => [...new Set(COMMERCIAL_AMMO.map((a) => a.cartridge))].sort((a, b) => a.localeCompare(b)),
    []
  );

  const manufacturersForCaliber = useMemo(() => {
    if (!caliber) return [];
    const set = new Set(COMMERCIAL_AMMO.filter((a) => a.cartridge === caliber).map((a) => a.manufacturer));
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [caliber]);

  const loadsForSelection = useMemo(() => {
    if (!caliber || !manufacturer) return [];
    return COMMERCIAL_AMMO.filter((a) => a.cartridge === caliber && a.manufacturer === manufacturer)
      .sort((a, b) => a.grains - b.grains || a.bullet.localeCompare(b.bullet));
  }, [caliber, manufacturer]);

  // A manufacturer genuinely sells more than one real product with the same
  // bullet+weight (e.g. Hornady's 6.5 Creedmoor 120gr CX exists at two
  // different published muzzle velocities, presumably different product
  // lines) -- deduping would throw away real, distinct data. Disambiguating
  // the label with MV is the honest fix: whichever grains+bullet combo
  // isn't unique within this caliber+manufacturer gets its velocity shown
  // right in the option text instead of two identical-looking rows.
  const duplicateLabelKeys = useMemo(() => {
    const counts = new Map();
    for (const a of loadsForSelection) {
      const key = `${a.grains}|${a.bullet}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return new Set([...counts].filter(([, n]) => n > 1).map(([key]) => key));
  }, [loadsForSelection]);

  const loadOptionText = (a) =>
    `${a.grains}gr ${a.bullet}` +
    (duplicateLabelKeys.has(`${a.grains}|${a.bullet}`) ? ` @ ${a.muzzleVelocity}fps` : "") +
    (a.bcSource !== "published" ? " (derived BC)" : "");

  const applyLoad = (ammo) => {
    setLoadId(resetLoadAfterSelect ? "" : ammo.id);
    setLastApplied(resetLoadAfterSelect ? ammo : null);
    onSelect(ammo);
  };

  const handleCaliberChange = (nextCaliber) => {
    setCaliber(nextCaliber);
    setLoadId("");
    setLastApplied(null);
    if (!nextCaliber) { setManufacturer(""); return; }
    const mfrs = [...new Set(COMMERCIAL_AMMO.filter((a) => a.cartridge === nextCaliber).map((a) => a.manufacturer))];
    setManufacturer(mfrs.length === 1 ? mfrs[0] : "");
  };

  const handleManufacturerChange = (nextManufacturer) => {
    setManufacturer(nextManufacturer);
    setLastApplied(null);
    if (!nextManufacturer) { setLoadId(""); return; }
    const loads = COMMERCIAL_AMMO.filter((a) => a.cartridge === caliber && a.manufacturer === nextManufacturer);
    if (loads.length === 1) applyLoad(loads[0]);
    else setLoadId("");
  };

  const handleLoadChange = (nextLoadId) => {
    if (!nextLoadId) { setLoadId(""); return; }
    const ammo = loadsForSelection.find((a) => a.id === nextLoadId);
    if (ammo) applyLoad(ammo);
  };

  const selectedLoad = loadId ? loadsForSelection.find((a) => a.id === loadId) : null;

  return (
    <>
      <FilterableSelect
        value={caliber}
        onChange={handleCaliberChange}
        options={calibers.map((c) => ({ value: c, text: c }))}
        placeholder="Caliber…"
        ariaLabel="Caliber"
      />

      <FilterableSelect
        value={manufacturer}
        onChange={handleManufacturerChange}
        options={manufacturersForCaliber.map((m) => ({ value: m, text: m }))}
        placeholder="Manufacturer…"
        ariaLabel="Manufacturer"
        disabled={!caliber}
      />

      <FilterableSelect
        value={loadId}
        onChange={handleLoadChange}
        options={loadsForSelection.map((a) => ({ value: a.id, text: loadOptionText(a) }))}
        placeholder="Load…"
        ariaLabel="Load"
        disabled={!manufacturer}
      />

      {selectedLoad ? (
        <div style={{ marginBottom: 16, padding: "7px 9px", background: C.field, border: `1px solid ${C.rule}`,
                      font: "500 11px/1.4 'IBM Plex Mono',monospace", color: C.ink }}>
          Filled in: {selectedLoad.muzzleVelocity} fps · {selectedLoad.grains}gr · {selectedLoad.dragModel}{" "}
          {selectedLoad.ballisticCoefficient}
          {selectedLoad.bcSource !== "published" ? DERIVED_BC_NOTE : ""}
        </div>
      ) : lastApplied ? (
        <div style={{ marginBottom: 16, padding: "7px 9px", background: C.field, border: `1px solid ${C.rule}`,
                      font: "500 11px/1.4 'IBM Plex Mono',monospace", color: C.ink }}>
          Added: {lastApplied.muzzleVelocity} fps · {lastApplied.grains}gr · {lastApplied.dragModel}{" "}
          {lastApplied.ballisticCoefficient}
          {lastApplied.bcSource !== "published" ? DERIVED_BC_NOTE : ""} — pick another load, or a different
          caliber/manufacturer.
        </div>
      ) : caliber && manufacturer ? (
        <div style={{ marginBottom: 16, padding: "7px 9px", background: C.field, border: `1px solid ${C.brass}`,
                      font: "600 11px/1.4 'IBM Plex Sans',sans-serif", color: C.brass }}>
          Pick a load above — the fields below haven't changed yet.
        </div>
      ) : null /* Catalog-wide facts (mostly-G1, what "derived BC" means) belong in
                   Help, read once, not reprinted here on every idle load -- see
                   Help.jsx's Calculator section and FAQ. The derived-BC case
                   itself still gets a note, but only once it's actually true,
                   in the confirmation lines above. */}
    </>
  );
}

/**
 * A native <select> whose closed width is set by its widest <option> text —
 * a long cartridge name ("300 Remington SA Ultra Mag") forces the box wide
 * regardless of viewport, which is exactly what caused the mobile overflow
 * bug. A text input has no such intrinsic-width trap, so this renders as an
 * input with a filterable dropdown instead: closed, it shows the selected
 * option's text (or `placeholder`); focused, it opens showing every option,
 * narrowing to substring matches as you type ("30-" -> every 30-cal).
 * Selecting (click, or Enter on the highlighted row) calls onChange(value)
 * and closes -- the caller's existing cascade logic (reset the next select
 * down, auto-advance past a single-option step) is untouched, since this
 * only replaces the picking UI, not what happens after a pick.
 */
function FilterableSelect({ value, onChange, options, placeholder, ariaLabel, disabled }) {
  const id = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);

  const selected = options.find((o) => o.value === value) ?? null;
  const displayValue = open ? query : selected ? selected.text : "";

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (q ? options.filter((o) => o.text.toLowerCase().includes(q)) : options).slice(0, 200);
  }, [options, query]);

  const commit = (opt) => {
    onChange(opt.value);
    setQuery("");
    setOpen(false);
  };

  // A native <select> reopens on every click regardless of whether it
  // already had focus; an input only fires onFocus on the transition into
  // focus. Selecting an option leaves the input focused but closed, so a
  // second click needs its own handler -- relying on onFocus alone means
  // that second click does nothing.
  const openDropdown = () => {
    if (!open) setQuery("");
    setOpen(true);
    setHighlight(0);
  };

  const handleKeyDown = (e) => {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "Enter") { setOpen(true); setHighlight(0); }
      return;
    }
    if (e.key === "ArrowDown") { e.preventDefault(); setHighlight((h) => Math.min(h + 1, filtered.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHighlight((h) => Math.max(h - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); if (filtered[highlight]) commit(filtered[highlight]); }
    else if (e.key === "Escape") { setOpen(false); setQuery(""); }
  };

  const listboxId = `${id}-listbox`;

  return (
    <div style={{ position: "relative", marginBottom: 5 }}>
      <input
        role="combobox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={open && filtered[highlight] ? `${id}-opt-${highlight}` : undefined}
        aria-label={ariaLabel}
        value={displayValue}
        disabled={disabled}
        placeholder={placeholder}
        autoComplete="off"
        onFocus={openDropdown}
        onClick={openDropdown}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); setHighlight(0); }}
        onKeyDown={handleKeyDown}
        onBlur={() => setOpen(false)}
        style={{ width: "100%", padding: "7px 24px 7px 8px",
                 border: `1.5px solid ${C.rule}`, background: disabled ? C.field : C.inputBg, color: C.ink,
                 font: "500 13px 'IBM Plex Mono',monospace" }}
      />
      <span aria-hidden="true" style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
                                         pointerEvents: "none", color: C.muted, font: "400 11px sans-serif" }}>
        ▾
      </span>
      {open && !disabled && (
        <div role="listbox" id={listboxId}
             // Without this, dragging the scrollbar thumb itself (not an
             // option row) is a mousedown outside any row's own
             // preventDefault, so it blurs the input and closes the list
             // mid-drag.
             onMouseDown={(e) => e.preventDefault()}
             style={{ position: "absolute", zIndex: 10, top: "100%", left: 0, right: 0,
                      maxHeight: 260, overflowY: "auto", background: C.card,
                      border: `1.5px solid ${C.rule}` }}>
          {filtered.length === 0 ? (
            <div style={{ padding: "7px 8px", font: "400 12px 'IBM Plex Sans',sans-serif", color: C.muted }}>
              No matches
            </div>
          ) : (
            filtered.map((o, i) => (
              <div
                key={o.value}
                id={`${id}-opt-${i}`}
                role="option"
                aria-selected={o.value === value}
                // preventDefault keeps this mousedown from blurring the input
                // before the click registers -- the standard combobox trick.
                onMouseDown={(e) => { e.preventDefault(); commit(o); }}
                onMouseEnter={() => setHighlight(i)}
                style={{ padding: "6px 8px", cursor: "pointer",
                         background: i === highlight ? C.field : C.card,
                         font: "500 13px 'IBM Plex Mono',monospace", color: C.ink }}
              >
                {o.text}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
