// Transforms scratchpad/nosler_raw.json (from nosler_raw.mjs) into
// commercialAmmo.js entries.
//
// Nosler publishes muzzle + downrange velocities but NO ballistic
// coefficient anywhere, so every entry's BC is back-calculated from
// Nosler's own published muzzle + 500 yd velocities against this app's
// solver/drag-table physics (scripts/deriveBC.mjs) — the same technique as
// the Hornady and Federal entries. bcSource "derived-nosler". Fit checked
// against the 300 / 400 / 600 yd velocities Nosler also publishes.
//
// Nosler states no test atmosphere, so 59 F / 29.92 inHg (the app default,
// same as Hornady).
//
// Output: scratchpad/nosler_entries.js
import { readFileSync, writeFileSync } from "node:fs";
import { deriveBC, fitResidualRMS } from "./deriveBC.mjs";
import { COMMERCIAL_AMMO } from "../src/data/commercialAmmo.js";

const SCRATCH =
  "C:/Users/YGACPA/AppData/Local/Temp/claude/C--Users-Public-OneDrive-Projects-Ballistics/af6ffc11-ac36-4a0f-bf2f-4cbb92c3359f/scratchpad";
const TEMP_F = 59;
const PRESS_INHG = 29.92;

const raw = JSON.parse(readFileSync(`${SCRATCH}/nosler_raw.json`, "utf8"));

const CARTRIDGE_ALIASES = {
  "300 Rem SA Ultra Mag": "300 Remington SA Ultra Mag",
  "7mm Rem SA Ultra Mag": "7mm Remington SA Ultra Mag",
  "300 Remington Ultra Magnum": "300 Rem Ultra Mag",
  "7mm Remington Ultra Magnum": "7mm Remington Ultra Mag",
  "7mm Shooting Times Westerner": "7mm STW",
  "6.8mm Remington SPC": "6.8 SPC",
  "7.62x39mm": "7.62x39mm Soviet",
  "7x57 Mauser": "7mm Mauser (7x57)",
  "8x57 JS Mauser": "8x57",
  "9.3x62": "9.3x62 Mauser",
  "270 Weatherby Magnum": "270 WBY MAG",
};

// Bullet diameter (inches) by normalized cartridge — used only to sanity-
// check a derived BC via its implied G1 form factor. Nosler's velocity
// tables for a handful of big-bore and subsonic loads show far too little
// velocity loss, which fits to a physically impossible BC (a 9.3x62 250gr
// deriving to 1.0, a subsonic .308 220gr to 0.70); those get dropped.
const DIAMETER = {
  "204 Ruger": 0.204,
  "22 Nosler": 0.224, "22 Creedmoor": 0.224, "22-250 Rem": 0.224, "223 Rem": 0.224, "222 Rem": 0.224, "221 Rem Fireball": 0.224,
  "243 Win": 0.243, "6mm Creedmoor": 0.243,
  "25-06 Rem": 0.257, "257 Roberts +P": 0.257, "257 Wby Mag": 0.257,
  "260 Rem": 0.264, "264 Win Mag": 0.264, "26 Nosler": 0.264, "6.5 Creedmoor": 0.264, "6.5 PRC": 0.264, "6.5 Grendel": 0.264, "6.5x55 Swedish": 0.264, "6.5-284 Norma": 0.264,
  "270 Win": 0.277, "270 WSM": 0.277, "270 WBY MAG": 0.277, "27 Nosler": 0.277,
  "7mm-08 Rem": 0.284, "280 Rem": 0.284, "280 Ackley Improved": 0.284, "7mm Mauser (7x57)": 0.284,
  "7mm Rem Mag": 0.284, "7mm PRC": 0.284, "7mm STW": 0.284, "7mm Remington Ultra Mag": 0.284,
  "7mm Remington SA Ultra Mag": 0.284, "28 Nosler": 0.284,
  "30-30 Win": 0.308, "30-06 Springfield": 0.308, "308 Win": 0.308, "300 AAC Blackout": 0.308,
  "300 Win Mag": 0.308, "300 WSM": 0.308, "300 H&H Mag": 0.308, "300 Wby Mag": 0.308,
  "300 Rem Ultra Mag": 0.308, "300 Remington SA Ultra Mag": 0.308, "30-378 Wby Mag": 0.308,
  "30 Nosler": 0.308, "325 WSM": 0.323, "8x57": 0.323, "8mm Rem Mag": 0.323,
  "33 Nosler": 0.338, "338 Win Mag": 0.338, "338 Lapua Mag": 0.338,
  "35 Whelen": 0.358, "9.3x62 Mauser": 0.366,
  "375 H&H Mag": 0.375, "416 Rem Mag": 0.416, "470 Nitro Express": 0.475,
  "6.8 SPC": 0.277, "7.62x39mm Soviet": 0.311,
};
// Below these implied G1 form factors, a derived BC isn't physically real.
// The sleekest match bullets (Nosler RDF) reach ~0.42; nothing does better.
// Big-bore hunting bullets (.35 cal and up — Partition, AccuBond, Solid)
// are blunt and never get below ~0.55, so a lower number there means the
// published table is wrong (several of Nosler's big-bore tables are).
const MIN_FORM_FACTOR = 0.42;
const MIN_FORM_FACTOR_BIGBORE = 0.55;
const BIGBORE_DIA = 0.35;

function normalizeCartridge(name) {
  if (CARTRIDGE_ALIASES[name]) return CARTRIDGE_ALIASES[name];
  return name
    .replace(/\bWinchester Short Magnum\b/, "WSM")
    .replace(/\bRemington Ultra Magnum\b/, "Rem Ultra Mag")
    .replace(/\bWinchester Magnum\b/, "Win Mag")
    .replace(/\bWeatherby Magnum\b/, "Wby Mag")
    .replace(/\bH&H Magnum\b/, "H&H Mag")
    .replace(/\bLapua Magnum\b/, "Lapua Mag")
    .replace(/\bRemington Magnum\b/, "Rem Mag")
    .replace(/\bRemington\b/, "Rem")
    .replace(/\bWinchester\b/, "Win")
    .trim();
}

const seen = new Set();
const entries = [];
const dropped = [];
const highResiduals = [];

for (const r of raw) {
  const grains = parseFloat(r.weight);
  const mv = r.vel[0];
  const label = `${r.sku}  ${r.cartridge} ${r.weight} ${r.bulletType}`;
  if (!(r.vel.length >= 6) || !(mv > 0) || !(grains > 0) || !r.sku) {
    dropped.push(`${label}  (no usable velocity table / SKU)`);
    continue;
  }
  if (mv < 1350) {
    // A subsonic load — the G1 model is unreliable through the transonic
    // regime, so a two-point BC fit here can't be trusted. (The catalog's
    // other subsonic entries carry a *published* BC, not a derived one.)
    dropped.push(`${label}  (subsonic — BC fit not trustworthy)`);
    continue;
  }
  if (seen.has(r.sku)) continue;
  seen.add(r.sku);

  // Fit against the 500 yd point (index 5 — every usable table reaches it),
  // then check the fit against the other published points.
  const v500 = r.vel[5];
  let bc;
  try {
    bc = deriveBC(mv, "G1", TEMP_F, PRESS_INHG, 500, v500);
  } catch (e) {
    dropped.push(`${label}  (BC fit failed: ${e.message})`);
    continue;
  }
  const checkPoints = [[300, r.vel[3]], [400, r.vel[4]], [600, r.vel[6]]].filter(
    ([, v]) => v > 400 && v < 5000
  );
  const rms = fitResidualRMS(mv, bc, "G1", TEMP_F, PRESS_INHG, [[500, v500], ...checkPoints]);
  bc = Math.round(bc * 1000) / 1000;

  // Trust guards: an inconsistent published table (high RMS), or one so
  // flat it fits to an impossible BC (form factor below what any real
  // bullet achieves), means the derived number can't be trusted.
  const norm = normalizeCartridge(r.cartridge);
  const dia = DIAMETER[norm];
  const formFactor = dia ? (grains / 7000 / (dia * dia)) / bc : null;
  if (rms > 8) {
    dropped.push(`${label}  (published table inconsistent — fit RMS ${rms.toFixed(0)} fps)`);
    continue;
  }
  const floor = dia >= BIGBORE_DIA ? MIN_FORM_FACTOR_BIGBORE : MIN_FORM_FACTOR;
  if (formFactor != null && formFactor < floor) {
    dropped.push(`${label}  (table too flat — implied BC ${bc} = form factor ${formFactor.toFixed(2)})`);
    continue;
  }
  if (dia == null) highResiduals.push(`${label}  (no diameter on file — BC ${bc}, rms ${rms.toFixed(0)}, kept)`);

  entries.push({
    id: `nosler-${r.sku}`,
    cartridge: normalizeCartridge(r.cartridge),
    bullet: r.bulletType,
    grains,
    muzzleVelocity: mv,
    ballisticCoefficient: bc,
    dragModel: "G1",
    manufacturer: "Nosler",
    bcSource: "derived-nosler",
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

console.log(`\n=== ${entries.length} Nosler entries (all derived-nosler G1 BC) ===`);
console.log(`dropped ${dropped.length}:`);
for (const d of dropped) console.log(`  ${d}`);
if (highResiduals.length) {
  console.log(`\nkept but flagged:`);
  for (const h of highResiduals) console.log(`  ${h}`);
}

console.log(`\n--- cartridges matching an existing catalog name (${known.length}) ---`);
for (const [norm, v] of known) console.log(`  ${v.raw.padEnd(30)} -> ${norm}`);
console.log(`\n--- NEW cartridges (${novel.length}) — REVIEW ---`);
for (const [norm, v] of novel) console.log(`  ${v.raw.padEnd(30)} -> ${norm}`);

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

// BC spot-check: derived vs a few well-known Nosler bullet BCs
const spot = {
  "nosler-60155": ["28 Nosler 175 ABLR", 0.648], // Nosler 7mm 175 ABLR published G1
  "nosler-61046": ["243 Win 100 Partition", 0.384],
};
console.log(`\n--- BC spot-check vs Nosler's published bullet BC ---`);
for (const [id, [desc, pub]] of Object.entries(spot)) {
  const e = entries.find((x) => x.id === id);
  if (e) console.log(`  ${desc}: derived ${e.ballisticCoefficient}  vs published ~${pub}`);
}

const lines = entries.map(
  (o) =>
    `  { id: "${o.id}", cartridge: "${o.cartridge}", bullet: "${o.bullet}", grains: ${o.grains}, muzzleVelocity: ${o.muzzleVelocity}, ballisticCoefficient: ${o.ballisticCoefficient}, dragModel: "${o.dragModel}", manufacturer: "${o.manufacturer}", bcSource: "${o.bcSource}" },`
);
writeFileSync(`${SCRATCH}/nosler_entries.js`, lines.join("\n") + "\n");
console.log(`\nwrote ${entries.length} entries to nosler_entries.js`);
