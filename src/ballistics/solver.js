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
 * @returns {Array<{x:number,y:number,z:number,v:number,t:number,mach:number}>}
 *          x in yards, y and z in inches relative to line of sight, v in fps
 *          (ground speed), mach relative to the air.
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
    path.push({ x: x / 3, y: y * 12, z: z * 12, v, t, mach: vRel / speedOfSound });
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

/** Height above line of sight, in inches, at a given range. */
function heightAt(path, rangeYd) {
  const p = sampleAt(path, rangeYd);
  return p ? p.y : NaN;
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
    heightAt(
      integrate({ ...params, launchAngleRad: angle, maxRangeYd: zeroRangeYd * 1.02 }),
      zeroRangeYd
    );

  let a0 = 0;
  let f0 = trial(a0);
  if (!Number.isFinite(f0)) {
    throw new Error("Bullet does not reach the zero range with these inputs.");
  }
  let a1 = 0.002; // ~0.11 degrees
  let f1 = trial(a1);

  for (let i = 0; i < 40; i++) {
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

/** Interpolates the path at an exact range. */
export function sampleAt(path, rangeYd) {
  if (!path.length) return null;
  if (rangeYd <= path[0].x) return path[0];
  for (let i = 1; i < path.length; i++) {
    if (path[i].x >= rangeYd) {
      const a = path[i - 1];
      const b = path[i];
      const f = (rangeYd - a.x) / (b.x - a.x);
      return {
        x: rangeYd,
        y: a.y + (b.y - a.y) * f,
        z: a.z + (b.z - a.z) * f,
        v: a.v + (b.v - a.v) * f,
        t: a.t + (b.t - a.t) * f,
        mach: a.mach + (b.mach - a.mach) * f,
      };
    }
  }
  return path[path.length - 1];
}

/** First range at which the bullet falls to or below a given Mach number. */
export function machCrossing(path, mach) {
  for (let i = 1; i < path.length; i++) {
    if (path[i].mach <= mach) {
      const a = path[i - 1];
      const b = path[i];
      const f = (a.mach - mach) / (a.mach - b.mach);
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
      hits.push(a.x + ((b.x - a.x) * -a.y) / (b.y - a.y));
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
  for (let d = 0; d <= maxRangeYd + 1e-6; d += step) {
    const p = sampleAt(path, Math.min(d, maxRangeYd));
    rows.push({
      range: Math.min(d, maxRangeYd),
      velocity: p.v,
      energy: energyFtLb(grains, p.v),
      height: p.y,
      windage: p.z,
      time: p.t,
      mach: p.mach,
    });
  }

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
