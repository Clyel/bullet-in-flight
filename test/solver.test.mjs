import { readFileSync } from "node:fs";
import { solveTrajectory, solveZeroAngle, integrate, sampleAt, heightAtRange } from "../src/ballistics/solver.js";
import { vitalsWindow, optimalSightIn } from "../src/ballistics/vitalsWindow.js";
import { reticleGroups, dropAt500With200Zero } from "../src/ballistics/reticleGroups.js";
import { inclinedEquivalentRange } from "../src/ballistics/inclineComp.js";
import { freeRecoilEnergy, estimateChargeWeight } from "../src/ballistics/recoil.js";
import { millerStability, spinDriftIn } from "../src/ballistics/spinDrift.js";
import { coriolisWindageIn } from "../src/ballistics/coriolis.js";
import { bcFromVelocity, bcFromTimeOfFlight } from "../src/ballistics/bcFromChrono.js";

const ref = JSON.parse(readFileSync(new URL("./fixtures/reference.json", import.meta.url)));

// Tolerances vs. an independent reference solver (py-ballisticcalc, RK4).
// Set just above the worst deviations README's Accuracy table documents
// (dV 1.0 fps / dE 0.8 ft-lb / dH 0.15 in / dW 0.06 in / dT 0.0005 s), with
// only enough headroom to absorb normal noise — a real 3x regression in any
// of these trips a FAIL instead of passing silently under a 6x-loose bound.
const TOL = { velocity: 1.0, energy: 1.5, height: 0.3, windage: 0.15, time: 0.001 };

let failures = 0;
for (const [name, fx] of Object.entries(ref)) {
  // The spin-drift/Coriolis fixtures further down are windage-only rows
  // (just d/t/w -- see generate.py) and get their own dedicated comparison
  // blocks below, composed the way solveFromForm.js actually combines them.
  // Skipping them here isn't a coverage gap: the base trajectory numbers
  // (velocity/energy/height) for the exact same cartridges are already
  // exercised by the plain and wind fixtures above. Without this skip,
  // reading undefined v/e/h/zeroAngleDeg off these rows produces NaN --
  // and `NaN > TOL.x` is always false, which would silently "pass" a
  // comparison that never actually ran, instead of failing loudly.
  if (fx.rows[0]?.v === undefined) continue;
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
    // Only the wind cases set windMph -- the spin-drift/Coriolis fixtures
    // below also carry a `w` column, but solveTrajectory() here isn't given
    // twist/latitude (that composition happens in the dedicated blocks
    // further down), so their windage would be spuriously 0 here and fail
    // for the wrong reason. Still exercises velocity/height/time for those
    // cases -- a free check that irrelevant params don't perturb the base
    // trajectory.
    if (r.w !== undefined && p.windMph !== undefined) {
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

// Spin drift: independent-fixture check against py-ballisticcalc, same
// rigor as the wind loop above -- but solveTrajectory() itself has no idea
// spin drift exists (kept out of the validated integrator on purpose, see
// spinDrift.js's own header); solveFromForm.js composes it by adding
// spinDriftIn(row.time, ...) onto each row's windage after the fact, so
// that's exactly what this test does too, then compares the combined
// value against the fixture's reference windage.
for (const [name, fx] of Object.entries(ref)) {
  if (!fx.params.twistIn) continue;
  const p = fx.params;
  const sol = solveTrajectory({
    muzzleVelocity: p.mv, ballisticCoefficient: p.bc, dragModel: p.model, grains: p.grains,
    sightHeight: p.sightHeight, zeroRangeYd: p.zeroYd, maxRangeYd: 1000, tableStepYd: 100,
    tempF: p.tempF, pressInHg: p.pressInHg,
  });
  let worst = 0;
  for (const r of fx.rows) {
    const mine = sol.rows.find((x) => Math.abs(x.range - r.d) < 0.51);
    if (!mine) continue;
    const combined = mine.windage + spinDriftIn(mine.time, {
      twistIn: p.twistIn, diameterIn: p.diameter, lengthIn: p.length,
      grains: p.grains, muzzleVelocityFps: p.mv, tempF: p.tempF, pressInHg: p.pressInHg,
    });
    worst = Math.max(worst, Math.abs(combined - r.w));
  }
  const ok = worst <= TOL.windage;
  if (!ok) failures++;
  console.log(`${ok ? "pass" : "FAIL"}  spin drift ${name.padEnd(22)} dW ${worst.toFixed(4)}in`);
}

// Coriolis (latitude-only "flat-fire" mode): same independent-fixture
// treatment, composed the same way solveFromForm.js will -- coriolisWindageIn
// added onto each row's windage after solveTrajectory(), which doesn't know
// latitude exists either.
for (const [name, fx] of Object.entries(ref)) {
  if (fx.params.latitudeDeg === undefined) continue;
  const p = fx.params;
  const sol = solveTrajectory({
    muzzleVelocity: p.mv, ballisticCoefficient: p.bc, dragModel: p.model, grains: p.grains,
    sightHeight: p.sightHeight, zeroRangeYd: p.zeroYd, maxRangeYd: 1000, tableStepYd: 100,
    tempF: 59, pressInHg: 29.92,
  });
  let worst = 0;
  for (const r of fx.rows) {
    const mine = sol.rows.find((x) => Math.abs(x.range - r.d) < 0.51);
    if (!mine) continue;
    const combined = mine.windage + coriolisWindageIn(mine.time, mine.range, p.latitudeDeg);
    worst = Math.max(worst, Math.abs(combined - r.w));
  }
  const ok = worst <= TOL.windage;
  if (!ok) failures++;
  console.log(`${ok ? "pass" : "FAIL"}  coriolis ${name.padEnd(24)} dW ${worst.toFixed(4)}in`);
}

// Self-consistency guards on top of the fixture checks above -- cheap
// regression traps for the "blank means off" contract and the sign
// conventions (right-hand twist / Northern latitude both drift right).
{
  // Hand-derived from the Miller formula for this exact case (308_175_G7,
  // 8in twist): SG = 30*175 / (25.974^2 * 0.308^3 * 4.026 * (1+4.026^2))
  // * (2600/2800)^(1/3) * 1 (std atmosphere) ~= 3.75 -- matches the fixture
  // (test/fixtures/generate.py's 308_175_G7_twist8) to within rounding.
  const sg = millerStability({ twistIn: 8, diameterIn: 0.308, lengthIn: 1.24, grains: 175, muzzleVelocityFps: 2600, tempF: 59, pressInHg: 29.92 });
  const sgOk = Math.abs(sg - 3.75) < 0.02 && millerStability({ twistIn: 0, diameterIn: 0.308, lengthIn: 1.24, grains: 175, muzzleVelocityFps: 2600, tempF: 59, pressInHg: 29.92 }) === 0;
  if (!sgOk) failures++;
  console.log(`${sgOk ? "pass" : "FAIL"}  Miller stability coefficient   SG ${sg.toFixed(3)} (want ~3.75), blank twist -> 0`);

  const noTwist = spinDriftIn(1.0, { twistIn: 0, diameterIn: 0.308, lengthIn: 1.2, grains: 175, muzzleVelocityFps: 2600, tempF: 59, pressInHg: 29.92 });
  const noLength = spinDriftIn(1.0, { twistIn: 10, diameterIn: 0.308, lengthIn: 0, grains: 175, muzzleVelocityFps: 2600, tempF: 59, pressInHg: 29.92 });
  const right = spinDriftIn(0.5, { twistIn: 10, diameterIn: 0.308, lengthIn: 1.2, grains: 175, muzzleVelocityFps: 2600, tempF: 59, pressInHg: 29.92 });
  const left = spinDriftIn(0.5, { twistIn: -10, diameterIn: 0.308, lengthIn: 1.2, grains: 175, muzzleVelocityFps: 2600, tempF: 59, pressInHg: 29.92 });
  const grows = spinDriftIn(1.0, { twistIn: 10, diameterIn: 0.308, lengthIn: 1.2, grains: 175, muzzleVelocityFps: 2600, tempF: 59, pressInHg: 29.92 });
  const ok = noTwist === 0 && noLength === 0 && right > 0 && left < 0 &&
             Math.abs(right + left) < 1e-9 && grows > right;
  if (!ok) failures++;
  console.log(`${ok ? "pass" : "FAIL"}  spin drift self-consistency   blank->0, right +${right.toFixed(3)}in, left ${left.toFixed(3)}in, grows ${grows.toFixed(3)}in`);
}
{
  const blank = coriolisWindageIn(1.0, 500, NaN);
  const equator = coriolisWindageIn(1.0, 500, 0);
  const north = coriolisWindageIn(1.0, 500, 45);
  const south = coriolisWindageIn(1.0, 500, -45);
  const ok = blank === 0 && Math.abs(equator) < 1e-9 && north > 0 && south < 0 && Math.abs(north + south) < 1e-9;
  if (!ok) failures++;
  console.log(`${ok ? "pass" : "FAIL"}  coriolis self-consistency   blank->0, equator ${equator.toFixed(4)}in, N +${north.toFixed(4)}in, S ${south.toFixed(4)}in`);
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

// Table assembly (not physics): the last row must land exactly on the
// requested max range even when it isn't a whole number of steps out (every
// metric session — the "table every" presets are 27.34 / 54.68 / 109.36
// canonical yd), and `last` must be that row, with its numbers matching a
// direct sample of the path at that range. Regression guard for the
// SummaryStrip "At {maxRangeYd}" mislabel.
{
  const t = solveTrajectory({
    muzzleVelocity: 2825, ballisticCoefficient: 0.265, dragModel: "G7", grains: 172,
    sightHeight: 1.5, zeroRangeYd: 200, maxRangeYd: 546.8, tableStepYd: 109.36,
    tempF: 59, pressInHg: 29.92,
  });
  const lastRow = t.rows[t.rows.length - 1];
  const direct = sampleAt(t.path, 546.8);
  const tableOk =
    Math.abs(lastRow.range - 546.8) < 1e-9 &&
    t.last === lastRow &&
    Math.abs(lastRow.velocity - direct.v) < 1e-9 &&
    Math.abs(lastRow.height - direct.y) < 1e-9 &&
    t.rows.every((r, i) => i === 0 || r.range > t.rows[i - 1].range);
  if (!tableOk) failures++;
  console.log(`${tableOk ? "pass" : "FAIL"}  off-grid max range   last row ${lastRow.range.toFixed(2)}yd (want 546.80)  rows ${t.rows.length}`);
}

// heightAtRange (the allocation-free path solveZeroAngle now uses) must be
// bit-identical to sampling a full integrate() — same integrator, same
// interpolation. Check across launch angles and ranges, including a range
// past where the trajectory reaches (must fall back to the last sample) and
// a range of 0 (must give the muzzle height).
{
  const base = {
    muzzleVelocity: 2700, ballisticCoefficient: 0.243, dragModel: "G7",
    sightHeight: 1.6, tempF: 47, pressInHg: 27.1, windSpeedMph: 12, windClock: 2,
  };
  let worst = 0;
  for (const angle of [0, 0.001, 0.004, 0.01]) {
    const path = integrate({ ...base, launchAngleRad: angle, maxRangeYd: 600 });
    for (const r of [0, 1, 137.5, 300, 599.9, 600, 800]) {
      const viaPath = sampleAt(path, r).y;
      const direct = heightAtRange({ ...base, launchAngleRad: angle, maxRangeYd: 600 }, r);
      worst = Math.max(worst, Math.abs(viaPath - direct));
    }
  }
  const hOk = worst === 0;
  if (!hOk) failures++;
  console.log(`${hOk ? "pass" : "FAIL"}  heightAtRange vs full path   worst delta ${worst.toExponential(2)}in (want exactly 0)`);
}

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

// Leupold BAS reticle groups: not new physics — a read-off of the same
// solveZeroAngle/heightAtRange used everywhere else, against a forced 200 yd
// zero. So no independent fixture, but the classification logic has its own
// ways to be wrong, so check it three ways: (1) the drop figure moves the
// right direction as a load slows down, (2) the assigned band never jumps
// backwards to a flatter group as drop grows, (3) a load Leupold itself
// names in a specific group lands in that group.
{
  const base = {
    ballisticCoefficient: 0.5, dragModel: "G1", sightHeight: 1.5,
    tempF: 59, pressInHg: 29.92,
  };
  // Sweep muzzle velocity from fast/flat to slow/steep.
  const mvs = [3400, 3100, 2900, 2700, 2500, 2300, 2100];
  let prevDrop = -Infinity;
  let prevBcIdx = -1;
  const bcBands = ["Group C", "Group A", "Group B", null];
  let sweepOk = true;
  for (const mv of mvs) {
    const { dropIn, reticles } = reticleGroups({ ...base, muzzleVelocity: mv });
    const bc = reticles.find((r) => r.key === "booneCrockett");
    const idx = bcBands.indexOf(bc.group);
    if (!(dropIn > prevDrop)) sweepOk = false;       // (1) monotone drop
    if (idx < prevBcIdx) sweepOk = false;            // (2) band never regresses
    prevDrop = dropIn;
    prevBcIdx = idx;
    console.log(
      `      BAS sweep  mv ${mv}  drop ${dropIn.toFixed(1)}in  ` +
      `B&C ${bc.group ?? "(none)"}  zero ${bc.zeroYd ?? "-"}yd  ${bc.powerSelector ?? "-"}`
    );
  }
  if (!sweepOk) failures++;
  console.log(`${sweepOk ? "pass" : "FAIL"}  BAS classification is monotone in muzzle velocity`);

  // (3) Leupold's manual lists "Hornady 6.5 Creedmoor 143gr ELD-X 2700 FPS"
  // as a Creedmoor-reticle Standard Load and puts 6.5 CM 143 @ 2700 in
  // Boone & Crockett Group A. Published G7 BC for the 143 ELD-X is 0.315.
  const eldx = reticleGroups({
    muzzleVelocity: 2700, ballisticCoefficient: 0.315, dragModel: "G7",
    sightHeight: 1.5, tempF: 59, pressInHg: 29.92,
  });
  const cm = eldx.reticles.find((r) => r.key === "creedmoor");
  const bc143 = eldx.reticles.find((r) => r.key === "booneCrockett");
  const knownOk = cm.group === "Standard loads" && bc143.group === "Group A";
  if (!knownOk) failures++;
  console.log(
    `${knownOk ? "pass" : "FAIL"}  BAS known load (6.5 CM 143 ELD-X @ 2700)  ` +
    `drop ${eldx.dropIn.toFixed(1)}in  Creedmoor "${cm.group}"  B&C "${bc143.group}"`
  );

  // A load far outside any reticle's designed range degrades to "no group"
  // on every reticle rather than throwing or mislabelling.
  let stubOk = true;
  try {
    const stub = reticleGroups({
      muzzleVelocity: 900, ballisticCoefficient: 0.2, dragModel: "G1",
      sightHeight: 1.5, tempF: 59, pressInHg: 29.92,
    });
    stubOk = stub.reticles.every((r) => r.group === null && r.zeroYd === null);
  } catch {
    stubOk = false;
  }
  if (!stubOk) failures++;
  console.log(`${stubOk ? "pass" : "FAIL"}  BAS out-of-range load degrades to (no group), no throw`);
}

// Rifleman's rule: a textbook closed-form identity, not a solver change.
// Checked against hand values — cos(0) = 1, cos(60) = 1/2, and a 400 yd
// shot at 30 degrees plays like 400 * cos(30) = 346.4 yd.
{
  const cases = [
    [400, 0, 400],
    [400, 60, 200],
    [400, 30, 346.41],
    [300, 45, 212.13],
  ];
  let rrOk = true;
  for (const [slant, angle, want] of cases) {
    const got = inclinedEquivalentRange(slant, angle);
    if (Math.abs(got - want) > 0.01) rrOk = false;
  }
  if (!Number.isNaN(inclinedEquivalentRange(400, NaN))) rrOk = false;
  if (!rrOk) failures++;
  console.log(`${rrOk ? "pass" : "FAIL"}  rifleman's rule (inclined equivalent range)`);
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

// BC from chronograph data: not new trajectory physics (same integrate()/
// sampleAt() as everywhere else, wrapped in a root-find) -- same category
// as optimalSightIn above, so no independent fixture, but the root-finder
// has its own way to be subtly wrong. Round-trip self-consistency: forward-
// solve a known BC to get the velocity/time a chronograph would have
// measured at a real distance, invert-solve those measurements, and confirm
// the same BC comes back.
{
  const cases = [
    { muzzleVelocity: 2825, ballisticCoefficient: 0.265, dragModel: "G7", distanceYd: 300 },
    { muzzleVelocity: 3240, ballisticCoefficient: 0.243, dragModel: "G1", distanceYd: 200 },
    { muzzleVelocity: 2700, ballisticCoefficient: 0.315, dragModel: "G7", distanceYd: 500 },
  ];
  const tempF = 59, pressInHg = 29.92;

  for (const c of cases) {
    const path = integrate({
      muzzleVelocity: c.muzzleVelocity, ballisticCoefficient: c.ballisticCoefficient, dragModel: c.dragModel,
      sightHeight: 0, launchAngleRad: 0, maxRangeYd: c.distanceYd * 1.02, tempF, pressInHg,
    });
    const p = sampleAt(path, c.distanceYd);

    const vResult = bcFromVelocity({
      muzzleVelocity: c.muzzleVelocity, targetVelocity: p.v, distanceYd: c.distanceYd,
      dragModel: c.dragModel, tempF, pressInHg,
    });
    const tResult = bcFromTimeOfFlight({
      muzzleVelocity: c.muzzleVelocity, targetTimeSec: p.t, distanceYd: c.distanceYd,
      dragModel: c.dragModel, tempF, pressInHg,
    });

    const vErr = vResult.ok ? Math.abs(vResult.ballisticCoefficient - c.ballisticCoefficient) : Infinity;
    const tErr = tResult.ok ? Math.abs(tResult.ballisticCoefficient - c.ballisticCoefficient) : Infinity;

    const ok = vResult.ok && tResult.ok && vErr < 0.0005 && tErr < 0.0005;
    if (!ok) failures++;
    console.log(
      `${ok ? "pass" : "FAIL"}  bcFromChrono round-trip  BC ${c.ballisticCoefficient} ${c.dragModel} @ ${c.distanceYd}yd  ` +
      `via-velocity ${vResult.ok ? vResult.ballisticCoefficient.toFixed(4) : "unsolved"}  ` +
      `via-time ${tResult.ok ? tResult.ballisticCoefficient.toFixed(4) : "unsolved"}`
    );
  }

  // Physically impossible input must be reported, not crash or silently
  // return a wrong number.
  const fasterThanMuzzle = bcFromVelocity({
    muzzleVelocity: 2800, targetVelocity: 3000, distanceYd: 300, dragModel: "G7", tempF, pressInHg,
  });
  const fasterThanMuzzleOk = fasterThanMuzzle.ok === false;
  if (!fasterThanMuzzleOk) failures++;
  console.log(`${fasterThanMuzzleOk ? "pass" : "FAIL"}  bcFromChrono rejects a downrange velocity higher than muzzle velocity`);

  const fasterThanPossible = bcFromTimeOfFlight({
    muzzleVelocity: 2800, targetTimeSec: 0.01, distanceYd: 300, dragModel: "G7", tempF, pressInHg,
  });
  const fasterThanPossibleOk = fasterThanPossible.ok === false;
  if (!fasterThanPossibleOk) failures++;
  console.log(`${fasterThanPossibleOk ? "pass" : "FAIL"}  bcFromChrono rejects a time of flight faster than physically possible`);
}

console.log(failures ? `\n${failures} FAILING` : "\nAll checks passed.");
process.exit(failures ? 1 : 0);
