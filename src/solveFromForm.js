// Shared glue between raw form-field strings (App/Calculator state, or a
// saved dataset pulled from storage) and the solver. No React; used by both
// Calculator.jsx and Compare.jsx so the parsing/wind-activation logic can't
// drift between the two.
import { solveTrajectory } from "./ballistics/solver.js";
import { spinDriftIn } from "./ballistics/spinDrift.js";
import { coriolisWindageIn } from "./ballistics/coriolis.js";

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

/** `twistIn` is stored as a plain positive magnitude (the InputPanel field
 *  is "twist rate," a number nobody thinks of as negative) with handedness
 *  as its own `twistDirection` ("Right"/"Left", right being the vast
 *  majority of factory rifles) -- combined here into the signed value
 *  spinDrift.js's sign convention actually wants (positive = right-hand). */
export function signedTwistIn(v) {
  const mag = num(v.twistIn);
  if (!(mag > 0)) return NaN;
  return v.twistDirection === "Left" ? -mag : mag;
}

/** Spin drift only applies once twist, bullet length, and diameter are all
 *  present -- see spinDrift.js's own header for why these can't be
 *  catalog-filled and stay manual-entry-only. */
export function isSpinDriftActive(v) {
  return num(v.twistIn) > 0 && num(v.bulletLengthIn) > 0 && num(v.bulletDiameterIn) > 0;
}

/** Coriolis (flat-fire, latitude-only) only applies once a latitude is entered. */
export function isCoriolisActive(v) {
  return Number.isFinite(num(v.latitudeDeg));
}

/** Anything that can put a nonzero number in the windage column -- wind,
 *  spin drift, or Coriolis -- not just wind. Drives whether the windage
 *  column/MOA/MIL-windage show at all (see Calculator.jsx/DopeChart.jsx). */
export function isWindageActive(v) {
  return isWindActive(v) || isSpinDriftActive(v) || isCoriolisActive(v);
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

/**
 * Solves the trajectory, then folds spin drift and Coriolis into windage on
 * top of it -- both are closed-form, read-off-style corrections computed
 * from the already-solved rows (time, range), not forces integrated into
 * the RK4 loop itself (see spinDrift.js/coriolis.js's own headers for why),
 * so solveTrajectory()/solver.js stay completely untouched by this. Rows
 * missing their inputs (blank twist/length/diameter/latitude) are
 * unaffected -- spinDriftIn/coriolisWindageIn both return 0 in that case,
 * same "blank means off" contract wind already has.
 */
export function solveFromForm(v) {
  const solution = solveTrajectory({
    ...baseBallisticParams(v),
    grains: num(v.grains),
    zeroRangeYd: num(v.zeroRangeYd),
    maxRangeYd: Math.max(num(v.maxRangeYd), num(v.zeroRangeYd)),
    tableStepYd: num(v.tableStepYd),
  });
  if (!isSpinDriftActive(v) && !isCoriolisActive(v)) return solution;

  const spinParams = {
    twistIn: signedTwistIn(v), diameterIn: num(v.bulletDiameterIn), lengthIn: num(v.bulletLengthIn),
    grains: num(v.grains), muzzleVelocityFps: num(v.muzzleVelocity),
    tempF: num(v.tempF), pressInHg: num(v.pressInHg),
  };
  const latitudeDeg = num(v.latitudeDeg);
  const addExtraWindage = (row) => ({
    ...row,
    windage: row.windage + spinDriftIn(row.time, spinParams) + coriolisWindageIn(row.time, row.range, latitudeDeg),
  });
  return { ...solution, rows: solution.rows.map(addExtraWindage) };
}
