// Supabase-backed equivalent of savedLoads.js's localStorage functions —
// same list/save/delete shape, so useSavedLoads.js can swap between the two
// without either caller-facing API needing to change. Never imported
// directly by page components; always go through useSavedLoads.js, which
// decides which of the two backends applies.
import { supabase } from "../supabaseClient.js";

// Every local form field is a STRING (this app's own convention -- see
// Calculator.jsx's DEFAULTS), but the DB columns are `numeric`. Postgres
// rejects "" for a numeric column outright, so blank optional fields (wind)
// must become null, not "" -- and numbers need real parsing both ways.
const NUMERIC_FIELDS = [
  "muzzleVelocity", "ballisticCoefficient", "grains", "sightHeight", "zeroRangeYd",
  "maxRangeYd", "tableStepYd", "tempF", "pressInHg", "altitudeFt", "windSpeedMph",
  "windClock", "vitalsRadiusIn",
];
const TEXT_FIELDS = ["dragModel", "cartridge", "manufacturer", "bullet"];

const DB_COLUMN = {
  muzzleVelocity: "muzzle_velocity", ballisticCoefficient: "ballistic_coefficient",
  grains: "grains", sightHeight: "sight_height", zeroRangeYd: "zero_range_yd",
  maxRangeYd: "max_range_yd", tableStepYd: "table_step_yd", tempF: "temp_f",
  pressInHg: "press_in_hg", altitudeFt: "altitude_ft", windSpeedMph: "wind_speed_mph",
  windClock: "wind_clock", vitalsRadiusIn: "vitals_radius_in", dragModel: "drag_model",
  cartridge: "catalog_cartridge", manufacturer: "catalog_manufacturer", bullet: "catalog_bullet",
};

/** Local form-state (all strings) -> a DB row (numbers/nulls, snake_case). */
function toRow(name, formState) {
  const row = { name };
  for (const key of NUMERIC_FIELDS) {
    const raw = formState[key];
    const n = parseFloat(raw);
    row[DB_COLUMN[key]] = Number.isFinite(n) ? n : null;
  }
  for (const key of TEXT_FIELDS) {
    row[DB_COLUMN[key]] = formState[key] || null;
  }
  return row;
}

/** A DB row -> local form-state shape (all strings, matching what Field/UnitField expect). */
function fromRow(row) {
  const formState = { id: row.id, name: row.name, savedAt: row.updated_at };
  for (const key of NUMERIC_FIELDS) {
    const v = row[DB_COLUMN[key]];
    formState[key] = v === null || v === undefined ? "" : String(v);
  }
  for (const key of TEXT_FIELDS) {
    formState[key] = row[DB_COLUMN[key]] || "";
  }
  return formState;
}

/** All saved loads for the signed-in user, alphabetical by name. */
export async function listSavedLoadsCloud() {
  const { data, error } = await supabase.from("saved_loads").select("*").order("name");
  if (error) return { data: [], error };
  return { data: data.map(fromRow), error: null };
}

/**
 * Saves formState under name, overwriting any existing cloud load with the
 * same name (mirrors savedLoads.js's local overwrite-by-name behavior).
 * Surfaces the raw Postgres error on failure (e.g. a NOT NULL violation if
 * a required field was left blank) rather than swallowing it -- unlike
 * localStorage, the DB actually enforces the schema, so a bad save here is
 * a real, visible failure, not a silent no-op.
 */
export async function saveLoadCloud(name, formState) {
  const { data: existing } = await supabase.from("saved_loads").select("id").eq("name", name).maybeSingle();
  const row = toRow(name, formState);
  const query = existing
    ? supabase.from("saved_loads").update(row).eq("id", existing.id)
    : supabase.from("saved_loads").insert(row);
  const { error } = await query;
  return { error };
}

export async function deleteLoadCloud(id) {
  const { error } = await supabase.from("saved_loads").delete().eq("id", id);
  return { error };
}

/**
 * One-time bulk import of a device's local saves into the signed-in
 * account. Each local load is inserted as a NEW cloud row (never matched
 * against an existing cloud load by name) -- this only ever runs once per
 * account+device pairing (see useSavedLoads.js's dismissal tracking), so
 * there's no meaningful "overwrite" case to consider here.
 */
export async function importLocalLoadsToCloud(localLoads) {
  const rows = localLoads.map((l) => {
    const { id: _id, name, savedAt: _savedAt, ...formState } = l;
    return toRow(name, formState);
  });
  if (rows.length === 0) return { error: null };
  const { error } = await supabase.from("saved_loads").insert(rows);
  return { error };
}
