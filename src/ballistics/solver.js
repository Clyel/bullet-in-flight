import { DRAG_TABLES } from "./dragTables.js";
import { airState, GRAVITY } from "./atmosphere.js";

/**
 * Converts a ballistic coefficient in lb/in^2 into a retardation constant.
 * 0.5 * (pi / 576) * 32.174 — the 576 folds in in^2 -> ft^2 and the pi/4 of a
 * circular reference area; the 32.174 converts pounds mass to slugs.
 */
const BC_CONSTANT = 0.5 * (Math.PI / 576) * GRAVITY;

const DEFAULT_STEP = 0.00025; // seconds
const MAX_STEPS = 400000;
const MPH_TO_FPS = 5280 / 3600;

/**
 * Resolves a wind speed (mph) and clock direction into downrange/cross
 * velocity components, in ft/s. Clock convention: 12 blows straight into
 * the shooter's face (headwind), 3 hits the right cheek, 6 is at the
 * shooter's back (tailwind), 9 hits the left cheek. The formulas fall out
 * of: wind's velocity vector points opposite its clock position, with
 * downrange = +x and the shooter's right = +z.
 */
function windVector(windSpeedMph, windClock) {
  const speedFps = (windSpeedMph || 0) * MPH_TO_FPS;
  const clockRad = ((windClock ?? 12) * 30 * Math.PI) / 180;
  return {
    rangeFps: -speedFps * Math.cos(clockRad),
    crossFps: -speedFps * Math.sin(clockRad),
  };
}

/** Linear interpolation into a Cd-vs-Mach table. */
export function dragCoefficient(table, mach) {
  const last = table.length - 1;
  if (mach <= table[0][0]) return table[0][1];
  if (mach >= table[last][0]) return table[last][1];
  let lo = 0;
  let hi = last;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (table[mid][0] <= mach) lo = mid;
    else hi = mid;
  }
  const [m0, c0] = table[lo];
  const [m1, c1] = table[hi];
  return c0 + ((c1 - c0) * (mach - m0)) / (m1 - m0);
}

/**
 * Integrates one trajectory at a fixed launch angle.
 *
 * Coordinates: the line of sight is the x-axis. The bullet starts one sight
 * height BELOW it, which is why near-muzzle heights are negative. z is
 * windage, positive toward the shooter's right.
 *
 * Wind is constant over the whole trajectory. Drag acts on velocity relative
 * to the moving air, not ground velocity: at every step the relative-velocity
 * vector is what's Mach-looked-up and decelerated, then that deceleration is
 * applied to the bullet's ground velocity. With no wind, relative velocity
 * equals ground velocity and this is identical to the pre-wind physics.
 *
 * @param visit  optional per-step hook `(xYd, yIn, zIn, v, t, mach) => boolean`.
 *               When given, the returned `path` array is left empty and the
 *               hook is called instead for each sample point; returning true
 *               stops the integration early. This is the allocation-free path
 *               used by heightAtRange() below — the physics loop is otherwise
 *               byte-identical, so integrate() with no `visit` behaves exactly
 *               as before.
 * @returns {Array<{x:number,y:number,z:number,v:number,t:number,mach:number}>}
 *          x in yards, y and z in inches relative to line of sight, v in fps
 *          (ground speed), mach relative to the air. Empty when `visit` is used.
 */
export function integrate({
  muzzleVelocity,
  ballisticCoefficient,
  dragModel,
  sightHeight,
  launchAngleRad,
  maxRangeYd,
  tempF,
  pressInHg,
  windSpeedMph,
  windClock,
  timeStep = DEFAULT_STEP,
  visit,
}) {
  const table = DRAG_TABLES[dragModel];
  if (!table) throw new Error(`Unknown drag model: ${dragModel}`);

  const { density, speedOfSound } = airState(tempF, pressInHg);
  const { rangeFps: windRangeFps, crossFps: windCrossFps } = windVector(windSpeedMph, windClock);

  let vx = muzzleVelocity * Math.cos(launchAngleRad);
  let vy = muzzleVelocity * Math.sin(launchAngleRad);
  let vz = 0;
  let x = 0;
  let y = -sightHeight / 12; // feet, below line of sight
  let z = 0;
  let t = 0;

  const path = [];
  const maxFt = maxRangeYd * 3;

  for (let i = 0; i < MAX_STEPS && x <= maxFt; i++) {
    const relVx = vx - windRangeFps;
    const relVz = vz - windCrossFps;
    const vRel = Math.hypot(relVx, vy, relVz);
    const v = Math.hypot(vx, vy, vz);
    if (visit) {
      if (visit(x / 3, y * 12, z * 12, v, t, vRel / speedOfSound)) break;
    } else {
      path.push({ x: x / 3, y: y * 12, z: z * 12, v, t, mach: vRel / speedOfSound });
    }
    if (v < 1) break;

    const decel =
      (BC_CONSTANT * density * vRel * vRel * dragCoefficient(table, vRel / speedOfSound)) /
      ballisticCoefficient;

    vx += ((-decel * relVx) / vRel) * timeStep;
    vy += ((-decel * vy) / vRel - GRAVITY) * timeStep;
    vz += ((-decel * relVz) / vRel) * timeStep;
    x += vx * timeStep;
    y += vy * timeStep;
    z += vz * timeStep;
    t += timeStep;
  }
  return path;
}

/**
 * Height above the line of sight (inches) at one range, without building or
 * keeping the whole path. Equivalent to `sampleAt(integrate(params), rangeYd).y`
 * — same integrator, same linear interpolation between the bracketing steps,
 * same "return the last sample if the trajectory never reaches rangeYd"
 * behaviour — but it stops the instant x passes the target and allocates
 * nothing per step. solveZeroAngle calls this several times per zero solve,
 * and optimalSightIn calls solveZeroAngle 100+ times per optimize, so the
 * per-step object churn it removes is the whole point.
 */
export function heightAtRange(params, rangeYd) {
  let prevX = null;
  let prevY = null;
  let lastY = NaN;
  let hit = false;
  let result = NaN;
  integrate({
    ...params,
    visit: (xYd, yIn) => {
      lastY = yIn;
      if (xYd >= rangeYd) {
        result = prevX == null
          ? yIn
          : prevY + (yIn - prevY) * ((rangeYd - prevX) / (xYd - prevX));
        hit = true;
        return true;
      }
      prevX = xYd;
      prevY = yIn;
      return false;
    },
  });
  return hit ? result : lastY;
}

/**
 * Finds the launch angle that puts the bullet on the line of sight at the
 * zero range. Secant iteration — converges in a handful of passes because
 * height is very nearly linear in launch angle over this span.
 *
 * @returns {number} launch angle in radians
 * @throws if the bullet cannot reach the zero range at all
 */
export function solveZeroAngle(params) {
  const { zeroRangeYd } = params;
  const trial = (angle) =>
    heightAtRange({ ...params, launchAngleRad: angle, maxRangeYd: zeroRangeYd * 1.02 }, zeroRangeYd);

  let a0 = 0;
  let f0 = trial(a0);
  if (!Number.isFinite(f0)) {
    throw new Error("Bullet does not reach the zero range with these inputs.");
  }
  let a1 = 0.002; // ~0.11 degrees
  let f1 = trial(a1);

  for (let i = 0; i < 40; i++) {
    if (!Number.isFinite(f1)) {
      // A later secant jump landed on inputs the integrator can't fly
      // (a NaN trajectory) — the target is effectively unreachable.
      // Better a clear throw than returning whatever `a1` last held.
      throw new Error("Bullet does not reach the zero range with these inputs.");
    }
    if (Math.abs(f1) < 1e-4) break;
    const denom = f1 - f0;
    if (!Number.isFinite(denom) || denom === 0) break;
    const a2 = a1 - (f1 * (a1 - a0)) / denom;
    a0 = a1;
    f0 = f1;
    a1 = a2;
    f1 = trial(a1);
  }
  return a1;
}

/**
 * Interpolates the path at an exact range. `path` is sorted ascending by x
 * (downrange distance only ever increases), so this binary-searches for the
 * bracketing pair rather than scanning from the start — the chart
 * resamplers call it hundreds of times per render against a ~3000-point
 * path, which made a linear scan O(samples * n).
 */
export function sampleAt(path, rangeYd) {
  if (!path.length) return null;
  if (rangeYd <= path[0].x) return path[0];
  const last = path.length - 1;
  if (rangeYd >= path[last].x) return path[last];

  // First index whose x is >= rangeYd. Guaranteed to exist in [1, last]
  // given the two boundary checks above.
  let lo = 1;
  let hi = last;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (path[mid].x < rangeYd) lo = mid + 1;
    else hi = mid;
  }
  const a = path[lo - 1];
  const b = path[lo];
  const span = b.x - a.x;
  const f = span > 0 ? (rangeYd - a.x) / span : 0; // span 0 only if two samples coincide
  return {
    x: rangeYd,
    y: a.y + (b.y - a.y) * f,
    z: a.z + (b.z - a.z) * f,
    v: a.v + (b.v - a.v) * f,
    t: a.t + (b.t - a.t) * f,
    mach: a.mach + (b.mach - a.mach) * f,
  };
}

/** First range at which the bullet falls to or below a given Mach number. */
export function machCrossing(path, mach) {
  for (let i = 1; i < path.length; i++) {
    if (path[i].mach <= mach) {
      const a = path[i - 1];
      const b = path[i];
      const span = a.mach - b.mach;
      const f = span > 0 ? (a.mach - mach) / span : 0; // span 0 only if two samples share a Mach
      return a.x + (b.x - a.x) * f;
    }
  }
  return null;
}

/** Ranges where the trajectory crosses the line of sight. */
export function sightLineCrossings(path) {
  const hits = [];
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1];
    const b = path[i];
    if ((a.y < 0 && b.y >= 0) || (a.y > 0 && b.y <= 0)) {
      const span = b.y - a.y;
      const f = span !== 0 ? -a.y / span : 0; // span 0 is unreachable given the straddle test above
      hits.push(a.x + (b.x - a.x) * f);
    }
  }
  return hits;
}

export const energyFtLb = (grains, fps) => (grains * fps * fps) / 450437;

/**
 * Full solution: zeroes the rifle, flies the trajectory, and builds the table rows.
 */
export function solveTrajectory(input) {
  const {
    muzzleVelocity, ballisticCoefficient, dragModel, grains,
    sightHeight, zeroRangeYd, maxRangeYd, tableStepYd,
    tempF, pressInHg, windSpeedMph, windClock,
  } = input;

  const base = {
    muzzleVelocity, ballisticCoefficient, dragModel,
    sightHeight, zeroRangeYd, tempF, pressInHg,
    windSpeedMph, windClock,
  };

  const launchAngleRad = solveZeroAngle(base);
  const path = integrate({ ...base, launchAngleRad, maxRangeYd });

  const rows = [];
  const step = Math.max(1, tableStepYd);
  const rowAt = (rangeYd) => {
    const p = sampleAt(path, rangeYd);
    return {
      range: rangeYd,
      velocity: p.v,
      energy: energyFtLb(grains, p.v),
      height: p.y,
      windage: p.z,
      time: p.t,
      mach: p.mach,
    };
  };
  for (let d = 0; d < maxRangeYd - 1e-6; d += step) rows.push(rowAt(d));
  // Always land the final row exactly on the requested max range, even when
  // it isn't a whole number of steps out — which it never is in metric (the
  // "table every" presets convert to 27.34 / 54.68 / 109.36 canonical yd)
  // and often isn't in imperial either. Without this the table stops at the
  // last whole step, and `last` — which SummaryStrip labels "At {maxRangeYd}"
  // — is that short row, so the strip reports the wrong distance's numbers.
  rows.push(rowAt(maxRangeYd));

  const apex = path.reduce((best, p) => (p.y > best.y ? p : best), path[0]);

  return {
    path,
    rows,
    launchAngleDeg: (launchAngleRad * 180) / Math.PI,
    crossings: sightLineCrossings(path),
    transonicYd: machCrossing(path, 1.2),
    subsonicYd: machCrossing(path, 1.0),
    apex: { range: apex.x, height: apex.y },
    last: rows[rows.length - 1],
  };
}
