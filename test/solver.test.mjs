import { readFileSync } from "node:fs";
import { solveTrajectory, solveZeroAngle, integrate } from "../src/ballistics/solver.js";
import { vitalsWindow, optimalSightIn } from "../src/ballistics/vitalsWindow.js";
import { freeRecoilEnergy, estimateChargeWeight } from "../src/ballistics/recoil.js";

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

    // Near zero must be a real crossing strictly before the far/optimal
    // one — that's the whole point of a two-stage sight-in (close, easy
    // shot first; confirm at distance second). Height at 100yd should sit
    // between the muzzle (below the line of sight) and the apex (at the
    // target radius) for a zero this short-to-medium range.
    const nearZeroOk = opt.nearZeroYd != null && opt.nearZeroYd > 0 && opt.nearZeroYd < opt.zeroRangeYd;
    const height100Ok = opt.heightAt100Yd != null && opt.heightAt100Yd > -base.sightHeight && opt.heightAt100Yd <= radiusIn + 0.01;

    const ok = apexOk && !widerNearby && nearZeroOk && height100Ok;
    if (!ok) failures++;
    console.log(
      `${ok ? "pass" : "FAIL"}  vitals optimum ${radiusIn}in   zero ${opt.zeroRangeYd.toFixed(1)}yd  ` +
      `near ${opt.nearZeroYd?.toFixed(1)}yd  h@100 ${opt.heightAt100Yd?.toFixed(2)}in  ` +
      `apex ${apex.toFixed(3)}in  window ${opt.spanYd.toFixed(1)}yd (${opt.entryYd.toFixed(0)}-${opt.exitYd.toFixed(0)})` +
      (widerNearby ? "  [a nearby zero found a WIDER window]" : "")
    );
  }
}

// Free recoil energy: exact physics (conservation of momentum + kinetic
// energy), not an empirical curve fit, so this isn't validated against an
// independent solver the way drag physics is -- instead it's checked
// against SAAMI's own published worked example, straight from their "Gun
// Recoil - Technical" standard.
{
  // 12ga shotgun, 7lb, shot+wads 589.9gr, powder charge 33.4gr, velocity
  // 1275fps, f=1.50 (shotgun factor). SAAMI's stated answer: 30.22 ft-lb
  // ("about 30 ft-lb due to the uncertainty of the exact shot charge weight
  // and velocity" -- their own words, so a tight but non-zero tolerance).
  const fre = freeRecoilEnergy(589.9, 1275, 33.4, 7, 1.50);
  const freOk = Math.abs(fre - 30.22) < 0.1;
  if (!freOk) failures++;
  console.log(`${freOk ? "pass" : "FAIL"}  SAAMI recoil worked example   expected 30.22 ft-lb  got ${fre.toFixed(2)} ft-lb`);

  // Sanity check the charge-weight estimator against a case with real data:
  // the default 30-06/172gr load in a typical 8lb rifle should land in the
  // commonly-cited ~18-25 ft-lb range for that cartridge/rifle-weight
  // combination, not some wildly different number.
  const charge = estimateChargeWeight("30-06 Springfield");
  const rifleFre = freeRecoilEnergy(172, 2825, charge, 8);
  const rifleOk = charge > 0 && rifleFre > 18 && rifleFre < 25;
  if (!rifleOk) failures++;
  console.log(`${rifleOk ? "pass" : "FAIL"}  recoil sanity (30-06/172gr, 8lb)   charge ${charge.toFixed(1)}gr (estimated)  FRE ${rifleFre.toFixed(2)} ft-lb`);
}

console.log(failures ? `\n${failures} FAILING` : "\nAll checks passed.");
process.exit(failures ? 1 : 0);
