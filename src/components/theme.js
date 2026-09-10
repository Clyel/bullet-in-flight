// Field-card palette: drab card stock, blued steel, cartridge brass, oxblood.
// The actual values live in styles.css `:root` -- these are var() refs, so
// an inline `style={{ color: C.muted }}` resolves through CSS and themes
// itself when the dark block redefines the tokens. Nothing here does colour
// math on the strings; if that's ever needed, read the computed value off
// the element rather than parsing these.
export const C = {
  field:   "var(--c-field)",
  card:    "var(--c-card)",
  cardAlt: "var(--c-card-alt)",
  ink:     "var(--c-ink)",
  muted:   "var(--c-muted)",
  rule:    "var(--c-rule)",
  inputBg: "var(--c-input-bg)",
  brass:   "var(--c-brass)",
  ox:      "var(--c-ox)",
  steel:   "var(--c-steel)",
  vitals:  "var(--c-vitals)",
};

export const label = {
  // Bumped 10px -> 12px (review §2: 10px labels/hints fail the size floor).
  // Tracking eased from .14em since the larger glyphs need less of it.
  font: "600 12px 'Oswald',sans-serif",
  letterSpacing: ".1em",
  textTransform: "uppercase",
  color: C.muted,
};

export const numeric = {
  font: "500 13px 'IBM Plex Mono',monospace",
  color: C.ink,
};
