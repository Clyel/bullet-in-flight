// Supabase-backed equivalent of savedLoads.js's localStorage functions —
// same list/save/delete shape, so useSavedLoads.js can swap between the two
// without either caller-facing API needing to change. Never imported
// directly by page components; always go through useSavedLoads.js, which
// decides which of the two backends applies.
import { getSupabase } from "../supabaseClient.js";

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
  // The DB default only fires on INSERT; an upsert that resolves to UPDATE
  // would otherwise leave updated_at frozen at creation time (fromRow maps
  // it to `savedAt`). Set it explicitly so a re-save actually reflects when.
  row.updated_at = new Date().toISOString();
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
  const supabase = await getSupabase();
  const { data, error } = await supabase.from("saved_loads").select("*").order("name");
  if (error) return { data: [], error };
  return { data: data.map(fromRow), error: null };
}

/**
 * Saves formState under name, overwriting any existing cloud load with the
 * same name (mirrors savedLoads.js's local overwrite-by-name behavior).
 * One atomic upsert on the (user_id, name) unique constraint — no
 * select-then-write window where two quick saves of a new name each think
 * they're the first and both insert. user_id is filled by the column's
 * `default auth.uid()` on insert and is unchanged on update, so it never
 * has to be sent from the client. Surfaces the raw Postgres error on
 * failure (e.g. a NOT NULL violation if a required field was left blank)
 * rather than swallowing it -- unlike localStorage, the DB actually
 * enforces the schema, so a bad save here is a real, visible failure.
 */
export async function saveLoadCloud(name, formState) {
  const supabase = await getSupabase();
  const { error } = await supabase
    .from("saved_loads")
    .upsert(toRow(name, formState), { onConflict: "user_id,name" });
  return { error };
}

export async function deleteLoadCloud(id) {
  const supabase = await getSupabase();
  const { error } = await supabase.from("saved_loads").delete().eq("id", id);
  return { error };
}

/**
 * One-time bulk import of a device's local saves into the signed-in
 * account (runs once per account+device pairing -- see useSavedLoads.js's
 * dismissal tracking). `ignoreDuplicates` on the (user_id, name) constraint
 * means a local load whose name already exists in the account is skipped,
 * not overwritten -- the cloud copy is the one the user has been actively
 * syncing, so it wins over a stale local namesake. Before the unique
 * constraint existed this was a plain insert that would have created a
 * duplicate row; now it can't.
 */
export async function importLocalLoadsToCloud(localLoads) {
  const supabase = await getSupabase();
  const rows = localLoads.map((l) => {
    const { id: _id, name, savedAt: _savedAt, ...formState } = l;
    return toRow(name, formState);
  });
  if (rows.length === 0) return { error: null };
  const { error } = await supabase
    .from("saved_loads")
    .upsert(rows, { onConflict: "user_id,name", ignoreDuplicates: true });
  return { error };
}
