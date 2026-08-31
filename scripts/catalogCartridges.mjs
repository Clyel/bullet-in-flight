// One-off: list every distinct cartridge in the commercial catalog with its
// representative (median) bullet weight, to guide which Nosler bullet-weight
// PDF bracket to pull per cartridge for case-capacity data.
import { COMMERCIAL_AMMO } from "../src/data/commercialAmmo.js";
import { writeFileSync } from "node:fs";

const SCRATCH = "C:/Users/YGACPA/AppData/Local/Temp/claude/C--Users-Public-OneDrive-Projects-Ballistics/af6ffc11-ac36-4a0f-bf2f-4cbb92c3359f/scratchpad";

const byCart = new Map();
for (const a of COMMERCIAL_AMMO) {
  if (!byCart.has(a.cartridge)) byCart.set(a.cartridge, []);
  byCart.get(a.cartridge).push(a.grains);
}

const rows = [...byCart.entries()].map(([cartridge, weightsRaw]) => {
  const weights = [...weightsRaw].sort((a, b) => a - b);
  const median = weights[Math.floor(weights.length / 2)];
  return {
    cartridge,
    count: weights.length,
    weights: [...new Set(weights)].sort((a, b) => a - b),
    representativeGrains: median,
  };
}).sort((a, b) => a.cartridge.localeCompare(b.cartridge));

writeFileSync(`${SCRATCH}/catalog_cartridges.json`, JSON.stringify(rows, null, 2));
console.log(`wrote ${rows.length} cartridges to catalog_cartridges.json`);
