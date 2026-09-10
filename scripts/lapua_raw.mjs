// Harvests Lapua's factory-loaded rifle cartridges from the WooCommerce
// Store API behind lapua.com (WordPress + Woo, /wp-json public).
//
// Every product's `attributes` carry the full spec as WooCommerce product
// attributes: pa_caliber, pa_bullet, pa_bullet-type, pa_bullet-weight,
// pa_muzzle-velocity ("850 m/s (2790 fps)"), pa_bc-g1, pa_bc-g7,
// pa_product-no. Lapua's component bullets are in the same catalog but have
// no muzzle velocity, so filtering on a real MV isolates the loaded ammo.
//
// Output: scratchpad/lapua_raw.json
import { writeFileSync } from "node:fs";

const STORE = "https://www.lapua.com/wp-json/wc/store/products";
const UA = { headers: { "User-Agent": "Mozilla/5.0" } };
const SCRATCH =
  "C:/Users/YGACPA/AppData/Local/Temp/claude/C--Users-Public-OneDrive-Projects-Ballistics/af6ffc11-ac36-4a0f-bf2f-4cbb92c3359f/scratchpad";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let products = [];
for (let page = 1; page <= 6; page++) {
  const batch = await fetch(`${STORE}?per_page=100&page=${page}`, UA).then((r) => r.json());
  if (!Array.isArray(batch) || batch.length === 0) break;
  products = products.concat(batch);
  if (batch.length < 100) break;
  await sleep(200);
}
console.log(`${products.length} products total`);

const attr = (p, tax) =>
  (p.attributes || []).find((a) => a.taxonomy === tax)?.terms?.[0]?.name ?? "";

const rows = products
  .map((p) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    productNo: attr(p, "pa_product-no"),
    caliber: attr(p, "pa_caliber"),
    bullet: attr(p, "pa_bullet"),
    bulletType: attr(p, "pa_bullet-type"),
    weight: attr(p, "pa_bullet-weight"),
    mv: attr(p, "pa_muzzle-velocity"),
    bcG1: attr(p, "pa_bc-g1"),
    bcG7: attr(p, "pa_bc-g7"),
    purpose: attr(p, "pa_purpose"),
  }))
  // loaded rifle cartridges: real caliber, a stated muzzle velocity, at
  // least one BC, and not a .22 LR rimfire / pistol load
  .filter(
    (r) =>
      r.caliber &&
      r.weight &&
      r.mv &&
      (r.bcG1 || r.bcG7) &&
      !/22 ?LR|Rimfire|Pistol King|OSP/i.test(r.caliber + r.name)
  );

writeFileSync(`${SCRATCH}/lapua_raw.json`, JSON.stringify(rows, null, 1));
console.log(`${rows.length} loaded rifle cartridges`);
console.log(`  with G7: ${rows.filter((r) => r.bcG7 && r.bcG7 !== "-").length}`);
console.log(`  G1 only: ${rows.filter((r) => (!r.bcG7 || r.bcG7 === "-") && r.bcG1).length}`);
console.log(`  calibers: ${[...new Set(rows.map((r) => r.caliber))].length}`);
