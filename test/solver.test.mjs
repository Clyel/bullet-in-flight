import { readFileSync } from "node:fs";
import { solveTrajectory, solveZeroAngle, integrate } from "../src/ballistics/solver.js";
import { vitalsWindow, optimalSightIn } from "../src/ballistics/vitalsWindow.js";

const ref = JSON.parse(readFileSync(new URL("./fixtures/reference.json", import.meta.url)));

// Tolerances vs. an independent reference solver (py-ballisticcalc, RK4).
const TOL = { velocity: 1.0, energy: 3.0, height: 0.5, windage: 0.5, time: 0.002 };

let failures = 0;
for (const [name, fx] of Object.entries(ref)) {
  const p = fx.params;
  const sol = solveTrajectory({
    muzzleVelocity: p.mv,
    ballisticCoefficient: p.bc,
    dragModel: p.model,
    grains: p.grains,
    sightHeight: p.sightHeight,
    zeroRangeYd: p.zeroYd,
    maxRangeYd: 1000,
    tableStepYd: 100,
    tempF: 59,
    pressInHg: 29.92,
    windSpeedMph: p.windMph,
    windClock: p.windClock,
  });

  const angleErr = Math.abs(sol.launchAngleDeg - fx.zeroAngleDeg);
  const worst = { velocity: 0, energy: 0, height: 0, windage: 0, time: 0 };

  for (const r of fx.rows) {
    const mine = sol.rows.find((x) => Math.abs(x.range - r.d) < 0.51);
    if (!mine) continue;
    worst.velocity = Math.max(worst.velocity, Math.abs(mine.velocity - r.v));
    worst.energy   = Math.max(worst.energy,   Math.abs(mine.energy - r.e));
    worst.height   = Math.max(worst.height,   Math.abs(mine.height - r.h));
    worst.time     = Math.max(worst.time,     Math.abs(mine.time - r.t));
    if (r.w !== undefined) {
      worst.windage = Math.max(worst.windage, Math.abs(mine.windage - r.w));
    }
  }

  const bad = Object.entries(TOL).filter(([k, t]) => worst[k] > t);
  if (bad.length || angleErr > 0.002) failures++;
  console.log(
    `${bad.length || angleErr > 0.002 ? "FAIL" : "pass"}  ${name.padEnd(20)} ` +
    `angle ${angleErr.toFixed(5)}deg  dV ${worst.velocity.toFixed(2)}fps  ` +
    `dE ${worst.energy.toFixed(1)}ftlb  dH ${worst.height.toFixed(3)}in  ` +
    `dW ${worst.windage.toFixed(3)}in  dT ${worst.time.toFixed(5)}s`
  );
}

// Sanity: the trajectory must actually cross the sight line at the zero.
const s = solveTrajectory({
  muzzleVelocity: 2600, ballisticCoefficient: 0.243, dragModel: "G7", grains: 175,
  sightHeight: 1.5, zeroRangeYd: 200, maxRangeYd: 400, tableStepYd: 50,
  tempF: 59, pressInHg: 29.92,
});
const nearZero = s.crossings[0], farZero = s.crossings[1];
const zeroOk = Math.abs(farZero - 200) < 0.6 && nearZero > 0 && nearZero < 60;
if (!zeroOk) failures++;
console.log(`${zeroOk ? "pass" : "FAIL"}  zero crossings   near ${nearZero?.toFixed(1)}yd  far ${farZero?.toFixed(1)}yd  apex ${s.apex.height.toFixed(2)}in @ ${s.apex.range.toFixed(0)}yd`);

// Vitals window / optimal sight-in: not new trajectory physics (built on
// solveZeroAngle/integrate unchanged), so no independent fixture — but the
// optimizer is new logic with its own way to be subtly wrong, so check it
// against itself: the apex at the found zero should sit right at the target
// radius, and nearby zeros should give a *smaller* window (a real max, not
// a stray root).
{
  const base = {
    muzzleVelocity: 2825, ballisticCoefficient: 0.265, dragModel: "G7",
    sightHeight: 1.5, tempF: 59, pressInHg: 29.92,
    windSpeedMph: undefined, windClock: undefined,
  };

  for (const radiusIn of [1.5, 3, 6]) {
    const opt = optimalSightIn(base, radiusIn);

    const angle = solveZeroAngle({ ...base, zeroRangeYd: opt.zeroRangeYd });
    const path = integrate({ ...base, zeroRangeYd: opt.zeroRangeYd, launchAngleRad: angle, maxRangeYd: 2000 });
    const apex = path.reduce((best, p) => (p.y > best ? p.y : best), path[0].y);
    const apexOk = Math.abs(apex - radiusIn) < 0.01;

    let widerNearby = false;
    for (const dz of [-10, -5, 5, 10]) {
      const z = opt.zeroRangeYd + dz;
      if (z <= 0) continue;
      const a = solveZeroAngle({ ...base, zeroRangeYd: z });
      const p = integrate({ ...base, zeroRangeYd: z, launchAngleRad: a, maxRangeYd: 2000 });
      const w = vitalsWindow(p, radiusIn);
      if (w && w.spanYd > opt.spanYd + 0.05) widerNearby = true;
    }

    const ok = apexOk && !widerNearby;
    if (!ok) failures++;
    console.log(
      `${ok ? "pass" : "FAIL"}  vitals optimum ${radiusIn}in   zero ${opt.zeroRangeYd.toFixed(1)}yd  ` +
      `apex ${apex.toFixed(3)}in  window ${opt.spanYd.toFixed(1)}yd (${opt.entryYd.toFixed(0)}-${opt.exitYd.toFixed(0)})` +
      (widerNearby ? "  [a nearby zero found a WIDER window]" : "")
    );
  }
}

console.log(failures ? `\n${failures} FAILING` : "\nAll checks passed.");
process.exit(failures ? 1 : 0);
