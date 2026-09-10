// Transforms scratchpad/winchester_raw.json (from winchester_raw.mjs) into
// commercialAmmo.js entries.
//
//  - drops loads with no muzzle velocity
//  - dedupes by SKU (a couple of SKUs are listed under two product lines)
//  - normalizes Winchester's full cartridge names ("308 Winchester") to the
//    catalog's abbreviated conventions ("308 Win"), and prints a report of
//    every cartridge that still doesn't match an existing catalog string so
//    a human can catch an accidental near-duplicate before merge
//  - drops the ~8 loads Winchester lists with no published BC. We tried
//    back-calculating one from Winchester's own Trajectory endpoint, but that
//    endpoint is itself unreliable for exactly these BC-less loads -- it
//    returns ~84% velocity retention at 500 yd for a flat-base Power-Point,
//    which fits to a nonsense G1 BC over 1.0. No other first-party BC source
//    exists for them (the product pages don't expose one), so per the
//    catalog's "no fabricated numbers" rule they're left out.
//
// Output: scratchpad/winchester_entries.js  (paste block for commercialAmmo.js)
import { readFileSync, writeFileSync } from "node:fs";
import { COMMERCIAL_AMMO } from "../src/data/commercialAmmo.js";

const SCRATCH =
  "C:/Users/YGACPA/AppData/Local/Temp/claude/C--Users-Public-OneDrive-Projects-Ballistics/af6ffc11-ac36-4a0f-bf2f-4cbb92c3359f/scratchpad";

const raw = JSON.parse(readFileSync(`${SCRATCH}/winchester_raw.json`, "utf8"));

// --- cartridge name normalization -------------------------------------------

// Irregular cases the rule pass below can't reach. Left side is the exact
// Winchester API string; right side is the catalog's spelling.
const CARTRIDGE_ALIASES = {
  "300 Blackout": "300 AAC Blackout",
  "5.56mm": "5.56 NATO",
  "6.5 x 55 Swedish": "6.5x55 Swedish",
  "7.62 x 39mm": "7.62x39mm Soviet",
  "7.62 x 51mm NATO": "7.62x51mm",
  "7mm Mauser (7 x 57)": "7mm Mauser (7x57)",
  "8mm Mauser (8 x 57)": "8x57",
  // Handgun cartridges Winchester also loads for lever rifles -- kept, but
  // tagged so the caliber dropdown makes clear these are the rifle loads.
  "357 Magnum": "357 Mag (rifle)",
  "44 Remington Magnum": "44 Rem Mag (rifle)",
};

function normalizeCartridge(name) {
  if (CARTRIDGE_ALIASES[name]) return CARTRIDGE_ALIASES[name];
  return name
    .replace(/\bRemington Magnum\b/, "Rem Mag")
    .replace(/\bWinchester Magnum\b/, "Win Mag")
    .replace(/\bLapua Magnum\b/, "Lapua Mag")
    .replace(/\bRemington\b/, "Rem")
    .replace(/\bWinchester\b/, "Win")
    .replace(/\bGovernment\b/, "Gov't")
    .replace(/\bWinchester Special\b/, "Win Special")
    .trim();
}

// --- bullet label ----------------------------------------------------------

// "<product line> — <bullet type>", so someone hunting for a specific load
// ("Deer Season XP") or a specific bullet ("Extreme Point") finds it. Skip
// the join when the two are the same word (Power-Point / Power-Point) or one
// contains the other.
function bulletLabel(subBrand, ammoType) {
  const a = subBrand.trim();
  const b = ammoType.trim();
  const la = a.toLowerCase();
  const lb = b.toLowerCase();
  if (la === lb || la.includes(lb)) return a;
  if (lb.includes(la)) return b;
  return `${a} — ${b}`;
}

// --- transform -----------------------------------------------------------------

const catalogCartridges = new Set(COMMERCIAL_AMMO.map((a) => a.cartridge));

const seen = new Set();
const entries = [];
const dropped = [];

for (const r of raw) {
  const mv = Math.round(parseFloat(r.muzzleVelocity));
  const label = `${r.symbol}  ${r.cartridge} ${r.subBrand} ${r.weight}gr`;
  if (!(mv > 0)) {
    dropped.push(`${label}  (no muzzle velocity)`);
    continue;
  }
  if (!(r.ballisticCoefficient > 0)) {
    dropped.push(`${label}  (no published BC)`);
    continue;
  }
  if (seen.has(r.symbol)) continue; // same SKU under a second product line
  seen.add(r.symbol);

  entries.push({
    id: r.symbol,
    cartridge: normalizeCartridge(r.cartridge),
    bullet: bulletLabel(r.subBrand, r.ammoType),
    grains: Number(r.weight),
    muzzleVelocity: mv,
    ballisticCoefficient: r.ballisticCoefficient,
    dragModel: "G1",
    manufacturer: "Winchester",
    bcSource: "published",
  });
}

// --- reports -----------------------------------------------------------------

const byCartridge = {};
for (const r of raw) {
  const norm = normalizeCartridge(r.cartridge);
  (byCartridge[norm] ??= { raw: r.cartridge, known: catalogCartridges.has(norm) });
}
const known = Object.entries(byCartridge).filter(([, v]) => v.known);
const novel = Object.entries(byCartridge).filter(([, v]) => !v.known);

console.log(`\n=== ${entries.length} Winchester entries (all published BC) ===`);
console.log(`dropped ${dropped.length}:`);
for (const d of dropped) console.log(`  ${d}`);

console.log(`\n--- cartridges that match an existing catalog name (${known.length}) ---`);
for (const [norm, v] of known) console.log(`  ${v.raw.padEnd(26)} -> ${norm}`);

console.log(`\n--- NEW cartridges not currently in the catalog (${novel.length}) — REVIEW THESE ---`);
for (const [norm, v] of novel) console.log(`  ${v.raw.padEnd(26)} -> ${norm}`);

// grains + bullet collisions within a cartridge (the picker disambiguates
// these by muzzle velocity, but worth eyeballing)
const collisions = {};
for (const e of entries) {
  const k = `${e.cartridge} | ${e.grains}gr | ${e.bullet}`;
  (collisions[k] ??= []).push(e);
}
const dupLabels = Object.entries(collisions).filter(([, a]) => a.length > 1);
if (dupLabels.length) {
  console.log(`\n--- identical cartridge+grains+bullet labels (${dupLabels.length}) ---`);
  for (const [k, a] of dupLabels) console.log(`  ${k}  (${a.map((e) => `${e.id} @ ${e.muzzleVelocity}`).join(", ")})`);
}

const lines = entries.map(
  (o) =>
    `  { id: "${o.id}", cartridge: "${o.cartridge}", bullet: "${o.bullet}", grains: ${o.grains}, muzzleVelocity: ${o.muzzleVelocity}, ballisticCoefficient: ${o.ballisticCoefficient}, dragModel: "${o.dragModel}", manufacturer: "${o.manufacturer}", bcSource: "${o.bcSource}" },`
);
writeFileSync(`${SCRATCH}/winchester_entries.js`, lines.join("\n") + "\n");
console.log(`\nwrote ${entries.length} entries to winchester_entries.js`);
