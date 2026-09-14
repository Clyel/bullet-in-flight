import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { C, label } from "./theme.js";
import { COMMERCIAL_AMMO } from "../data/commercialAmmo.js";

// The full explanation (why it's approximated, how) lives once in Help's
// FAQ -- this is the terse, just-in-time version: shown only on a load
// that's actually derived, right where its number appears, not as a
// standing paragraph everyone reads whether or not it applies to them.
const DERIVED_BC_NOTE = " (derived BC — approximated from published velocity data, not a manufacturer figure)";

// One search box over the flattened catalog, replacing the old
// Caliber -> Manufacturer -> Load three-select cascade (see UX-REVIEW.md
// item #7 -- Jake shipped the "smallest viable version" of that review
// first, a filterable-combobox cascade; this is the full rebuild that was
// left "on the table if the minimal version doesn't hold up," picked back
// up once the catalog grew from 855 to ~1,852 loads / 8 to 12
// manufacturers -- exactly the growth the original pitch was betting would
// eventually justify it. Caliber/manufacturer survive as optional, additive
// filter chips rather than mandatory sequential steps.
//
// onSelect(ammo) still fires the FULL catalog entry, unchanged contract.
// resetLoadAfterSelect: same two modes as before -- true clears the query
// (ready for a completely different next search) and shows an "Added: ..."
// chip, for a picker building up a list one load at a time (Compare/Optimal
// Zero/Recoil/Bullet Energy). False (default) leaves the picked load's
// label showing in the box itself, for a picker filling one form's fields
// (Calculator/Optimal Zero's own rig).
const MAX_RESULTS = 40;
const COUNT_THRESHOLD = 20;
const MOBILE_BREAKPOINT = 640;

const ALL_CALIBERS = [...new Set(COMMERCIAL_AMMO.map((a) => a.cartridge))].sort((a, b) => a.localeCompare(b));
const ALL_MANUFACTURERS = [...new Set(COMMERCIAL_AMMO.map((a) => a.manufacturer))].sort((a, b) => a.localeCompare(b));

function useIsMobile() {
  const query = `(max-width: ${MOBILE_BREAKPOINT}px)`;
  const [isMobile, setIsMobile] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setIsMobile(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [query]);
  return isMobile;
}

/**
 * Higher = better match, 0 = excluded. Every typed token must hit at least
 * one field (AND across tokens, so "hornady 143 eld-x" narrows correctly);
 * within a token, a match at the START of the most-specific field (the
 * cartridge -- what you're actually shopping for) outranks a start-match on
 * a less specific field, which outranks any mid-string hit -- so "308" leads
 * with 308 Win rows, not a manufacturer named something-with-308-in-it.
 */
function scoreEntry(a, tokens) {
  if (tokens.length === 0) return 1;
  const fields = [
    { text: a.cartridge.toLowerCase(), weight: 100 },
    { text: a.manufacturer.toLowerCase(), weight: 60 },
    { text: a.bullet.toLowerCase(), weight: 50 },
    { text: String(a.grains), weight: 30 },
  ];
  let total = 0;
  for (const tok of tokens) {
    let best = 0;
    for (const f of fields) {
      const idx = f.text.indexOf(tok);
      if (idx === -1) continue;
      best = Math.max(best, idx === 0 ? f.weight : f.weight * 0.3);
    }
    if (best === 0) return 0;
    total += best;
  }
  return total;
}

const detailText = (a) =>
  `${a.grains}gr ${a.bullet} · ${a.dragModel} ${a.ballisticCoefficient} · ${a.muzzleVelocity} fps` +
  (a.bcSource !== "published" ? " (derived BC)" : "");

// Screen readers don't perceive the two-line visual layout the way a
// sighted user scans caliber/brand against grains/bullet/BC/MV -- role=
// option's accessible name has to be one well-formed string covering every
// field itself, derived-BC note included.
const accessibleLabel = (a) =>
  `${a.cartridge}, ${a.manufacturer}, ${a.grains}gr ${a.bullet}, ${a.dragModel} ${a.ballisticCoefficient}, ${a.muzzleVelocity} fps` +
  (a.bcSource !== "published" ? DERIVED_BC_NOTE : "");

export default function CommercialLoadPicker({ onSelect, resetLoadAfterSelect = false }) {
  const id = useId();
  const isMobile = useIsMobile();
  const inputRef = useRef(null);

  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [activeCalibers, setActiveCalibers] = useState(() => new Set());
  const [activeManufacturers, setActiveManufacturers] = useState(() => new Set());
  const [committed, setCommitted] = useState(null); // non-reset mode: the load shown in the closed box
  const [lastApplied, setLastApplied] = useState(null); // reset mode: the "Added: ..." chip

  const results = useMemo(() => {
    const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    let pool = COMMERCIAL_AMMO;
    if (activeCalibers.size) pool = pool.filter((a) => activeCalibers.has(a.cartridge));
    if (activeManufacturers.size) pool = pool.filter((a) => activeManufacturers.has(a.manufacturer));
    const scored = [];
    for (const a of pool) {
      const s = scoreEntry(a, tokens);
      if (s > 0) scored.push([s, a]);
    }
    scored.sort(([sa, a], [sb, b]) => sb - sa || a.cartridge.localeCompare(b.cartridge) || a.grains - b.grains);
    return scored.map(([, a]) => a);
  }, [query, activeCalibers, activeManufacturers]);

  const shown = results.slice(0, MAX_RESULTS);

  // Chip-picker option pools narrow each other the same dependency way the
  // old mandatory cascade did -- just optional now instead of sequential.
  const calibersAvailable = useMemo(() => {
    const pool = activeManufacturers.size
      ? COMMERCIAL_AMMO.filter((a) => activeManufacturers.has(a.manufacturer))
      : COMMERCIAL_AMMO;
    const set = new Set(pool.map((a) => a.cartridge));
    return ALL_CALIBERS.filter((c) => set.has(c) && !activeCalibers.has(c));
  }, [activeManufacturers, activeCalibers]);
  const manufacturersAvailable = useMemo(() => {
    const pool = activeCalibers.size
      ? COMMERCIAL_AMMO.filter((a) => activeCalibers.has(a.cartridge))
      : COMMERCIAL_AMMO;
    const set = new Set(pool.map((a) => a.manufacturer));
    return ALL_MANUFACTURERS.filter((m) => set.has(m) && !activeManufacturers.has(m));
  }, [activeCalibers, activeManufacturers]);

  useEffect(() => setHighlight(0), [query, activeCalibers, activeManufacturers]);

  const commit = (ammo) => {
    // Always clear the typed query, not just in reset mode -- otherwise the
    // stale search text ("gold medal 175") would keep showing in the box
    // instead of falling through to the committed-load display below.
    setQuery("");
    if (resetLoadAfterSelect) setLastApplied(ammo);
    else setCommitted(ammo);
    setOpen(false);
    onSelect(ammo);
    // Ready for a completely different next search either way -- resetting
    // focus back into the input (rather than blurring) is what makes "pick,
    // then immediately type a new query" actually work in one motion.
    inputRef.current?.focus();
  };

  const openDropdown = () => { setOpen(true); setHighlight(0); };

  const handleKeyDown = (e) => {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "Enter") openDropdown();
      return;
    }
    if (e.key === "ArrowDown") { e.preventDefault(); setHighlight((h) => Math.min(h + 1, shown.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHighlight((h) => Math.max(h - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); if (shown[highlight]) commit(shown[highlight]); }
    else if (e.key === "Escape") { setOpen(false); if (isMobile) inputRef.current?.blur(); }
  };

  const addCaliber = (c) => { setActiveCalibers((s) => new Set(s).add(c)); setLastApplied(null); };
  const removeCaliber = (c) => setActiveCalibers((s) => { const n = new Set(s); n.delete(c); return n; });
  const addManufacturer = (m) => { setActiveManufacturers((s) => new Set(s).add(m)); setLastApplied(null); };
  const removeManufacturer = (m) => setActiveManufacturers((s) => { const n = new Set(s); n.delete(m); return n; });

  // Sheet takes over the input on mobile once open, so the inline copy has
  // to step aside -- otherwise the same ref would end up attached to two
  // DOM nodes rendered in two different places at once.
  const inputVisibleInline = !(isMobile && open);
  useEffect(() => {
    if (isMobile && open) inputRef.current?.focus();
  }, [isMobile, open]);

  const displayValue = open || query ? query : committed ? `${committed.cartridge} — ${committed.manufacturer} · ${committed.grains}gr ${committed.bullet}` : "";
  const listboxId = `${id}-listbox`;

  const inputEl = (
    <input
      ref={inputRef}
      role="combobox"
      aria-expanded={open}
      aria-controls={listboxId}
      aria-autocomplete="list"
      aria-activedescendant={open && shown[highlight] ? `${id}-opt-${highlight}` : undefined}
      aria-label="Search the ammo catalog"
      value={displayValue}
      placeholder="Search caliber, manufacturer, or bullet…"
      autoComplete="off"
      onFocus={openDropdown}
      onClick={openDropdown}
      onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
      onKeyDown={handleKeyDown}
      onBlur={() => { if (!isMobile) setOpen(false); }}
      style={{ width: "100%", padding: "8px 10px", border: `1.5px solid ${C.rule}`,
               background: C.inputBg, color: C.ink, font: "500 13px 'IBM Plex Mono',monospace" }}
    />
  );

  const chips = (
    <FilterChips
      activeCalibers={[...activeCalibers]} activeManufacturers={[...activeManufacturers]}
      onRemoveCaliber={removeCaliber} onRemoveManufacturer={removeManufacturer}
      onAddCaliber={addCaliber} onAddManufacturer={addManufacturer}
      calibersAvailable={calibersAvailable} manufacturersAvailable={manufacturersAvailable}
    />
  );

  const resultsPanel = (
    <ResultsList
      id={listboxId} results={shown} totalMatches={results.length} highlight={highlight}
      onHover={setHighlight} onCommit={commit} idPrefix={id}
    />
  );

  return (
    <div style={{ marginBottom: 5 }}>
      {/* The always-on-page trigger: chips + input, no results panel. Hidden
          while the mobile sheet is open -- the sheet renders its own copy of
          chips+input instead, so this and the sheet are never both showing
          the interactive controls at once (which would mean two inputs
          fighting over one ref, and two independent live filter-chip UIs). */}
      {inputVisibleInline && (
        <>
          {chips}
          <div style={{ position: "relative" }}>
            {inputEl}
            {open && !isMobile && (
              <div style={{ position: "absolute", zIndex: 10, top: "100%", left: 0, right: 0, marginTop: 2,
                            background: C.card, border: `1.5px solid ${C.rule}`,
                            maxHeight: 340, overflowY: "auto" }}
                   onMouseDown={(e) => e.preventDefault()}>
                {resultsPanel}
              </div>
            )}
          </div>
        </>
      )}

      {isMobile && open && (
        <MobileSheet onClose={() => setOpen(false)} inputEl={inputEl} chips={chips}>
          {resultsPanel}
        </MobileSheet>
      )}

      {committed ? null : lastApplied ? (
        <div style={{ marginTop: 6, padding: "7px 9px", background: C.field, border: `1px solid ${C.rule}`,
                      font: "500 11px/1.4 'IBM Plex Mono',monospace", color: C.ink }}>
          Added: {lastApplied.cartridge} — {lastApplied.manufacturer}, {detailText(lastApplied)} — search again to add another.
        </div>
      ) : null}
    </div>
  );
}

/**
 * Shared between the desktop dropdown and the mobile sheet -- the one
 * piece most likely to visually drift if built twice, so it isn't.
 */
function ResultsList({ id, results, totalMatches, highlight, onHover, onCommit, idPrefix }) {
  if (results.length === 0) {
    return (
      <div style={{ padding: "10px 10px", font: "400 12px 'IBM Plex Sans',sans-serif", color: C.muted }}>
        No matches
      </div>
    );
  }
  return (
    <div role="listbox" id={id}>
      {/* A count on 3 results is noise, not help -- only worth saying once
          there's actually more to sift through than the capped list shows. */}
      {totalMatches > COUNT_THRESHOLD && (
        <div style={{ padding: "6px 10px", font: "600 10.5px 'IBM Plex Sans',sans-serif", color: C.muted,
                      borderBottom: `1px solid ${C.rule}` }}>
          {totalMatches} matches — narrow by typing more{results.length < totalMatches ? ` (showing top ${results.length})` : ""}
        </div>
      )}
      {results.map((a, i) => (
        <div
          key={a.id}
          id={`${idPrefix}-opt-${i}`}
          role="option"
          aria-selected={i === highlight}
          aria-label={accessibleLabel(a)}
          onMouseDown={(e) => { e.preventDefault(); onCommit(a); }}
          onMouseEnter={() => onHover(i)}
          style={{ padding: "7px 10px", cursor: "pointer", background: i === highlight ? C.field : C.card,
                   borderBottom: `1px solid ${C.rule}` }}
        >
          <div style={{ font: "600 13px 'IBM Plex Mono',monospace", color: C.ink }}>
            {a.cartridge} — {a.manufacturer}
          </div>
          <div style={{ font: "400 11.5px 'IBM Plex Sans',sans-serif", color: C.muted }}>
            {detailText(a)}
          </div>
        </div>
      ))}
    </div>
  );
}

function FilterChips({
  activeCalibers, activeManufacturers, onRemoveCaliber, onRemoveManufacturer,
  onAddCaliber, onAddManufacturer, calibersAvailable, manufacturersAvailable,
}) {
  const hasChips = activeCalibers.length > 0 || activeManufacturers.length > 0;
  return (
    <div style={{ marginBottom: 6 }}>
      {hasChips && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 6 }}>
          {activeCalibers.map((c) => <Chip key={`c-${c}`} text={c} onRemove={() => onRemoveCaliber(c)} />)}
          {activeManufacturers.map((m) => <Chip key={`m-${m}`} text={m} onRemove={() => onRemoveManufacturer(m)} />)}
        </div>
      )}
      <div style={{ display: "flex", gap: 6 }}>
        <div style={{ flex: 1 }}>
          <AddFilterPicker placeholder="+ Caliber filter" options={calibersAvailable} onPick={onAddCaliber} />
        </div>
        <div style={{ flex: 1 }}>
          <AddFilterPicker placeholder="+ Manufacturer filter" options={manufacturersAvailable} onPick={onAddManufacturer} />
        </div>
      </div>
    </div>
  );
}

function Chip({ text, onRemove }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 4px 3px 8px",
                    background: C.field, border: `1px solid ${C.rule}`,
                    font: "500 11px 'IBM Plex Sans',sans-serif", color: C.ink }}>
      {text}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${text} filter`}
        style={{ background: "none", border: "none", cursor: "pointer", padding: "0 3px",
                 color: C.ox, font: "600 12px 'IBM Plex Mono',monospace" }}
      >
        &times;
      </button>
    </span>
  );
}

/** A tiny single-pick typeahead that adds a chip then clears itself, ready to add another. */
function AddFilterPicker({ placeholder, options, onPick }) {
  const id = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => o.toLowerCase().includes(q)) : options;
  }, [options, query]);

  const commit = (opt) => { onPick(opt); setQuery(""); setOpen(false); };

  return (
    <div style={{ position: "relative" }}>
      <input
        aria-label={placeholder}
        value={query}
        placeholder={placeholder}
        autoComplete="off"
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => { if (e.key === "Enter" && filtered[0]) { e.preventDefault(); commit(filtered[0]); } }}
        style={{ width: "100%", padding: "5px 7px", border: `1px solid ${C.rule}`,
                 background: C.card, color: C.ink, font: "400 11.5px 'IBM Plex Sans',sans-serif" }}
      />
      {open && filtered.length > 0 && (
        <div
          onMouseDown={(e) => e.preventDefault()}
          style={{ position: "absolute", zIndex: 11, top: "100%", left: 0, right: 0, maxHeight: 180,
                   overflowY: "auto", background: C.card, border: `1px solid ${C.rule}` }}
        >
          {filtered.slice(0, 50).map((o) => (
            <div
              key={o}
              onMouseDown={(e) => { e.preventDefault(); commit(o); }}
              style={{ padding: "5px 7px", cursor: "pointer", font: "400 11.5px 'IBM Plex Sans',sans-serif", color: C.ink }}
            >
              {o}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Full-screen: a popover has nowhere to "click outside" to on a phone, so this needs its own explicit close affordance. */
function MobileSheet({ onClose, inputEl, chips, children }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, background: C.card, display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 10px 8px",
                    borderBottom: `1.5px solid ${C.rule}` }}>
        <div style={{ flex: 1 }}>{inputEl}</div>
        <button
          type="button"
          onClick={onClose}
          style={{ flexShrink: 0, padding: "8px 10px", background: C.ink, color: C.card, border: "none",
                   cursor: "pointer", font: "600 11px 'Oswald',sans-serif", letterSpacing: ".08em" }}
        >
          Cancel
        </button>
      </div>
      <div style={{ padding: "8px 10px 0" }}>{chips}</div>
      <div style={{ flex: 1, overflowY: "auto" }}>{children}</div>
    </div>
  );
}
