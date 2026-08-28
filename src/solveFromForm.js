// Shared glue between raw form-field strings (App/Calculator state, or a
// saved dataset pulled from storage) and the solver. No React; used by both
// Calculator.jsx and Compare.jsx so the parsing/wind-activation logic can't
// drift between the two.
import { solveTrajectory } from "./ballistics/solver.js";

export const num = (s) => {
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : NaN;
};

/** Wind only applies once both speed and direction are present and speed is positive. */
export function isWindActive(v) {
  const windSpeedNum = num(v.windSpeedMph);
  const windClockNum = num(v.windClock);
  return Number.isFinite(windSpeedNum) && windSpeedNum > 0 && Number.isFinite(windClockNum);
}

/**
 * The ballistic inputs shared by every solve (ammo + sight height + air),
 * minus zeroRangeYd — callers that need to vary the zero themselves (the
 * vitals-window optimizer) supply that separately per trial.
 */
export function baseBallisticParams(v) {
  const windActive = isWindActive(v);
  return {
    muzzleVelocity: num(v.muzzleVelocity),
    ballisticCoefficient: num(v.ballisticCoefficient),
    dragModel: v.dragModel,
    sightHeight: num(v.sightHeight),
    tempF: num(v.tempF),
    pressInHg: num(v.pressInHg),
    windSpeedMph: windActive ? num(v.windSpeedMph) : undefined,
    windClock: windActive ? num(v.windClock) : undefined,
  };
}

export function solveFromForm(v) {
  return solveTrajectory({
    ...baseBallisticParams(v),
    grains: num(v.grains),
    zeroRangeYd: num(v.zeroRangeYd),
    maxRangeYd: Math.max(num(v.maxRangeYd), num(v.zeroRangeYd)),
    tableStepYd: num(v.tableStepYd),
  });
}
