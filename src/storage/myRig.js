// "My rig" -- the rifle-and-conditions fields the Calculator and Optimal
// Zero forms both ask for: sight height, vitals radius, and the three
// atmosphere fields. Shared so you set them once instead of re-entering
// them on each tab. Deliberately smaller than Calculator's full input set:
// no zero (Optimal Zero computes it), no shot distance, no wind.
//
// Each tab reads this on mount and works from its own editable copy --
// editing a rig field never writes back here on its own, since that would
// silently change a comparison you'd set up on the other tab. It's only
// written when the user explicitly hits "Save as my rig". localStorage
// only for now (same as saved loads / recoil setups when they started); a
// signed-in cloud copy is a later add.

const STORAGE_KEY = "bullet-in-flight:myRig";

export const RIG_FIELDS = ["sightHeight", "vitalsRadiusIn", "tempF", "pressInHg", "altitudeFt"];

// Same values the two tabs used as their hardcoded defaults before this.
const RIG_DEFAULTS = {
  sightHeight: "1.5",
  vitalsRadiusIn: "3",
  tempF: "59",
  pressInHg: "29.92",
  altitudeFt: "0",
};

/** The saved rig, or the defaults. Falls back per-field so a partial or
 *  older stored blob still yields a complete rig. */
export function getMyRig() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (!parsed) return { ...RIG_DEFAULTS };
    return Object.fromEntries(RIG_FIELDS.map((k) => [k, parsed[k] ?? RIG_DEFAULTS[k]]));
  } catch {
    return { ...RIG_DEFAULTS };
  }
}

export function setMyRig(rig) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(RIG_FIELDS.map((k) => [k, rig[k]]))));
  } catch {
    // Storage unavailable (private browsing, quota) -- save silently no-ops.
  }
}

/** True if any rig field in `current` differs from `stored`. */
export function rigDiffers(current, stored) {
  return RIG_FIELDS.some((k) => current[k] !== stored[k]);
}
