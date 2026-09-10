// Harvests Norma's centerfire-rifle ammunition from the public Sanity CMS
// dataset behind norma-ammunition.com (Next.js + Sanity). The dataset is
// world-readable — one GROQ query returns every load with its published
// G1 BC and muzzle velocity, no page scraping needed.
//
// Output: scratchpad/norma_raw.json
import { writeFileSync } from "node:fs";

const SANITY =
  "https://6psbvfzb.apicdn.sanity.io/v2023-01-01/data/query/production?query=";
const SCRATCH =
  "C:/Users/YGACPA/AppData/Local/Temp/claude/C--Users-Public-OneDrive-Projects-Ballistics/af6ffc11-ac36-4a0f-bf2f-4cbb92c3359f/scratchpad";

// productData docs that are loaded rifle cartridges (not brass components or
// governmental contract rounds) and carry both a G1 BC and a muzzle velocity.
const GROQ = `*[
  _type == "productData"
  && cartridgeType == "Centerfire Rifle"
  && combinedType in ["Precision cartridge", "Hunting cartridge"]
  && majorFacts.ballisticCoefficientG1 > 0
  && dataFacts.velocityImp0 != null
]{
  _id, sku, name, caliber, productLine, categoryL1, combinedType, claimsData,
  "bc": majorFacts.ballisticCoefficientG1,
  "grains": majorFacts.weight_grain,
  "bullet": majorFacts.bulletDescription,
  "sd": majorFacts.sectionalDensity,
  "mv": dataFacts.velocityImp0,
  "v500": dataFacts.velocityImp500,
  "leadFree": majorFacts.leadFree
}`;

const res = await fetch(SANITY + encodeURIComponent(GROQ), {
  headers: { "User-Agent": "Mozilla/5.0" },
});
if (!res.ok) throw new Error(`Sanity query failed: ${res.status}`);
const { result } = await res.json();

writeFileSync(`${SCRATCH}/norma_raw.json`, JSON.stringify(result, null, 1));
console.log(`${result.length} loaded centerfire-rifle rows`);
console.log(`product lines: ${[...new Set(result.map((r) => r.productLine))].length}`);
console.log(`calibers: ${[...new Set(result.map((r) => r.caliber))].length}`);
