// Transforms scratchpad/sig_raw.json (from sig_raw.py) into commercialAmmo.js
// entries. Every SIG rifle load publishes its G1 BC directly (no back-
// derivation needed, unlike Hornady/Nosler/most of Federal).
//
// KNOWN SOURCE BUG, corrected here: the VENARI (Soft Point) section's
// printed CALIBER text is wrong for all 8 of its rows -- a real authoring
// error in SIG's own PDF, not a parsing artifact. Confirmed two independent
// ways: (1) sig_raw.py's own SKU-prefix check flags all 8 rows, and (2) each
// row's own embedded weight and SKU agree with each other and with physical
// plausibility for the SKU-implied cartridge, not the printed one -- e.g.
// the row printed "270 Winchester / 130gr / 3140fps / BC .409" carries SKU
// "V270SP130" and 3140fps is the textbook factory velocity for a 270 Win
// 130gr load, while the row printed "30-06 Springfield" two rows away
// carries the SKU that actually says 270 ("V277SFSP130"). Corrected below
// by trusting the SKU (and cross-checked against every corrected pairing's
// physical plausibility) rather than the printed caliber text.
import { readFileSync, writeFileSync } from "node:fs";
import { COMMERCIAL_AMMO } from "../src/data/commercialAmmo.js";

const SCRATCH =
  "C:/Users/YGACPA/AppData/Local/Temp/claude/C--Users-Public-OneDrive-Projects-Ballistics/af6ffc11-ac36-4a0f-bf2f-4cbb92c3359f/scratchpad";

const raw = JSON.parse(readFileSync(`${SCRATCH}/sig_raw.json`, "utf8"));

const CARTRIDGE_ALIASES = {
  "300 Blackout": "300 AAC Blackout",
  "223 Remington": "223 Rem",
  "5.56mm": "5.56 NATO",
  "6mm CREEDMOOR": "6mm Creedmoor",
  "6.5 CREEDMOOR": "6.5 Creedmoor",
  "308 Winchester": "308 Win",
  "300 Winchester Magnum": "300 Win Mag",
  "22-250 Remington": "22-250 Rem",
  "243 Winchester": "243 Win",
  "270 Winchester": "270 Win",
  "7mm Remington Magnum": "7mm Rem Mag",
};
// The VENARI section's real caliber per row, keyed by its SKU (see header
// comment) -- the one section where `caliber` from sig_raw.json is not used.
const VENARI_CALIBER_BY_SKU = {
  V243SP100: "243 Winchester",
  V277SFSP130: "277 SIG Fury",
  V308SP150: "308 Winchester",
  V3006SP165: "30-06 Springfield",
  V65CMSP129: "6.5 Creedmoor",
  V270SP130: "270 Winchester",
  V7MMSP154: "7mm Remington Magnum",
  V300WMSP180: "300 Winchester Magnum",
};
function normalizeCartridge(name) {
  return CARTRIDGE_ALIASES[name] ?? name;
}

// Barrel length is folded into the bullet label, not the cartridge name --
// two 277 SIG Fury loads at different barrel lengths are different real-
// world muzzle velocities/products, same as this catalog already treats two
// different bullet weights of the same cartridge as separate entries, but
// "277 SIG Fury" itself stays one clean, filterable cartridge name.
function splitBarrel(caliber) {
  const m = caliber.match(/^(.*?)\s*\((\d+)" barrel\)$/i);
  return m ? { caliber: m[1].trim(), barrel: `${m[2]}in barrel` } : { caliber, barrel: null };
}

// Keys are the exact `section` strings sig_raw.py captures (the PDF's own
// multi-line headers split across source lines, so e.g. "VARMINT &
// PREDATOR" and "LEAD CORE TIPPED" -- the second line of their two-line
// headers -- never make it into `section` at all; verified against
// scratchpad/sig_raw.json directly rather than assumed).
const LINE_BY_SECTION = {
  "FMJ RIFLE": { line: "FMJ Rifle", bulletType: "FMJ" },
  "MARKSMAN & MARKSMAN": { line: "Elite Match", bulletType: "OTM" },
  "ELITE SERIES": { line: "Elite Varmint & Predator", bulletType: "Tipped" },
  "ELITE SERIES COPPER": { line: "Elite Copper", bulletType: "HT" },
  "ELITE SERIES TIPPED": { line: "Elite Tipped", bulletType: "Lead Core Tipped" },
  "ELITE HUNTER ACCUBOND": { line: "Elite Hunter AccuBond", bulletType: "AccuBond" },
  VENARI: { line: "Venari", bulletType: "Soft Point" },
};

const seen = new Set();
const entries = [];
const dropped = [];

for (const r of raw) {
  const sectionKey = r.section;
  const lineInfo = LINE_BY_SECTION[sectionKey];
  if (!lineInfo) {
    dropped.push(`unrecognized section ${r.section}: ${r.caliber}`);
    continue;
  }

  const isVenari = sectionKey === "VENARI";
  const { caliber: rawCaliber, barrel } = splitBarrel(isVenari ? (VENARI_CALIBER_BY_SKU[r.sku] ?? r.caliber) : r.caliber);
  const cartridge = normalizeCartridge(rawCaliber);
  const grains = parseFloat(r.weight);
  const mv = parseInt(r.mv, 10);
  const bc = parseFloat(r.bc);
  if (!(bc > 0) || !(mv > 0) || !(grains > 0)) {
    dropped.push(`${r.caliber} ${r.weight}gr ${r.sku} (bc=${r.bc} mv=${r.mv})`);
    continue;
  }

  const idBase = r.sku.replace(/"\s*/g, "").replace(/\s+/g, "-");
  if (seen.has(idBase)) continue;
  seen.add(idBase);

  entries.push({
    id: `sig-${idBase}`,
    cartridge,
    bullet: barrel ? `${lineInfo.line} — ${lineInfo.bulletType} (${barrel})` : `${lineInfo.line} — ${lineInfo.bulletType}`,
    grains,
    muzzleVelocity: mv,
    ballisticCoefficient: bc,
    dragModel: "G1",
    manufacturer: "Sig Sauer",
    bcSource: "published",
  });
}

// --- reports -----------------------------------------------------------------

const catalogCartridges = new Set(COMMERCIAL_AMMO.map((a) => a.cartridge));
console.log(`\n=== ${entries.length} Sig Sauer entries (all published G1 BC) ===`);
if (dropped.length) {
  console.log(`dropped ${dropped.length}:`);
  for (const d of dropped) console.log(`  ${d}`);
}

const byCartridge = [...new Set(entries.map((e) => e.cartridge))];
console.log(`\n--- cartridges (${byCartridge.length}) ---`);
for (const c of byCartridge) console.log(`  ${c}${catalogCartridges.has(c) ? "" : "  <- NEW to catalog"}`);

console.log(`\n--- entries ---`);
for (const e of entries)
  console.log(`  ${e.cartridge.padEnd(16)} ${String(e.grains).padStart(4)}gr  ${e.bullet.padEnd(48)} MV ${e.muzzleVelocity}  BC ${e.ballisticCoefficient}`);

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
writeFileSync(`${SCRATCH}/sig_entries.js`, lines.join("\n") + "\n");
console.log(`\nwrote ${entries.length} entries to sig_entries.js`);
