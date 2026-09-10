// Harvests Winchester's centerfire-rifle catalog from the public JSON API
// that backs their ballistics calculator (ballisticscalculator.winchester.com
// -> wdm2.azurewebsites.net/api/bc/v3). First-party, unauthenticated, serves
// the same numbers as their per-product pages. No BC fitting here -- this
// just dumps the raw responses; buildWinchester.mjs does the transform.
//
//   BulletDropdown/Gun/1
//     -> 66 cartridges, each { id, name, subBrands[ { id, name,
//        ammoTypes[ { id, name, weights[ { weight } ] } ] } ] }
//   Ammo/Gun/1/Cartridges/{cid}/Brand/{bid}/AmmoTypes/{tid}/Weight/{w}
//     -> { ammo_ID, symbol, name, weight, muzzleVelocity, ballisticCoefficient, ... }
//   Trajectory/Symbol/{ammo_ID}/SightInRange/100/TargetRange/500/Crosswind/0
//     /Temperature/59/SightHeight/1.5/Elevation/0
//     -> { points[ { distance, rangeVelocity, ... } ] }  (elevation 0 => ~29.92 inHg)
//
// Output: scratchpad/winchester_raw.json — an array of
//   { cartridge, subBrand, ammoType, symbol, ammoId, weight, muzzleVelocity,
//     ballisticCoefficient, v500 }   (v500 present only when BC was missing)
import { writeFileSync } from "node:fs";

const BASE = "https://wdm2.azurewebsites.net/api/bc/v3/";
const GUN_CENTERFIRE_RIFLE = 1;
const SCRATCH =
  "C:/Users/YGACPA/AppData/Local/Temp/claude/C--Users-Public-OneDrive-Projects-Ballistics/af6ffc11-ac36-4a0f-bf2f-4cbb92c3359f/scratchpad";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(path) {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(BASE + path);
      if (res.ok) return res.json();
      if (res.status === 404) return null;
    } catch {
      /* retry */
    }
    await sleep(400 * (attempt + 1));
  }
  throw new Error(`giving up on ${path}`);
}

// A small worker pool so we're not hammering the API but the ~260 leaf
// fetches don't take forever either.
async function mapPool(items, size, fn) {
  const out = [];
  let i = 0;
  await Promise.all(
    Array.from({ length: size }, async () => {
      while (i < items.length) {
        const idx = i++;
        out[idx] = await fn(items[idx], idx);
        await sleep(120);
      }
    })
  );
  return out;
}

const tree = (await getJson(`BulletDropdown/Gun/${GUN_CENTERFIRE_RIFLE}`)).data;

const tuples = [];
for (const cartridge of tree)
  for (const subBrand of cartridge.subBrands)
    for (const ammoType of subBrand.ammoTypes)
      for (const w of ammoType.weights)
        tuples.push({
          cid: cartridge.id,
          cartridge: cartridge.name,
          bid: subBrand.id,
          subBrand: subBrand.name.trim(),
          tid: ammoType.id,
          ammoType: ammoType.name.trim(),
          weight: w.weight,
        });

console.log(`${tree.length} cartridges, ${tuples.length} load tuples`);

const rows = await mapPool(tuples, 6, async (t) => {
  const j = await getJson(
    `Ammo/Gun/${GUN_CENTERFIRE_RIFLE}/Cartridges/${t.cid}/Brand/${t.bid}/AmmoTypes/${t.tid}/Weight/${t.weight}`
  );
  if (!j?.data) return { ...t, _missing: true };
  const d = j.data;
  return {
    cartridge: t.cartridge,
    subBrand: t.subBrand,
    ammoType: d.name?.trim() || t.ammoType,
    symbol: d.symbol,
    ammoId: d.ammo_ID,
    weight: d.weight,
    muzzleVelocity: d.muzzleVelocity,
    ballisticCoefficient: d.ballisticCoefficient,
  };
});

const ok = rows.filter((r) => !r._missing);
const missing = rows.filter((r) => r._missing);

// For loads with a real muzzle velocity but no published BC, pull Winchester's
// own computed 500 yd velocity so buildWinchester.mjs can back-calculate a G1
// BC (elevation 0 => sea level, 59 F => ~29.92 inHg, matching the app defaults).
const needV500 = ok.filter(
  (r) => parseFloat(r.muzzleVelocity) > 0 && !(r.ballisticCoefficient > 0)
);
console.log(`${ok.length} loads; ${needV500.length} need a derived BC`);

for (const r of needV500) {
  const j = await getJson(
    `Trajectory/Symbol/${r.ammoId}/SightInRange/100/TargetRange/500/Crosswind/0/Temperature/59/SightHeight/1.5/Elevation/0`
  );
  const p500 = j?.data?.points?.find((p) => p.distance === 500);
  r.v500 = p500 ? Math.round(p500.rangeVelocity) : null;
  await sleep(150);
}

writeFileSync(`${SCRATCH}/winchester_raw.json`, JSON.stringify(ok, null, 1));
console.log(`wrote ${ok.length} rows to winchester_raw.json`);
if (missing.length) {
  console.log(`\n${missing.length} tuples returned no data:`);
  for (const m of missing) console.log(`  ${m.cartridge} / ${m.subBrand} / ${m.ammoType} / ${m.weight}gr`);
}
