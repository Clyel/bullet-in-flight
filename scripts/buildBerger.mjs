// Transforms scratchpad/berger_raw.json (from berger_raw.mjs) into
// commercialAmmo.js entries.
//
// Berger is the catalog's first source with a published, radar-measured G7
// BC, so these entries carry dragModel "G7" and the G7 value (not G1) — the
// same way the ~46 Hornady ELD entries already do. bcSource "published".
//
// Drops the loads Berger states no muzzle velocity for (a few Classic
// Hunter hunting loads) — no fabricated numbers.
//
// Output: scratchpad/berger_entries.js
import { readFileSync, writeFileSync } from "node:fs";
import { COMMERCIAL_AMMO } from "../src/data/commercialAmmo.js";

const SCRATCH =
  "C:/Users/YGACPA/AppData/Local/Temp/claude/C--Users-Public-OneDrive-Projects-Ballistics/af6ffc11-ac36-4a0f-bf2f-4cbb92c3359f/scratchpad";

const raw = JSON.parse(readFileSync(`${SCRATCH}/berger_raw.json`, "utf8"));

const CARTRIDGE_ALIASES = {
  "6.5mm Creedmoor": "6.5 Creedmoor",
  "6mm Creedmoor": "6mm Creedmoor",
  "223 Remington": "223 Rem",
  "260 Remington": "260 Rem",
  "308 Winchester": "308 Win",
  "300 Winchester Magnum": "300 Win Mag",
  "300 Winchester Short Magnum": "300 WSM",
  "300 Norma Magnum": "300 Norma Mag",
  "338 Norma Magnum": "338 Norma Mag",
  "338 Lapua Magnum": "338 Lapua Mag",
};
const normalizeCartridge = (name) => CARTRIDGE_ALIASES[name] || name.trim();

// bullet label: the product name minus the "<cartridge> <weight> Grain "
// prefix and the " Rifle Ammunition" suffix — keeps the descriptive bit
// ("Long Range Hybrid Target", "Juggernaut OTM Tactical", "Elite Hunter").
function bulletLabel(name) {
  return name
    .replace(/\s*Rifle Ammunition\s*$/i, "")
    .replace(/^.*?\b\d+(?:\.\d+)?\s*(?:Grain|Gr)\b\s*/i, "")
    .trim();
}

const seen = new Set();
const entries = [];
const dropped = [];

for (const r of raw) {
  const mv = Math.round(parseFloat(r.mv));
  const g7 = parseFloat(r.g7bc);
  const grains = parseFloat(r.weight);
  const label = `${r.sku}  ${r.cartridge} ${r.weight}`;
  if (!(mv > 0)) {
    dropped.push(`${label}  (Berger states no muzzle velocity)`);
    continue;
  }
  if (!(g7 > 0) || !(grains > 0)) {
    dropped.push(`${label}  (g7=${r.g7bc} wt=${r.weight})`);
    continue;
  }
  if (seen.has(r.sku)) continue;
  seen.add(r.sku);

  entries.push({
    id: `berger-${r.sku}`,
    cartridge: normalizeCartridge(r.cartridge),
    bullet: bulletLabel(r.name),
    grains,
    muzzleVelocity: mv,
    ballisticCoefficient: g7,
    dragModel: "G7",
    manufacturer: "Berger",
    bcSource: "published",
  });
}

// --- reports -----------------------------------------------------------------

const catalogCartridges = new Set(COMMERCIAL_AMMO.map((a) => a.cartridge));
const byCartridge = {};
for (const r of raw) {
  const norm = normalizeCartridge(r.cartridge);
  (byCartridge[norm] ??= { raw: r.cartridge, known: catalogCartridges.has(norm) });
}
const known = Object.entries(byCartridge).filter(([, v]) => v.known);
const novel = Object.entries(byCartridge).filter(([, v]) => !v.known);

console.log(`\n=== ${entries.length} Berger entries (all published G7 BC, dragModel G7) ===`);
console.log(`dropped ${dropped.length}:`);
for (const d of dropped) console.log(`  ${d}`);

console.log(`\n--- cartridges matching an existing catalog name (${known.length}) ---`);
for (const [norm, v] of known) console.log(`  ${v.raw.padEnd(30)} -> ${norm}`);
console.log(`\n--- NEW cartridges (${novel.length}) — REVIEW ---`);
for (const [norm, v] of novel) console.log(`  ${v.raw.padEnd(30)} -> ${norm}`);

console.log(`\n--- entries ---`);
for (const e of entries)
  console.log(`  ${e.cartridge.padEnd(16)} ${String(e.grains).padStart(5)}gr  ${e.bullet.padEnd(28)} MV ${e.muzzleVelocity}  G7 ${e.ballisticCoefficient}`);

const lines = entries.map(
  (o) =>
    `  { id: "${o.id}", cartridge: "${o.cartridge}", bullet: "${o.bullet}", grains: ${o.grains}, muzzleVelocity: ${o.muzzleVelocity}, ballisticCoefficient: ${o.ballisticCoefficient}, dragModel: "${o.dragModel}", manufacturer: "${o.manufacturer}", bcSource: "${o.bcSource}" },`
);
writeFileSync(`${SCRATCH}/berger_entries.js`, lines.join("\n") + "\n");
console.log(`\nwrote ${entries.length} entries to berger_entries.js`);
