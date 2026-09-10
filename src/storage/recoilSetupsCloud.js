// Supabase-backed equivalent of recoilSetups.js's localStorage functions —
// same list/add/delete shape (insert-only, no overwrite-by-name), so
// useRecoilSetups.js can swap between the two without either caller-facing
// API needing to change. Mirrors savedLoadsCloud.js's own structure.
import { getSupabase } from "../supabaseClient.js";

const NUMERIC_FIELDS = ["rifleWeightLb", "grains", "muzzleVelocity", "chargeGr"];
const DB_COLUMN = {
  rifleWeightLb: "rifle_weight_lb", grains: "grains", muzzleVelocity: "muzzle_velocity", chargeGr: "charge_gr",
};

/** Local setup (all strings, per this app's own form-state convention) -> a DB row. */
function toRow(setup) {
  const row = { name: setup.name, cartridge: setup.cartridge || null, charge_is_estimate: Boolean(setup.chargeIsEstimate) };
  for (const key of NUMERIC_FIELDS) {
    const n = parseFloat(setup[key]);
    row[DB_COLUMN[key]] = Number.isFinite(n) ? n : null;
  }
  return row;
}

/** A DB row -> local setup shape (all strings, matching what Field/UnitField expect). */
function fromRow(row) {
  return {
    id: row.id,
    name: row.name,
    cartridge: row.cartridge || "",
    rifleWeightLb: String(row.rifle_weight_lb),
    grains: String(row.grains),
    muzzleVelocity: String(row.muzzle_velocity),
    chargeGr: String(row.charge_gr),
    chargeIsEstimate: Boolean(row.charge_is_estimate),
  };
}

/** All recoil setups for the signed-in user, in the order they were added. */
export async function listRecoilSetupsCloud() {
  const supabase = await getSupabase();
  const { data, error } = await supabase.from("recoil_setups").select("*").order("created_at");
  if (error) return { data: [], error };
  return { data: data.map(fromRow), error: null };
}

export async function addRecoilSetupCloud(setup) {
  const supabase = await getSupabase();
  const { error } = await supabase.from("recoil_setups").insert(toRow(setup));
  return { error };
}

export async function deleteRecoilSetupCloud(id) {
  const supabase = await getSupabase();
  const { error } = await supabase.from("recoil_setups").delete().eq("id", id);
  return { error };
}

/** One-time bulk import of a device's local setups into the signed-in account. */
export async function importLocalRecoilSetupsToCloud(localSetups) {
  const supabase = await getSupabase();
  const rows = localSetups.map(toRow);
  if (rows.length === 0) return { error: null };
  const { error } = await supabase.from("recoil_setups").insert(rows);
  return { error };
}
