// Conversion between canonical imperial (what the solver, fixtures, and
// angular.js always use) and metric, for display and input only. Nothing
// downstream of a form ever sees a non-canonical value — components convert
// right at render (canonical -> display) and right at input (display ->
// canonical), by category, so the physics core never has to know units
// exist beyond what it already assumes.

export const ydToM = (yd) => yd * 0.9144;
export const mToYd = (m) => m / 0.9144;
export const ftToM = (ft) => ft * 0.3048;
export const mToFt = (m) => m / 0.3048;
export const inToCm = (inches) => inches * 2.54;
export const cmToIn = (cm) => cm / 2.54;
export const fpsToMps = (fps) => fps * 0.3048;
export const mpsToFps = (mps) => mps / 0.3048;
export const mphToKmh = (mph) => mph * 1.609344;
export const kmhToMph = (kmh) => kmh / 1.609344;
export const fToC = (f) => ((f - 32) * 5) / 9;
export const cToF = (c) => (c * 9) / 5 + 32;
export const inHgToHPa = (inHg) => inHg * 33.8639;
export const hPaToInHg = (hPa) => hPa / 33.8639;

// Wind speed is its own category (mph/km/h), deliberately distinct from
// muzzle velocity (fps/mps) — matches the convention already used for wind
// (mph) vs. bullet speed (fps) in the solver itself.
// `digits`: decimal places to show when formatting a value for display in
// this category, under either unit system — just enough precision to be
// useful without spilling float noise into the input fields.
export const CATEGORIES = {
  distance:    { imperial: "yd",  metric: "m",    toMetric: ydToM,     toImperial: mToYd,   digits: 1 },
  altitude:    { imperial: "ft",  metric: "m",    toMetric: ftToM,     toImperial: mToFt,   digits: 1 },
  length:      { imperial: "in",  metric: "cm",   toMetric: inToCm,    toImperial: cmToIn,  digits: 2 },
  velocity:    { imperial: "fps", metric: "mps",  toMetric: fpsToMps,  toImperial: mpsToFps, digits: 1 },
  windSpeed:   { imperial: "mph", metric: "km/h", toMetric: mphToKmh, toImperial: kmhToMph, digits: 1 },
  temperature: { imperial: "°F", metric: "°C", toMetric: fToC, toImperial: cToF,             digits: 1 },
  pressure:    { imperial: "inHg", metric: "hPa", toMetric: inHgToHPa, toImperial: hPaToInHg, digits: 2 },
};

/** Canonical (always-imperial) value -> the number to show under `system`. */
export function toDisplay(canonicalValue, category, system) {
  if (!Number.isFinite(canonicalValue)) return canonicalValue;
  return system === "metric" ? CATEGORIES[category].toMetric(canonicalValue) : canonicalValue;
}

/** What the user entered under `system` -> canonical (always-imperial). */
export function toCanonical(displayValue, category, system) {
  if (!Number.isFinite(displayValue)) return displayValue;
  return system === "metric" ? CATEGORIES[category].toImperial(displayValue) : displayValue;
}

/** The unit suffix to show for `category` under `system`. */
export function unitSuffix(category, system) {
  return system === "metric" ? CATEGORIES[category].metric : CATEGORIES[category].imperial;
}

const round = (n, digits) => Math.round(n * 10 ** digits) / 10 ** digits;

/** Canonical value -> a display-ready string, rounded to the category's precision. Read-only display use (tables, chart labels) — always safe to reformat. */
export function formatDisplay(canonicalValue, category, system) {
  const n = toDisplay(canonicalValue, category, system);
  return Number.isFinite(n) ? String(round(n, CATEGORIES[category].digits)) : "";
}

/**
 * The two functions below are for *editable* fields specifically, where
 * reformatting on every keystroke would fight the user (stripping a
 * trailing "0" or "." they're still typing). In Imperial they pass the raw
 * string straight through, untouched — identical to this app's pre-units
 * behavior — and only actually convert/round when Metric is active, so a
 * unit switch doesn't leave float noise in the stored value.
 */

/** Canonical (raw string as stored in form state) -> what the field should display. */
export function fieldDisplayValue(rawCanonical, category, system) {
  if (system !== "metric") return rawCanonical;
  const n = parseFloat(rawCanonical);
  if (!Number.isFinite(n)) return rawCanonical;
  return String(round(toDisplay(n, category, system), CATEGORIES[category].digits));
}

/** What the user just typed -> the raw string to store as canonical. */
export function fieldCanonicalValue(typed, category, system) {
  if (system !== "metric") return typed;
  const n = parseFloat(typed);
  if (!Number.isFinite(n)) return typed;
  return String(round(toCanonical(n, category, system), CATEGORIES[category].digits + 2));
}
