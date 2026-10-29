// The Calculator form as the shooter left it, kept on this device so coming
// back (or a refresh) picks up where they were instead of the example load.
// Device-local even when signed in: it's a working scratchpad, not a saved
// load. The snapshot is versioned; anything that doesn't parse or doesn't
// match is ignored and the page opens on the example as usual.
//
// Stored: { version, form, rigTouched, bcOrigin }
//   form        every Calculator field (strings), merged over the current defaults on load
//   rigTouched  whether a rig field (sight height, atmosphere...) was edited by hand, so the
//               existing "Rig differs from your saved one" bar comes back only when it should
//   bcOrigin    {bullet, grains, bc, dragModel} behind the leftover-BC note, or null
// Not stored: the name being typed, the save confirmation, the picked answer distance,
// whether the catalog lock was opened.
const KEY = "bullet-in-flight:lastForm";
const VERSION = 1;

// Fields where "is a string" isn't enough: any other value would break the solve.
const ENUMS = { dragModel: ["G1", "G7"], twistDirection: ["Right", "Left"] };

const isStringRecord = (o, keys) => o && typeof o === "object" && keys.every((k) => typeof o[k] === "string");
const ORIGIN_KEYS = ["bullet", "grains", "bc", "dragModel"];

/** Pure: raw stored text -> { form, rigTouched, bcOrigin } or null. `defaults` fixes the set of known fields. */
export function parseLastForm(raw, defaults) {
  if (!raw) return null;
  let data;
  try { data = JSON.parse(raw); } catch { return null; }
  if (!data || data.version !== VERSION || !data.form || typeof data.form !== "object") return null;
  const form = {};
  for (const k of Object.keys(defaults)) {
    const value = data.form[k];
    if (typeof value === "string" && (!ENUMS[k] || ENUMS[k].includes(value))) form[k] = value;
  }
  const bcOrigin = isStringRecord(data.bcOrigin, ORIGIN_KEYS)
    ? Object.fromEntries(ORIGIN_KEYS.map((k) => [k, data.bcOrigin[k]]))
    : null;
  return { form, rigTouched: data.rigTouched === true, bcOrigin };
}

/** Pure: the text to store. */
export function serializeLastForm({ form, rigTouched, bcOrigin }, defaults) {
  return JSON.stringify({
    version: VERSION,
    form: Object.fromEntries(Object.keys(defaults).map((k) => [k, form[k]])),
    rigTouched: Boolean(rigTouched),
    bcOrigin: bcOrigin ?? null,
  });
}

export function loadLastForm(defaults) {
  try { return parseLastForm(localStorage.getItem(KEY), defaults); } catch { return null; }
}

export function saveLastForm(snapshot, defaults) {
  try { localStorage.setItem(KEY, serializeLastForm(snapshot, defaults)); } catch { /* private mode / quota */ }
}

export function clearLastForm() {
  try { localStorage.removeItem(KEY); } catch { /* nothing to clear */ }
}
