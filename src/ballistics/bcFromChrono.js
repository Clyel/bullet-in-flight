// Derives a ballistic coefficient from a shooter's own chronograph data --
// not new force physics, just a root-find wrapped around the already-
// validated forward integrator (integrate()/sampleAt(), unchanged). Same
// category as vitalsWindow.js's optimalSightIn(): the trajectory math
// underneath already has independent fixtures, so what needs validating is
// the root-finder's own correctness -- checked by round-trip self-
// consistency in solver.test.mjs (forward-solve a known BC, invert-solve
// the result, recover the same BC) rather than a new fixture set.
//
// Runs the trajectory flat (launchAngleRad 0, sightHeight 0) -- this is
// about how fast a bullet decelerates over a known distance, not about
// aiming, so zeroing/sight height/windage don't apply here and
// solveZeroAngle/solveTrajectory() are deliberately not used.
import { integrate, sampleAt } from "./solver.js";

const BC_MIN = 0.01;
const BC_MAX = 2.0;
const MAX_ITERATIONS = 60;

function atDistance(bc, { muzzleVelocity, dragModel, distanceYd, tempF, pressInHg }) {
  const path = integrate({
    muzzleVelocity, ballisticCoefficient: bc, dragModel,
    sightHeight: 0, launchAngleRad: 0, maxRangeYd: distanceYd * 1.02,
    tempF, pressInHg,
  });
  return sampleAt(path, distanceYd);
}

/**
 * Bisects for the BC whose `read(bc)` matches `target`, then verifies the
 * final answer actually zeros the residual before returning it -- a
 * technically-converged-but-still-off answer is reported as unsolved (null)
 * rather than shown with false confidence. Direction-agnostic: works
 * whether `read` increases with BC (velocity) or decreases (time).
 */
function bisectBc(read, target, tol) {
  const residual = (bc) => {
    const v = read(bc);
    return Number.isFinite(v) ? v - target : NaN;
  };

  let lo = BC_MIN;
  let hi = BC_MAX;
  let fLo = residual(lo);
  const fHi = residual(hi);
  if (!Number.isFinite(fLo) || !Number.isFinite(fHi) || fLo * fHi > 0) return null;

  let mid = (lo + hi) / 2;
  let fMid = residual(mid);
  for (let i = 0; i < MAX_ITERATIONS && Number.isFinite(fMid) && Math.abs(fMid) >= tol; i++) {
    if ((fLo < 0) === (fMid < 0)) { lo = mid; fLo = fMid; } else { hi = mid; }
    mid = (lo + hi) / 2;
    fMid = residual(mid);
  }
  if (!Number.isFinite(fMid) || Math.abs(fMid) >= tol) return null;
  return mid;
}

/**
 * Derives BC from a muzzle velocity and a velocity measured at a known
 * downrange distance (two chronographs, or one chrono plus a radar/optical
 * downrange reading).
 */
export function bcFromVelocity({ muzzleVelocity, targetVelocity, distanceYd, dragModel, tempF, pressInHg }) {
  if (!(muzzleVelocity > 0) || !(distanceYd > 0)) {
    return { ok: false, reason: "Enter a muzzle velocity and a distance greater than zero." };
  }
  if (!(targetVelocity > 0) || targetVelocity >= muzzleVelocity) {
    return { ok: false, reason: "Downrange velocity has to be a positive number less than the muzzle velocity — a bullet only slows down in flight." };
  }
  const bc = bisectBc(
    (b) => atDistance(b, { muzzleVelocity, dragModel, distanceYd, tempF, pressInHg })?.v,
    targetVelocity,
    0.01
  );
  if (bc == null) {
    return { ok: false, reason: "No ballistic coefficient between 0.01 and 2.0 reproduces that velocity drop — double-check the numbers." };
  }
  return { ok: true, ballisticCoefficient: bc };
}

/**
 * Derives BC from a muzzle velocity and the elapsed time to a known
 * downrange distance (a single chronograph plus a timer, or acoustic
 * timing off a steel target).
 */
export function bcFromTimeOfFlight({ muzzleVelocity, targetTimeSec, distanceYd, dragModel, tempF, pressInHg }) {
  if (!(muzzleVelocity > 0) || !(distanceYd > 0)) {
    return { ok: false, reason: "Enter a muzzle velocity and a distance greater than zero." };
  }
  // Drag only slows a bullet down, so no real flight is faster than a
  // hypothetical constant-muzzle-velocity one -- reject below that floor
  // before bisecting rather than let it fail to bracket silently.
  const minPossibleSec = (distanceYd * 3) / muzzleVelocity;
  if (!(targetTimeSec > minPossibleSec)) {
    return {
      ok: false,
      reason: `That time is faster than physically possible at this muzzle velocity and distance (minimum ${minPossibleSec.toFixed(3)}s) — double-check the numbers.`,
    };
  }
  const bc = bisectBc(
    (b) => atDistance(b, { muzzleVelocity, dragModel, distanceYd, tempF, pressInHg })?.t,
    targetTimeSec,
    0.00002
  );
  if (bc == null) {
    return { ok: false, reason: "No ballistic coefficient between 0.01 and 2.0 reproduces that time of flight — double-check the numbers." };
  }
  return { ok: true, ballisticCoefficient: bc };
}
