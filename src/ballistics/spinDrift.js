// Spin drift: the lateral deflection of a spin-stabilized bullet from
// gyroscopic precession -- a real, independent physical effect, not a
// read-off of the already-validated trajectory (unlike vitalsWindow.js /
// reticleGroups.js / inclineComp.js), so per this project's physics rule it
// needs fixtures from an independent source, not just a self-consistency
// check. That source is py-ballisticcalc, same as the wind fixtures --
// see test/fixtures/generate.py's SPIN_DRIFT_CASES and this file's own
// hand-verified derivation below.
//
// Formula: the Litz gyroscopic approximation over the Miller stability
// coefficient (SG) -- textbook, used near-identically by every commercial
// ballistic calculator (Hornady 4DOF, JBM, Applied Ballistics). Verified
// against py-ballisticcalc's own shot.py (_calc_stability_coefficient +
// spin_drift) line for line; the only unit difference is that
// py-ballisticcalc's internal windage is in feet (its spin_drift divides
// by 12) where this app's is already in inches (see solver.js's own
// docstring: "y and z in inches"), so this file's output skips that /12.
//
// Deliberately manual-entry-only (twist rate, bullet length, diameter) --
// bullet length isn't published anywhere in this app's 1,800-load catalog
// (confirmed when this was scoped; sourcing it would be its own project),
// so there's nothing to auto-fill even for a catalog pick. All three
// inputs optional, mirroring wind's "blank means the effect is off"
// pattern -- missing or non-positive twist/length/diameter/pressure
// returns a stability of 0, and spinDriftIn returns 0 without throwing.

/**
 * Miller gyroscopic stability coefficient (SG). Unitless; > 1 is generally
 * considered adequately stable, well under 1 means the bullet may fail to
 * stabilize (tumble) -- SG itself isn't surfaced in the UI today, just
 * consumed by spinDriftIn, but it's exported since it's the natural unit
 * to test independently against py-ballisticcalc's own value.
 */
export function millerStability({ twistIn, diameterIn, lengthIn, grains, muzzleVelocityFps, tempF, pressInHg }) {
  if (!(twistIn && diameterIn > 0 && lengthIn > 0 && grains > 0 && muzzleVelocityFps > 0 && pressInHg > 0)) {
    return 0;
  }
  const twistCal = Math.abs(twistIn) / diameterIn; // twist rate in calibers per turn
  const lengthCal = lengthIn / diameterIn; // bullet length in calibers
  const sd =
    (30 * grains) /
    (twistCal ** 2 * diameterIn ** 3 * lengthCal * (1 + lengthCal ** 2));
  const fv = (muzzleVelocityFps / 2800) ** (1 / 3); // velocity correction
  const ftp = ((tempF + 460) / (59 + 460)) * (29.92 / pressInHg); // atmospheric correction
  return sd * fv * ftp;
}

/**
 * Spin-drift windage at a given time of flight, in inches -- positive is
 * the shooter's right (this app's windage convention, see solver.js).
 * `twistIn`'s own sign carries handedness: positive (the overwhelming
 * majority of factory rifles) is right-hand twist and drifts right;
 * negative is left-hand and drifts left. Returns 0 (no effect) whenever
 * millerStability can't compute one, i.e. any of the manual fields is
 * missing or the bullet won't stabilize under these inputs.
 */
export function spinDriftIn(timeSec, params) {
  const sg = millerStability(params);
  if (sg <= 0 || !params.twistIn) return 0;
  const sign = params.twistIn > 0 ? 1 : -1;
  return sign * 1.25 * (sg + 1.2) * timeSec ** 1.83;
}
