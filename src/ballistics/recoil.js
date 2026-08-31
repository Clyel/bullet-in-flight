// Free recoil energy/velocity, per SAAMI's own technical standard, sourced
// directly: "Gun Recoil - Technical" (Rev. 7/9/2018),
// https://saami.org/wp-content/uploads/2025/03/Gun-Recoil-Formulae-2018-07-9.pdf
//
// This is exact physics -- conservation of momentum plus kinetic energy,
// the same rigor as the trajectory solver -- not an empirical curve fit, so
// (per the physics-specific rule in the project's own ground rules) it
// doesn't need independent-source fixtures the way solver.js's drag
// physics did. It still deserves a self-consistency check: reproduce
// SAAMI's own worked example and confirm this code lands on their stated
// answer, not just something plausible-looking. See the "SAAMI worked
// example" block in test/solver.test.mjs.
//
// "Felt" (perceived) recoil is deliberately NOT modeled here. SAAMI's own
// document says directly that stock geometry, recoil pads/dampers, and
// action type all affect how recoil actually feels, and none of that
// reduces to a formula -- computing a fake "felt recoil" number would be
// exactly the kind of thing this project avoids. This module is Free
// Recoil Energy only, and should always be labeled as such in the UI.

import { CASE_CAPACITY } from "../data/caseCapacity.js";

// SAAMI's own stated constants -- 32.17 ft/s^2 for gravity, giving the
// 64.34 (= 2*32.17) seen directly in their formula. Deliberately NOT the
// same GRAVITY constant solver.js/atmosphere.js use (32.174) -- this
// module stays faithful to the source it's implementing, not forced into
// consistency with an unrelated module. The difference (0.01%) is immaterial
// either way.
const GRAVITY_FPS2 = 32.17;
const GRAINS_PER_LB = 7000;

/** VPG = factor * muzzle velocity. SAAMI's stated factor per firearm type -- this app is rifle-only. */
export const GAS_VELOCITY_FACTOR_RIFLE = 1.75;

/**
 * Free recoil velocity of the firearm, in fps.
 *
 * @param bulletWeightGr - ejecta (bullet) weight, grains
 * @param muzzleVelocityFps - bullet velocity at the muzzle, fps
 * @param powderChargeGr - propellant charge weight, grains (SAAMI equates
 *        propellant gas weight to charge weight, since gas weight itself is
 *        impractical to measure)
 * @param rifleWeightLb - firearm weight including attachments (scope,
 *        suppressor, etc.), pounds
 * @param gasVelocityFactor - VPG = factor * muzzleVelocityFps
 */
export function freeRecoilVelocity(
  bulletWeightGr, muzzleVelocityFps, powderChargeGr, rifleWeightLb,
  gasVelocityFactor = GAS_VELOCITY_FACTOR_RIFLE
) {
  if (!(rifleWeightLb > 0)) {
    throw new Error("Rifle weight must be greater than zero.");
  }
  const gasVelocityFps = gasVelocityFactor * muzzleVelocityFps;
  return (bulletWeightGr * muzzleVelocityFps + powderChargeGr * gasVelocityFps) / (GRAINS_PER_LB * rifleWeightLb);
}

/**
 * Free Recoil Energy, in ft-lb. FRE = (WF/64.34) * V^2, where V is the free
 * recoil velocity above -- this is just kinetic energy, 0.5*M*V^2 with
 * M = WF/32.17.
 */
export function freeRecoilEnergy(
  bulletWeightGr, muzzleVelocityFps, powderChargeGr, rifleWeightLb,
  gasVelocityFactor = GAS_VELOCITY_FACTOR_RIFLE
) {
  const v = freeRecoilVelocity(bulletWeightGr, muzzleVelocityFps, powderChargeGr, rifleWeightLb, gasVelocityFactor);
  return (rifleWeightLb / (2 * GRAVITY_FPS2)) * v * v;
}

// Nosler's own load-data sheets publish real "LOAD DENSITY (VOLUME)"
// percentages for actual tested loads; across the ones checked while
// sourcing caseCapacity.js, max-charge loads clustered 90-98%, well above
// the generic "80-90% is typical for factory ammo" figure found first via
// general handloading references. 90% sits at the low end of Nosler's own
// observed range, a deliberately conservative (not generous) pick.
export const DEFAULT_LOAD_DENSITY = 0.90;

/**
 * Estimates powder charge weight (grains) from a cartridge's case capacity
 * and an assumed load density. This is NOT measured data -- an
 * approximation, same caveat as commercialAmmo.js's derived BC values, and
 * should carry the same explicit "estimated" labeling in the UI, never
 * presented as if it were a real published charge weight.
 *
 * @returns the estimate in grains, or null if this cartridge isn't in
 *          caseCapacity.js (see that file for coverage and why).
 */
export function estimateChargeWeight(cartridge, loadDensity = DEFAULT_LOAD_DENSITY) {
  const entry = CASE_CAPACITY[cartridge];
  if (!entry) return null;
  return entry.caseCapacityGrWater * loadDensity;
}
