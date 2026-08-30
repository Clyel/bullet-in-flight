// The "vitals window": the single continuous range interval over which a
// trajectory stays inside +/-radiusIn of the line of sight, without poking
// above the top boundary or falling through the bottom one. Not new
// trajectory physics — it's a pure read-off of an already-integrated path,
// plus (for the optimizer below) an outer search over zeroRangeYd using the
// existing, already-validated solveZeroAngle/integrate unchanged.
import { solveZeroAngle, integrate, sightLineCrossings, sampleAt } from "./solver.js";

/**
 * Scans a path for the vitals window. The bullet starts below the line of
 * sight (by sightHeight), so "entry" is wherever it first climbs up into
 * the band; "exit" is the first point after that where it violates EITHER
 * boundary — poking above +radiusIn or dropping below -radiusIn, whichever
 * comes first. A zero that's too long pokes through the top near the apex,
 * which correctly truncates the window right there rather than reporting
 * the (irrelevant) far-side crossing beyond it.
 *
 * @returns {{entryYd:number, exitYd:number, spanYd:number, exitReason:"high"|"low"|null}|null}
 *          null if the path never enters the band at all.
 */
export function vitalsWindow(path, radiusIn) {
  if (!path.length) return null;

  let entryYd = null;
  if (path[0].y >= -radiusIn) {
    entryYd = path[0].x;
  } else {
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1];
      const b = path[i];
      if (b.y >= -radiusIn) {
        const f = (-radiusIn - a.y) / (b.y - a.y);
        entryYd = a.x + (b.x - a.x) * f;
        break;
      }
    }
  }
  if (entryYd == null) return null; // never climbs into the band

  let exitYd = null;
  let exitReason = null;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1];
    const b = path[i];
    if (b.x < entryYd) continue;
    if (b.y > radiusIn) {
      const f = (radiusIn - a.y) / (b.y - a.y);
      exitYd = a.x + (b.x - a.x) * f;
      exitReason = "high";
      break;
    }
    if (b.y < -radiusIn) {
      const f = (-radiusIn - a.y) / (b.y - a.y);
      exitYd = a.x + (b.x - a.x) * f;
      exitReason = "low";
      break;
    }
  }
  if (exitYd == null) {
    exitYd = path[path.length - 1].x; // still inside at the end of the integrated range
  }

  return { entryYd, exitYd, spanYd: exitYd - entryYd, exitReason };
}

/**
 * Finds the zero range that maximizes the vitals window.
 *
 * Apex height vs. zero range is NOT monotonic across the whole practical
 * range, which the naive version of this (bisect for apex === radiusIn from
 * a fixed small starting zero) gets wrong: at very short zero ranges the
 * bullet has to cross sightHeight inches of rise in just a few yards, which
 * needs a steep enough angle that the apex shoots up well past any
 * reasonable radius — so apex height actually *falls* as zero range grows
 * from tiny toward "normal," bottoms out, and only then starts the familiar
 * rise with zero range that every practitioner's intuition is built on.
 * That means apex(zero) === radiusIn can have two roots: an early one on the
 * way down (not what anyone means by a "zero," physically meaningless) and
 * the real one on the way back up. So this first finds the valley bottom
 * (ternary search — the shape is empirically unimodal in this regime), then
 * bisects only the increasing branch beyond it for the real root, using the
 * same classic-MPBR condition as before (apex tangent to +radiusIn is where
 * the window is widest — see vitalsWindow's docs for why).
 *
 * @param base - same shape as solveZeroAngle's params, minus zeroRangeYd
 *               (see baseBallisticParams in solveFromForm.js).
 * @throws if even the flattest achievable apex exceeds radiusIn, or if the
 *         increasing branch doesn't reach radiusIn within 2000 yd.
 */
const SEARCH_LO_YD = 5;
const SEARCH_HI_YD = 2000;

export function optimalSightIn(base, radiusIn) {
  const apexHeightAt = (zeroRangeYd) => {
    const launchAngleRad = solveZeroAngle({ ...base, zeroRangeYd });
    // Only needs to comfortably clear the apex, not the whole flight.
    const path = integrate({ ...base, zeroRangeYd, launchAngleRad, maxRangeYd: zeroRangeYd * 1.5 + 50 });
    return path.reduce((best, p) => (p.y > best ? p.y : best), path[0].y);
  };

  // Phase 1: ternary search for the valley bottom.
  let lo = SEARCH_LO_YD;
  let hi = SEARCH_HI_YD;
  for (let i = 0; i < 30; i++) {
    const m1 = lo + (hi - lo) / 3;
    const m2 = hi - (hi - lo) / 3;
    if (apexHeightAt(m1) < apexHeightAt(m2)) hi = m2;
    else lo = m1;
  }
  const valleyZeroYd = (lo + hi) / 2;
  const valleyApexIn = apexHeightAt(valleyZeroYd);
  if (valleyApexIn > radiusIn) {
    throw new Error(
      `No zero keeps the apex under ${radiusIn}in for this load — the flattest ` +
      `achievable apex is ${valleyApexIn.toFixed(2)}in (at a ${valleyZeroYd.toFixed(0)}yd zero). ` +
      "Try a larger vitals radius."
    );
  }

  // Phase 2: bisect the increasing branch beyond the valley for apex === radiusIn.
  lo = valleyZeroYd;
  hi = SEARCH_HI_YD;
  if (apexHeightAt(hi) - radiusIn < 0) {
    throw new Error(`No zero out to ${SEARCH_HI_YD}yd reaches the vitals radius — try a smaller radius.`);
  }
  // Same "always keep `lo` on the apex-at-or-under-radius side, use `lo` as
  // the final answer" trick as before — see vitalsWindow's docs for why
  // using the last-tested midpoint instead risks a spurious top-violation
  // right at the apex from floating-point overshoot.
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    const f = apexHeightAt(mid) - radiusIn;
    if (f <= 0) lo = mid;
    else hi = mid;
  }
  const zeroRangeYd = lo;

  const launchAngleRad = solveZeroAngle({ ...base, zeroRangeYd });
  const path = integrate({ ...base, zeroRangeYd, launchAngleRad, maxRangeYd: SEARCH_HI_YD });
  const window = vitalsWindow(path, radiusIn);
  if (!window) {
    throw new Error("Could not resolve a vitals window at the optimal zero.");
  }

  // Practical sight-in aids, read off the same path — no extra integration.
  // The near zero is where a sight-in procedure starts (close, easy to get
  // "on paper"), before dialing in at the far/optimal zero itself. Height
  // at 100yd is the other classic reference distance shooters check by.
  const nearZeroYd = sightLineCrossings(path)[0] ?? null;
  const heightAt100Yd = sampleAt(path, 100)?.y ?? null;

  return { zeroRangeYd, nearZeroYd, heightAt100Yd, ...window };
}
