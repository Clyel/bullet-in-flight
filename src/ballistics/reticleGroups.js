// Leupold Ballistics Aiming System (BAS) — reticle group classification.
//
// NOT new trajectory physics: a pure read-off of the already-validated
// solver, the same way vitalsWindow.js is. Leupold sorts a load into a
// group by exactly one number — inches of bullet drop below the line of
// sight at 500 yd with a 200 yd zero — and that group tells the shooter
// which distance to zero at and which power-selector triangle to set.
//
// Every threshold below is quoted verbatim from Leupold's published BAS
// manual (part #55994 / artwork #55993T). No proprietary formula is
// involved — the manual literally defines each group as a drop range.
import { solveZeroAngle, heightAtRange } from "./solver.js";

// The reference conditions the groups are defined against, fixed regardless
// of the zero the shooter actually runs or any wind they've entered — the
// classification is a property of the load, and Leupold's tables are stated
// for a still-air 200 yd zero read at 500 yd.
const CLASSIFY_ZERO_YD = 200;
const CLASSIFY_READ_YD = 500;

// Bands are listed flattest-first. `maxDropIn` is the top of each band; a
// load is assigned to the first band whose top it's at or under. Leupold
// quotes the ranges in whole inches with a one-inch gap between adjacent
// groups (e.g. B&C "35-46" then "47-58") — the .5 tops here bridge that gap
// so every drop up to the reticle's ceiling lands somewhere. A drop above
// the last band's top is out of the reticle's designed range: no group.
const RETICLES = [
  {
    key: "booneCrockett",
    label: "Boone & Crockett Big Game",
    bands: [
      { group: "Group C", maxDropIn: 35, zeroYd: 300, powerSelector: "Large triangle" },
      { group: "Group A", maxDropIn: 46.5, zeroYd: 200, powerSelector: "Large triangle" },
      { group: "Group B", maxDropIn: 58, zeroYd: 200, powerSelector: "Small triangle" },
    ],
  },
  {
    key: "lrVarmintHunter",
    label: "LR Varmint Hunter",
    bands: [
      { group: "Group C", maxDropIn: 30, zeroYd: 300, powerSelector: "Large triangle" },
      { group: "Group A", maxDropIn: 42.5, zeroYd: 200, powerSelector: "Large triangle" },
      { group: "Group B", maxDropIn: 55, zeroYd: 200, powerSelector: "Small triangle" },
    ],
  },
  {
    key: "creedmoor",
    label: "Creedmoor",
    // The Creedmoor reticle has no power selector — one set of hold points,
    // tuned by zero distance alone.
    bands: [
      { group: "High-velocity loads", maxDropIn: 35, zeroYd: 300, powerSelector: null },
      { group: "Standard loads", maxDropIn: 45, zeroYd: 200, powerSelector: null },
    ],
  },
];

/**
 * Inches of bullet drop below the line of sight at 500 yd with a forced
 * 200 yd zero — the single figure every Leupold BAS group is defined by.
 *
 * @param base  ballistic params, same shape as solveZeroAngle's minus
 *              zeroRangeYd (baseBallisticParams() in solveFromForm.js).
 *              Wind is ignored here on purpose — see CLASSIFY_ZERO_YD.
 * @returns {number} drop in inches (positive = below LOS), or NaN if the
 *          load can't even reach 500 yd / can't be zeroed at 200.
 */
export function dropAt500With200Zero(base) {
  const still = { ...base, windSpeedMph: undefined, windClock: undefined };
  let launchAngleRad;
  try {
    launchAngleRad = solveZeroAngle({ ...still, zeroRangeYd: CLASSIFY_ZERO_YD });
  } catch {
    return NaN;
  }
  const y = heightAtRange(
    { ...still, launchAngleRad, maxRangeYd: CLASSIFY_READ_YD + 10 },
    CLASSIFY_READ_YD
  );
  if (!Number.isFinite(y)) return NaN;
  return -y;
}

/**
 * Classifies a load against all three drop-based BAS reticles.
 *
 * @param base  see dropAt500With200Zero.
 * @returns {{
 *   dropIn: number,
 *   reticles: Array<{
 *     key: string, label: string,
 *     group: string|null, zeroYd: number|null, powerSelector: string|null
 *   }>
 * }}  `group` is null when the load drops more than the reticle covers.
 *     `dropIn` is NaN (and every group null) when the load can't be solved.
 */
export function reticleGroups(base) {
  const dropIn = dropAt500With200Zero(base);
  const reticles = RETICLES.map(({ key, label, bands }) => {
    const band = Number.isFinite(dropIn)
      ? bands.find((b) => dropIn <= b.maxDropIn)
      : undefined;
    return {
      key,
      label,
      group: band ? band.group : null,
      zeroYd: band ? band.zeroYd : null,
      powerSelector: band ? band.powerSelector : null,
    };
  });
  return { dropIn, reticles };
}
