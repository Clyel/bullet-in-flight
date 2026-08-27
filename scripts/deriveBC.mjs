// Back-calculates a G1 BC from a manufacturer's own published velocity-vs-range
// table, by bisecting on the solver's actual drag physics until the simulated
// velocity at the farthest published range matches. Reuses the app's real
// dragCoefficient/DRAG_TABLES/airState so the fit is bit-consistent with what
// the app will later compute for these loads — not a separate approximation.
import { dragCoefficient } from "../src/ballistics/solver.js";
import { DRAG_TABLES } from "../src/ballistics/dragTables.js";
import { airState, GRAVITY } from "../src/ballistics/atmosphere.js";

const BC_CONSTANT = 0.5 * (Math.PI / 576) * GRAVITY;
const STEP = 0.00025;

/** Pure downrange velocity decay (no gravity/sight geometry — irrelevant to BC fitting). */
function velocityAtRangeYd(mv, bc, dragModel, tempF, pressInHg, targetYd) {
  const table = DRAG_TABLES[dragModel];
  const { density, speedOfSound } = airState(tempF, pressInHg);
  const targetFt = targetYd * 3;
  let v = mv;
  let x = 0;
  let prevV = v;
  let prevX = x;
  for (let i = 0; i < 400000 && x < targetFt; i++) {
    const mach = v / speedOfSound;
    const decel = (BC_CONSTANT * density * v * v * dragCoefficient(table, mach)) / bc;
    prevV = v;
    prevX = x;
    v += -decel * STEP;
    x += v * STEP;
    if (v < 1) return v;
  }
  if (x === prevX) return v;
  const f = (targetFt - prevX) / (x - prevX);
  return prevV + (v - prevV) * f;
}

/**
 * Finds the G1 BC such that simulated velocity at `targetYd` matches
 * `targetVelocity`, via bisection (velocity retained is monotonic in BC).
 */
export function deriveBC(mv, dragModel, tempF, pressInHg, targetYd, targetVelocity) {
  let lo = 0.05;
  let hi = 1.2;
  const f = (bc) => velocityAtRangeYd(mv, bc, dragModel, tempF, pressInHg, targetYd) - targetVelocity;
  let flo = f(lo);
  let fhi = f(hi);
  if (flo > 0 || fhi < 0) throw new Error(`BC out of bracket range [${lo},${hi}]: flo=${flo} fhi=${fhi}`);
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    const fmid = f(mid);
    if (Math.abs(fmid) < 0.05) return mid;
    if (fmid < 0) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

/** Root-mean-square velocity error across all published points, for QA. */
export function fitResidualRMS(mv, bc, dragModel, tempF, pressInHg, points) {
  const errs = points.map(([yd, v]) => velocityAtRangeYd(mv, bc, dragModel, tempF, pressInHg, yd) - v);
  return Math.sqrt(errs.reduce((s, e) => s + e * e, 0) / errs.length);
}
