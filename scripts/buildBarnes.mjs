// Transforms scratchpad/barnes_raw.json (from barnes_raw.py) into
// commercialAmmo.js entries. Same shape as buildWinchester.mjs:
//   - normalizes Barnes's cartridge names to the catalog's conventions and
//     prints a match / new-cartridge report
//   - bullet field is "<product line> — <bullet style>"
//   - every Barnes entry has a published G1 BC (0 drops expected)
//
// Output: scratchpad/barnes_entries.js  (paste block for commercialAmmo.js)
import { readFileSync, writeFileSync } from "node:fs";
import { COMMERCIAL_AMMO } from "../src/data/commercialAmmo.js";

const SCRATCH =
  "C:/Users/YGACPA/AppData/Local/Temp/claude/C--Users-Public-OneDrive-Projects-Ballistics/af6ffc11-ac36-4a0f-bf2f-4cbb92c3359f/scratchpad";

const raw = JSON.parse(readFileSync(`${SCRATCH}/barnes_raw.json`, "utf8"));

// --- cartridge name normalization ------------------------------------------

const CARTRIDGE_ALIASES = {
  "5.56 x 45mm": "5.56 NATO",
  "7x64 Bren": "7x64 Brenneke",
  "280 Ack Imp": "280 Ackley Improved",
  "9.3x62": "9.3x62 Mauser",
  "338 Rem Ultra Mag": "338 Remington Ultra Magnum",
  "375 Rem Ultra Mag": "375 Remington Ultra Magnum",
  "7mm Rem Ultra Mag": "7mm Remington Ultra Mag",
  "458 LOTT": "458 Lott",
  "500 Nitro Express": "500 Nitro Express 3in",
  // Handgun cartridges Barnes loads for lever rifles (Pioneer line) — kept,
  // tagged so the caliber dropdown is unambiguous. Matches the Winchester
  // catalog's "357 Mag (rifle)" / "44 Rem Mag (rifle)".
  "357 Magnum": "357 Mag (rifle)",
  "44 Rem Mag": "44 Rem Mag (rifle)",
  "45 Colt": "45 Colt (rifle)",
};

function normalizeCartridge(name) {
  if (CARTRIDGE_ALIASES[name]) return CARTRIDGE_ALIASES[name];
  return name
    .replace(/\bGovt\b/, "Gov't")
    .replace(/\bRemington\b/, "Rem")
    .replace(/\bWinchester\b/, "Win")
    .trim();
}

// --- product line + bullet label ------------------------------------------

const LINE_LABEL = {
  PM: "Precision Match",
  "Vor-TX": "VOR-TX",
  Barnes: "Barnes",
};
const lineLabel = (line) => LINE_LABEL[line] || line;

function bulletLabel(line, style) {
  const a = lineLabel(line).trim();
  const b = style.trim();
  if (!b) return a;
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
  const mv = Math.round(parseFloat(r.mv));
  const bc = parseFloat(r.bc);
  const grains = Number(r.weight);
  const label = `${r.sku}  ${r.cartridge} ${r.line} ${r.weight}gr`;
  if (!(mv > 0) || !(bc > 0) || !(grains > 0)) {
    dropped.push(`${label}  (mv=${r.mv} bc=${r.bc} wt=${r.weight})`);
    continue;
  }
  if (seen.has(r.sku)) continue;
  seen.add(r.sku);

  entries.push({
    id: r.sku,
    cartridge: normalizeCartridge(r.cartridge),
    bullet: bulletLabel(r.line, r.style),
    grains,
    muzzleVelocity: mv,
    ballisticCoefficient: bc,
    dragModel: "G1",
    manufacturer: "Barnes",
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

console.log(`\n=== ${entries.length} Barnes entries (all published G1 BC) ===`);
if (dropped.length) {
  console.log(`dropped ${dropped.length}:`);
  for (const d of dropped) console.log(`  ${d}`);
}

console.log(`\n--- cartridges that match an existing catalog name (${known.length}) ---`);
for (const [norm, v] of known) console.log(`  ${v.raw.padEnd(22)} -> ${norm}`);
console.log(`\n--- NEW cartridges not currently in the catalog (${novel.length}) — REVIEW ---`);
for (const [norm, v] of novel) console.log(`  ${v.raw.padEnd(22)} -> ${norm}`);

const collisions = {};
for (const e of entries) {
  const k = `${e.cartridge} | ${e.grains}gr | ${e.bullet}`;
  (collisions[k] ??= []).push(e);
}
const dupLabels = Object.entries(collisions).filter(([, a]) => a.length > 1);
if (dupLabels.length) {
  console.log(`\n--- identical cartridge+grains+bullet labels (${dupLabels.length}) ---`);
  for (const [k, a] of dupLabels)
    console.log(`  ${k}  (${a.map((e) => `${e.id} @ ${e.muzzleVelocity}`).join(", ")})`);
}

const lines = entries.map(
  (o) =>
    `  { id: "${o.id}", cartridge: "${o.cartridge}", bullet: "${o.bullet}", grains: ${o.grains}, muzzleVelocity: ${o.muzzleVelocity}, ballisticCoefficient: ${o.ballisticCoefficient}, dragModel: "${o.dragModel}", manufacturer: "${o.manufacturer}", bcSource: "${o.bcSource}" },`
);
writeFileSync(`${SCRATCH}/barnes_entries.js`, lines.join("\n") + "\n");
console.log(`\nwrote ${entries.length} entries to barnes_entries.js`);
