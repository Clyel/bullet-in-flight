// Transforms scratchpad/norma_raw.json (from norma_raw.mjs) into
// commercialAmmo.js entries. Every Norma entry has a published G1 BC.
//
// Output: scratchpad/norma_entries.js
import { readFileSync, writeFileSync } from "node:fs";
import { COMMERCIAL_AMMO } from "../src/data/commercialAmmo.js";

const SCRATCH =
  "C:/Users/YGACPA/AppData/Local/Temp/claude/C--Users-Public-OneDrive-Projects-Ballistics/af6ffc11-ac36-4a0f-bf2f-4cbb92c3359f/scratchpad";

const raw = JSON.parse(readFileSync(`${SCRATCH}/norma_raw.json`, "utf8"));

// Norma's caliber names use decimal commas, spaced "x", trailing-dot
// abbreviations, and parenthetical notes. `tidy()` handles the mechanical
// cleanup; ALIASES then maps the tidied form to the catalog's spelling for
// the cartridges another manufacturer already uses. Obscure European rounds
// (Norma is the specialist — that's the point) keep their tidied name and
// become new caliber-dropdown entries.
function tidy(name) {
  return name
    .replace(/,/g, ".")
    .replace(/\s*\([^)]*\)/g, "")
    .replace(/\bSpring\.$/, "Springfield")
    .replace(/\bN\.?\s*E\.?(?=\s|$)/g, "Nitro Express")
    .replace(/\b(\d)"/g, "$1in")
    .replace(/\.(?=\s|$)/g, "")          // trailing dots on abbreviations
    .replace(/(\d)\s*x\s*(\d)/g, "$1x$2")
    .replace(/\bWeath\s*Mag\b/, "Wby Mag")
    .replace(/\s+/g, " ")
    .trim();
}

const ALIASES = {
  "30-06 Springfield": "30-06 Springfield",
  "7 mm - 08 Rem": "7mm-08 Rem",
  "7 mm Rem Mag": "7mm Rem Mag",
  "7 mm Wby Mag": "7mm Wby Mag",
  "6 mm Creedmoor": "6mm Creedmoor",
  "6.5 - 284 Norma": "6.5-284 Norma",
  "6.5x55 SE": "6.5x55 Swedish",
  "300 RUM": "300 Rem Ultra Mag",
  "300 SAUM": "300 Remington SA Ultra Mag",
  "270 Wby Mag": "270 WBY MAG",
  "7x64": "7x64 Brenneke",
  "7x57": "7mm Mauser (7x57)",
  "8x57 IS": "8x57",
  "9.3x62": "9.3x62 Mauser",
  "9.3x74 R": "9.3x74R",
  "500 Nitro Express 3in": "500 Nitro Express 3in",
  "17 Rem": "17 Remington",
};

function normalizeCartridge(name) {
  const n = tidy(name);
  return ALIASES[n] || n;
}

const bulletLabel = (line, desc) => {
  const l = (line || "").replace(/^Norma\s+/, "").trim();
  const d = (desc || "").trim();
  if (!l) return d;
  if (!d) return l;
  return `${l} — ${d}`;
};

const seen = new Set();
const entries = [];
const dropped = [];
let fixedBc = 0;

for (const r of raw) {
  const sku = String(r.sku || r._id.replace(/^product-/, ""));
  const grains = Number(r.grains);
  const mv = Math.round(parseFloat(r.mv));
  // A few docs store the BC as an integer (428 => 0.428).
  let bc = Number(r.bc);
  if (bc > 2) {
    bc = bc / 1000;
    fixedBc++;
  }
  const label = `${sku}  ${r.caliber} ${r.productLine} ${grains}gr`;
  if (!/^\d{7,10}$/.test(sku)) {
    // Norma article numbers are 8 digits; anything else is a stray/test
    // record in the CMS (e.g. "Hoy Oryx", sku "20174762123456").
    dropped.push(`${label}  (malformed article number "${sku}")`);
    continue;
  }
  if (!(bc > 0.05 && bc < 1.2) || !(mv > 0) || !(grains > 0)) {
    dropped.push(`${label}  (bc=${r.bc} mv=${r.mv} g=${r.grains})`);
    continue;
  }
  if (seen.has(sku)) continue;
  seen.add(sku);

  entries.push({
    id: `norma-${sku}`,
    cartridge: normalizeCartridge(r.caliber),
    bullet: bulletLabel(r.productLine, r.bullet),
    grains,
    muzzleVelocity: mv,
    ballisticCoefficient: Math.round(bc * 1000) / 1000,
    dragModel: "G1",
    manufacturer: "Norma",
    bcSource: "published",
  });
}

// --- reports -----------------------------------------------------------------

const catalogCartridges = new Set(COMMERCIAL_AMMO.map((a) => a.cartridge));
const byCartridge = {};
for (const r of raw) {
  const norm = normalizeCartridge(r.caliber);
  (byCartridge[norm] ??= { raw: r.caliber, known: catalogCartridges.has(norm) });
}
const known = Object.entries(byCartridge).filter(([, v]) => v.known);
const novel = Object.entries(byCartridge).filter(([, v]) => !v.known);

console.log(`\n=== ${entries.length} Norma entries (all published G1 BC) ===`);
console.log(`fixed ${fixedBc} integer-BC value(s) (÷1000)`);
console.log(`dropped ${dropped.length}:`);
for (const d of dropped) console.log(`  ${d}`);

console.log(`\n--- cartridges matching an existing catalog name (${known.length}) ---`);
for (const [norm, v] of known) console.log(`  ${v.raw.padEnd(26)} -> ${norm}`);
console.log(`\n--- NEW cartridges (${novel.length}) — mostly obscure European, expected ---`);
for (const [norm, v] of novel) console.log(`  ${v.raw.padEnd(26)} -> ${norm}`);

const collisions = {};
for (const e of entries) {
  const k = `${e.cartridge} | ${e.grains}gr | ${e.bullet}`;
  (collisions[k] ??= []).push(e);
}
const dup = Object.entries(collisions).filter(([, a]) => a.length > 1);
if (dup.length) {
  console.log(`\n--- identical cartridge+grains+bullet (${dup.length}) — picker disambiguates by MV ---`);
  for (const [k, a] of dup) console.log(`  ${k}  (${a.map((e) => `${e.id}@${e.muzzleVelocity}`).join(", ")})`);
}

// near-duplicate cartridge check against the full catalog + these
const allCarts = new Set([...catalogCartridges, ...entries.map((e) => e.cartridge)]);
const nkey = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const groups = {};
for (const c of allCarts) (groups[nkey(c)] ??= []).push(c);
const nearDup = Object.values(groups).filter((g) => g.length > 1);
if (nearDup.length) {
  console.log(`\n--- possible near-duplicate cartridge strings ---`);
  for (const g of nearDup) console.log(`  ${JSON.stringify(g)}`);
}

const lines = entries.map(
  (o) =>
    `  { id: "${o.id}", cartridge: "${o.cartridge}", bullet: "${o.bullet}", grains: ${o.grains}, muzzleVelocity: ${o.muzzleVelocity}, ballisticCoefficient: ${o.ballisticCoefficient}, dragModel: "${o.dragModel}", manufacturer: "${o.manufacturer}", bcSource: "${o.bcSource}" },`
);
writeFileSync(`${SCRATCH}/norma_entries.js`, lines.join("\n") + "\n");
console.log(`\nwrote ${entries.length} entries to norma_entries.js`);
