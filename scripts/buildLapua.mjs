// Transforms scratchpad/lapua_raw.json (from lapua_raw.mjs) into
// commercialAmmo.js entries.
//
// Lapua publishes both G1 and G7 for its match bullets. Where a real G7 is
// given (Scenar, Scenar-L, Lock Base, TRX, MaxRange, AP/API, FMJ BT), the
// entry carries dragModel "G7" and the G7 value — same as Berger. The
// hunting bullets (Naturalis, Mega, plain SP/FMJ) only get a G1, so those
// stay dragModel "G1". bcSource "published" throughout.
//
// Output: scratchpad/lapua_entries.js
import { readFileSync, writeFileSync } from "node:fs";
import { COMMERCIAL_AMMO } from "../src/data/commercialAmmo.js";

const SCRATCH =
  "C:/Users/YGACPA/AppData/Local/Temp/claude/C--Users-Public-OneDrive-Projects-Ballistics/af6ffc11-ac36-4a0f-bf2f-4cbb92c3359f/scratchpad";

const raw = JSON.parse(readFileSync(`${SCRATCH}/lapua_raw.json`, "utf8"));

const CARTRIDGE_ALIASES = {
  ".222 Rem.": "222 Rem",
  ".223 Rem.": "223 Rem",
  ".243 Win.": "243 Win",
  ".260 Rem.": "260 Rem",
  ".30-06 Springfield": "30-06 Springfield",
  ".300 Win Mag.": "300 Win Mag",
  ".308 Win.": "308 Win",
  ".338 Lapua Mag.": "338 Lapua Mag",
  "6 mm B.R. Norma": "6mm BR Norma",
  "6.5 Creedmoor": "6.5 Creedmoor",
  "6.5x55 Swedish": "6.5x55 Swedish",
  "7x64": "7x64 Brenneke",
  "7x65R": "7x65 R",
  "8x57 IS": "8x57",
  "8x57 IRS": "8x57 IRS",
  "9.3x62": "9.3x62 Mauser",
};
const normalizeCartridge = (name) => CARTRIDGE_ALIASES[name] || name.replace(/^\./, "").trim();

// "850 m/s (2790 fps)" or "765 m/s / 2510 fps" -> 2790
const fpsOf = (s) => {
  const m = String(s).match(/\(?\s*(\d[\d,]*)\s*fps/);
  return m ? Math.round(+m[1].replace(/,/g, "")) : NaN;
};
// "8.0 g (123 gr)" -> 123
const grainsOf = (s) => {
  const m = String(s).match(/\(?\s*(\d[\d.]*)\s*gr/);
  return m ? Math.round(+m[1]) : NaN;
};
const num = (s) => {
  const n = parseFloat(String(s).replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
};

function bulletLabel(r) {
  const b = (r.bullet || "").trim();
  const t = (r.bulletType || "").trim().replace(/\s*\(FMJ\)$/, "");
  if (b && t && b.toLowerCase() !== t.toLowerCase() && !t.toLowerCase().includes(b.toLowerCase()))
    return `${b} — ${t}`;
  return b || t;
}

const seen = new Set();
const entries = [];
const dropped = [];

for (const r of raw) {
  const grains = grainsOf(r.weight);
  const mv = fpsOf(r.mv);
  const g7 = num(r.bcG7);
  const g1 = num(r.bcG1);
  const useG7 = Number.isFinite(g7) && g7 > 0;
  const bc = useG7 ? g7 : g1;
  const dragModel = useG7 ? "G7" : "G1";

  const sku = (r.productNo || String(r.id)).replace(/\s+/g, "");
  const label = `${sku}  ${r.caliber} ${r.weight} ${r.bullet || r.bulletType}`;
  if (!(bc > 0.05 && bc < 1.2) || !(mv > 0) || !(grains > 0)) {
    dropped.push(`${label}  (mv=${r.mv} g1=${r.bcG1} g7=${r.bcG7} wt=${r.weight})`);
    continue;
  }
  if (seen.has(sku)) continue;
  seen.add(sku);

  entries.push({
    id: `lapua-${sku}`,
    cartridge: normalizeCartridge(r.caliber),
    bullet: bulletLabel(r),
    grains,
    muzzleVelocity: mv,
    ballisticCoefficient: bc,
    dragModel,
    manufacturer: "Lapua",
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
console.log(`\n=== ${entries.length} Lapua entries (${entries.filter((e) => e.dragModel === "G7").length} G7, ${entries.filter((e) => e.dragModel === "G1").length} G1) ===`);
console.log(`dropped ${dropped.length}:`);
for (const d of dropped) console.log(`  ${d}`);

console.log(`\n--- cartridges matching an existing catalog name (${Object.values(byCartridge).filter((v) => v.known).length}) ---`);
for (const [norm, v] of Object.entries(byCartridge).filter(([, v]) => v.known)) console.log(`  ${v.raw.padEnd(22)} -> ${norm}`);
const novel = Object.entries(byCartridge).filter(([, v]) => !v.known);
console.log(`\n--- NEW cartridges (${novel.length}) ---`);
for (const [norm, v] of novel) console.log(`  ${v.raw.padEnd(22)} -> ${norm}`);

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

console.log(`\n--- entries ---`);
for (const e of entries)
  console.log(`  ${e.cartridge.padEnd(16)} ${String(e.grains).padStart(4)}gr  ${e.bullet.padEnd(26)} MV ${e.muzzleVelocity}  ${e.dragModel} ${e.ballisticCoefficient}`);

const lines = entries.map(
  (o) =>
    `  { id: "${o.id}", cartridge: "${o.cartridge}", bullet: "${o.bullet}", grains: ${o.grains}, muzzleVelocity: ${o.muzzleVelocity}, ballisticCoefficient: ${o.ballisticCoefficient}, dragModel: "${o.dragModel}", manufacturer: "${o.manufacturer}", bcSource: "${o.bcSource}" },`
);
writeFileSync(`${SCRATCH}/lapua_entries.js`, lines.join("\n") + "\n");
console.log(`\nwrote ${entries.length} entries to lapua_entries.js`);
