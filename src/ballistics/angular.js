// Linear-to-angular correction conversion. Not trajectory physics — just the
// geometry of how a scope's angular adjustment relates to a linear miss at
// a given range — so it needs no independent fixtures the way solver.js
// does, but the constants are worth documenting precisely rather than using
// the sloppy "1 MOA = 1 inch at 100 yd" shooter's shorthand.

// True MOA: 1/60 of a degree. tan(1/60 deg) * 100 yd * 36 in/yd ≈ 1.047 in.
const MOA_INCHES_PER_100YD = 1.047;
// 1 milliradian * 100 yd * 36 in/yd = 3.6 in, exactly (small-angle, no
// meaningful error at these ranges).
const MIL_INCHES_PER_100YD = 3.6;

/** Angular correction, in MOA, for a linear miss of `inches` at `rangeYd`. Undefined at 0 range. */
export function inchesToMOA(inches, rangeYd) {
  if (!(rangeYd > 0)) return null;
  return inches / (MOA_INCHES_PER_100YD * (rangeYd / 100));
}

/** Angular correction, in mils, for a linear miss of `inches` at `rangeYd`. Undefined at 0 range. */
export function inchesToMIL(inches, rangeYd) {
  if (!(rangeYd > 0)) return null;
  return inches / (MIL_INCHES_PER_100YD * (rangeYd / 100));
}
