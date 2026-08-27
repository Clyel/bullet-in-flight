import { readFileSync, writeFileSync } from "node:fs";
import { deriveBC, fitResidualRMS } from "./deriveBC.mjs";

const SCRATCH = "C:/Users/YGACPA/AppData/Local/Temp/claude/C--Users-Public-OneDrive-Projects-Ballistics/af6ffc11-ac36-4a0f-bf2f-4cbb92c3359f/scratchpad";
const rows = JSON.parse(readFileSync(`${SCRATCH}/federal_rows.json`, "utf8"));

// Federal explicitly states its own test conditions in the ballistics chart
// (59F, 29.53 inHg, sea level) - more precise than assuming our own default.
const TEMP_F = 59;
const PRESS_INHG = 29.53;

const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const seen = new Set();
const entries = [];
let badFits = 0;
let published = 0;
let derived = 0;

for (const [cartridge, bullet, grains, item, mv, farYd, farV, pubBC] of rows) {
  let bc, bcSource;
  if (pubBC != null) {
    bc = pubBC;
    bcSource = "published";
    published++;
  } else {
    try {
      bc = deriveBC(mv, "G1", TEMP_F, PRESS_INHG, farYd, farV);
    } catch (e) {
      console.error("FIT FAIL", cartridge, bullet, grains, e.message);
      continue;
    }
    const rms = fitResidualRMS(mv, bc, "G1", TEMP_F, PRESS_INHG, [[farYd, farV]]);
    if (rms > 5) { badFits++; console.error("HIGH RESIDUAL", cartridge, bullet, grains, "rms=", rms.toFixed(2)); }
    bc = Math.round(bc * 1000) / 1000;
    bcSource = "derived-federal";
    derived++;
  }

  let id = `fed-${slugify(cartridge)}-${grains}-${slugify(bullet)}`;
  let n = 2;
  while (seen.has(id)) { id = `fed-${slugify(cartridge)}-${grains}-${slugify(bullet)}-${n}`; n++; }
  seen.add(id);

  entries.push({
    id, cartridge, bullet, grains, muzzleVelocity: mv,
    ballisticCoefficient: bc,
    dragModel: "G1", manufacturer: "Federal", bcSource,
  });
}

console.log(`Fitted ${entries.length} entries (${published} published, ${derived} derived), ${badFits} with residual > 5fps`);

const lines = entries.map(o =>
  `  { id: "${o.id}", cartridge: "${o.cartridge}", bullet: "${o.bullet}", grains: ${o.grains}, muzzleVelocity: ${o.muzzleVelocity}, ballisticCoefficient: ${o.ballisticCoefficient}, dragModel: "${o.dragModel}", manufacturer: "${o.manufacturer}", bcSource: "${o.bcSource}" },`
);

writeFileSync(`${SCRATCH}/federal_entries.js`, lines.join("\n"));
console.log("done");
