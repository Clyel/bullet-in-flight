// Transforms scratchpad/browning_raw.json (from browning_raw.mjs) into
// commercialAmmo.js entries. Every Browning entry has a published G1 BC
// (from browningammo.com's symbol API). 4 Max Point loads with no published
// BC are dropped — the same budget line, and the same gap, as Winchester's.
//
// Output: scratchpad/browning_entries.js
import { readFileSync, writeFileSync } from "node:fs";
import { COMMERCIAL_AMMO } from "../src/data/commercialAmmo.js";

const SCRATCH =
  "C:/Users/YGACPA/AppData/Local/Temp/claude/C--Users-Public-OneDrive-Projects-Ballistics/af6ffc11-ac36-4a0f-bf2f-4cbb92c3359f/scratchpad";

const raw = JSON.parse(readFileSync(`${SCRATCH}/browning_raw.json`, "utf8"));

const CARTRIDGE_ALIASES = {
  "300 Winchester Magnum": "300 Win Mag",
  "7mm Remington Magnum": "7mm Rem Mag",
};
function normalizeCartridge(name) {
  if (CARTRIDGE_ALIASES[name]) return CARTRIDGE_ALIASES[name];
  return name.replace(/\bRemington\b/, "Rem").replace(/\bWinchester\b/, "Win").trim();
}

// The API's "feature" carries per-cartridge variant suffixes ("Silver Series
// - Mag", "BXV 22 Hornet", "Max-Point-02"). Collapse them to the real line.
function normalizeLine(feature) {
  const f = feature.trim();
  if (/^max[\s-]*point/i.test(f)) return "Max Point";
  if (/^silver series/i.test(f)) return "Silver Series";
  if (/^bxv/i.test(f)) return "BXV";
  return f.replace(/\s*-\s*.*$/, "").trim();
}

const cleanBullet = (s) => s.replace(/[®™]/g, "").replace(/\s+/g, " ").trim();

function bulletLabel(line, bulletType) {
  const a = normalizeLine(line);
  const b = cleanBullet(bulletType);
  if (!b) return a;
  const la = a.toLowerCase();
  const lb = b.toLowerCase();
  if (la === lb || la.includes(lb) || lb.includes(la)) return la.length >= lb.length ? a : b;
  return `${a} — ${b}`;
}

const seen = new Set();
const entries = [];
const dropped = [];

for (const r of raw) {
  const bc = parseFloat(r.bc);
  const mv = Math.round(parseFloat(r.mv));
  const grains = parseFloat(r.weight);
  const label = `${r.sku}  ${r.cartridge} ${r.feature} ${r.weight}gr`;
  if (!(bc > 0) || !(mv > 0) || !(grains > 0)) {
    dropped.push(`${label}  (bc=${r.bc} mv=${r.mv})`);
    continue;
  }
  if (seen.has(r.sku)) continue;
  seen.add(r.sku);

  entries.push({
    id: `browning-${r.sku}`,
    cartridge: normalizeCartridge(r.cartridge),
    bullet: bulletLabel(r.feature, r.bulletType),
    grains,
    muzzleVelocity: mv,
    ballisticCoefficient: bc,
    dragModel: "G1",
    manufacturer: "Browning",
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
console.log(`\n=== ${entries.length} Browning entries (all published G1 BC) ===`);
console.log(`dropped ${dropped.length}:`);
for (const d of dropped) console.log(`  ${d}`);

console.log(`\n--- cartridges matching an existing catalog name (${Object.values(byCartridge).filter((v) => v.known).length}) ---`);
for (const [norm, v] of Object.entries(byCartridge).filter(([, v]) => v.known)) console.log(`  ${v.raw.padEnd(24)} -> ${norm}`);
const novel = Object.entries(byCartridge).filter(([, v]) => !v.known);
console.log(`\n--- NEW cartridges (${novel.length}) ---`);
for (const [norm, v] of novel) console.log(`  ${v.raw.padEnd(24)} -> ${norm}`);

console.log(`\n--- entries ---`);
for (const e of entries)
  console.log(`  ${e.cartridge.padEnd(16)} ${String(e.grains).padStart(4)}gr  ${e.bullet.padEnd(42)} MV ${e.muzzleVelocity}  BC ${e.ballisticCoefficient}`);

const collisions = {};
for (const e of entries) {
  const k = `${e.cartridge} | ${e.grains}gr | ${e.bullet}`;
  (collisions[k] ??= []).push(e);
}
const dup = Object.entries(collisions).filter(([, a]) => a.length > 1);
if (dup.length) {
  console.log(`\n--- identical cartridge+grains+bullet (${dup.length}) ---`);
  for (const [k, a] of dup) console.log(`  ${k}  (${a.map((e) => `${e.id}@${e.muzzleVelocity}`).join(", ")})`);
}

const lines = entries.map(
  (o) =>
    `  { id: "${o.id}", cartridge: "${o.cartridge}", bullet: "${o.bullet}", grains: ${o.grains}, muzzleVelocity: ${o.muzzleVelocity}, ballisticCoefficient: ${o.ballisticCoefficient}, dragModel: "${o.dragModel}", manufacturer: "${o.manufacturer}", bcSource: "${o.bcSource}" },`
);
writeFileSync(`${SCRATCH}/browning_entries.js`, lines.join("\n") + "\n");
console.log(`\nwrote ${entries.length} entries to browning_entries.js`);
