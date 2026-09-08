// Replaces derived-BC Hornady catalog entries with Hornady's own published
// BC, for every ELD Match / ELD-X entry that matches a bullet+weight on
// hornady.com/bc (see hornady_bc_raw.mjs for how that was sourced).
//
// Always uses the Mach 2.25 tier specifically -- Hornady's own page states
// that figure is "used when comparing to other published BC values within
// the industry," making it the one apples-to-apples with every other
// manufacturer's single published BC already in this catalog. Also
// switches matched entries from G1 to G7 (Hornady publishes both; G7 is
// the correct reference for a modern boat-tail bullet, and using it here
// closes the same G1-only gap documented in the README for every other
// manufacturer).
//
// Run with: node scripts/applyHornadyBC.mjs [--dry-run]

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { HORNADY_BC_RAW } from "./hornady_bc_raw.mjs";
import { COMMERCIAL_AMMO } from "../src/data/commercialAmmo.js";

const CATALOG_PATH = fileURLToPath(new URL("../src/data/commercialAmmo.js", import.meta.url));
const dryRun = process.argv.includes("--dry-run");

// Twist-duplicate bullets (same line+weight, two BCs by barrel twist) --
// this catalog has no twist field, so always take the slower/more common
// twist as the more broadly representative single figure. Parses the
// actual inches-per-turn number rather than comparing twistNote strings
// lexicographically -- "1 in 10"" vs "1 in 7"" and "1 in 8.75"" vs
// "1 in 7.5"" sort in OPPOSITE directions as plain strings (first
// character '1'<'7' vs '8'>'7'), which silently picked the wrong
// (faster) twist for the second pair on the first pass at this, caught
// by tracing through both cases by hand before ever running it.
const twistInches = (note) => (note ? parseFloat(note.match(/1 in ([\d.]+)/)[1]) : Infinity);
const byLineAndGrains = new Map();
for (const entry of HORNADY_BC_RAW) {
  const key = `${entry.line}|${entry.grains}`;
  const existing = byLineAndGrains.get(key);
  if (!existing || twistInches(entry.twistNote) > twistInches(existing.twistNote)) {
    byLineAndGrains.set(key, entry);
  }
}

const results = { matched: [], unmatched: [] };

for (const ammo of COMMERCIAL_AMMO) {
  if (ammo.manufacturer !== "Hornady") continue;
  if (ammo.bullet !== "ELD Match" && ammo.bullet !== "ELD-X") continue;
  const key = `${ammo.bullet}|${ammo.grains}`;
  const bc = byLineAndGrains.get(key);
  if (!bc) {
    results.unmatched.push(ammo);
    continue;
  }
  results.matched.push({ ammo, bc });
}

console.log(`Matched ${results.matched.length} of ${results.matched.length + results.unmatched.length} ELD Match/ELD-X entries.`);
if (results.unmatched.length) {
  console.log("Unmatched (left as derived-hornady, no code change):");
  for (const a of results.unmatched) console.log(`  ${a.id} -- ${a.bullet} ${a.grains}gr`);
}

let text = readFileSync(CATALOG_PATH, "utf8");
let changedCount = 0;

for (const { ammo, bc } of results.matched) {
  const oldBC = ammo.ballisticCoefficient;
  const newBC = bc.mach225.g7;
  const idEsc = ammo.id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Matches this exact catalog line by its unique id, then rewrites only
  // the three fields that change -- everything else on the line (cartridge,
  // bullet, grains, muzzleVelocity, manufacturer) stays byte-identical.
  const lineRe = new RegExp(
    `(\\{ id: "${idEsc}", [^\\n]*?ballisticCoefficient: )[\\d.]+(, [^\\n]*?dragModel: ")G1("[^\\n]*?bcSource: ")derived-hornady("[^\\n]*\\},)`
  );
  const next = text.replace(lineRe, `$1${newBC}$2G7$3published$4`);
  if (next === text) {
    console.log(`WARNING: regex did not match for ${ammo.id} -- left unchanged.`);
    continue;
  }
  text = next;
  changedCount++;
  console.log(`  ${ammo.id}: BC ${oldBC} (derived, G1) -> ${newBC} (published, G7)`);
}

console.log(`\n${changedCount} lines updated.`);

if (dryRun) {
  console.log("--dry-run: not writing the file.");
} else {
  writeFileSync(CATALOG_PATH, text);
  console.log(`Wrote ${CATALOG_PATH}`);
}
