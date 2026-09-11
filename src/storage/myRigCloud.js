// Supabase-backed side of the shared "My rig" -- the cloud equivalent of
// myRig.js's localStorage get/set. Same shape (a plain rig object of the
// five RIG_FIELDS, all strings), so useMyRig.js can layer the two without
// either caller-facing value changing. Never imported by page components;
// go through useMyRig().
//
// The rig lives in the one-row-per-user `user_settings` table (a row is
// created for every user by the handle_new_user() trigger in schema.sql,
// so this is always an UPDATE in practice, INSERT only for a pre-trigger
// account). The columns are `text` and the rig is strings end to end, so
// there's no numeric parsing here -- unlike savedLoadsCloud.js.
import { getSupabase } from "../supabaseClient.js";
import { RIG_FIELDS, RIG_DEFAULTS } from "./myRig.js";

const DB_COLUMN = {
  sightHeight: "sight_height",
  vitalsRadiusIn: "vitals_radius_in",
  tempF: "temp_f",
  pressInHg: "press_in_hg",
  altitudeFt: "altitude_ft",
};
const RIG_DB_COLUMNS = RIG_FIELDS.map((k) => DB_COLUMN[k]);

/** Rig object (all strings) -> the `user_settings` rig columns. */
function toRow(rig) {
  return Object.fromEntries(RIG_FIELDS.map((k) => [DB_COLUMN[k], rig[k] ?? null]));
}

/** A `user_settings` row -> a complete rig, RIG_DEFAULTS filling any null
 *  column (mirrors getMyRig()'s per-field fallback). */
function fromRow(row) {
  return Object.fromEntries(RIG_FIELDS.map((k) => [k, row[DB_COLUMN[k]] ?? RIG_DEFAULTS[k]]));
}

/**
 * The signed-in user's cloud rig, or `null` when there isn't one yet -- no
 * row, or a row whose rig columns are all still null (the state every
 * freshly-created account is in). `null` is useMyRig's cue to seed the
 * cloud from this device's local rig. RLS scopes the select to the caller,
 * so no user_id filter is needed.
 */
export async function getMyRigCloud() {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("user_settings")
    .select(RIG_DB_COLUMNS.join(", "))
    .maybeSingle();
  if (error) return { data: null, error };
  if (!data || RIG_DB_COLUMNS.every((c) => data[c] == null)) return { data: null, error: null };
  return { data: fromRow(data), error: null };
}

/**
 * Writes the rig to the user's `user_settings` row. `user_id` has no
 * `default auth.uid()` on this table (unlike saved_loads), so it's passed
 * explicitly and used as the upsert conflict target -- an existing row is
 * updated in place (unit_system and every other column untouched), a
 * missing one is inserted.
 */
export async function setMyRigCloud(userId, rig) {
  const supabase = await getSupabase();
  const { error } = await supabase
    .from("user_settings")
    .upsert({ user_id: userId, ...toRow(rig), updated_at: new Date().toISOString() },
            { onConflict: "user_id" });
  return { error };
}
