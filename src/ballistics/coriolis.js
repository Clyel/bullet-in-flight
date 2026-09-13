// Coriolis effect: horizontal deflection from the Earth's own rotation.
// Real, independent physics (needs its own fixtures, not just a
// self-consistency check) -- same source as spin drift and the original
// wind fixtures, py-ballisticcalc (see test/fixtures/generate.py's
// CORIOLIS_CASES), verified line for line against its own conditions.py
// (Coriolis.flat_fire_offsets) and by hand.
//
// Deliberately the "flat-fire" latitude-only approximation, not the full
// 3D (latitude + azimuth) solution -- that was a scoped-out decision, not
// an oversight. py-ballisticcalc's own full-3D mode requires the Coriolis
// acceleration integrated into the trajectory's actual RK4 step (a real
// change to the equations of motion, i.e. solver.js's integrate()), plus
// an azimuth/compass-heading input most users won't want to supply. The
// flat-fire approximation this app implements instead is a closed-form,
// read-off-style correction -- solver.js's integrator is completely
// untouched -- and the difference from full 3D is negligible at this
// app's typical ranges (500-1000yd; the two diverge meaningfully only at
// genuine long-range/sniper distances this app doesn't target).
//
// Manual-entry-only (latitude), optional -- blank means the effect is off,
// same "leave it blank to skip" pattern as wind and spin drift.

const EARTH_ANGULAR_VELOCITY_RAD_S = 7.292115e-5;

/**
 * Coriolis windage at a given time of flight and downrange distance, in
 * inches -- positive is the shooter's right (this app's windage
 * convention). Northern-hemisphere latitudes (positive) deflect right;
 * southern (negative) deflect left; the equator (0) has none. Returns 0
 * when latitude isn't a real number (the "blank field" case).
 */
export function coriolisWindageIn(timeSec, distanceYd, latitudeDeg) {
  if (!Number.isFinite(latitudeDeg)) return 0;
  const distanceFt = distanceYd * 3;
  const latRad = (latitudeDeg * Math.PI) / 180;
  const horizontalFt = EARTH_ANGULAR_VELOCITY_RAD_S * distanceFt * Math.sin(latRad) * timeSec;
  return horizontalFt * 12; // this app's windage is in inches, not feet
}
