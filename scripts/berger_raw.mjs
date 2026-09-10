// Harvests Berger's loaded-ammunition catalog from the WooCommerce Store API
// that backs bergerbullets.com (first-party, unauthenticated).
//
//   /wp-json/wc/store/products?per_page=100&page=N   -> all products
//   filter to category id 979 ("Rifle Ammunition")   -> the 38 loaded loads
//   each product's `attributes` carry: 20ct Part # (SKU), Cartridge,
//   Bullet Weight, Product Line, G1 BC, G7 BC, and (most but not all)
//   Muzzle Velocity (fps).
//
// Berger is the catalog's first source that publishes a real G7 BC (measured
// by Doppler radar, averaged 3000->1500 fps) — buildBerger.mjs stores the G7
// value with dragModel "G7". For the loads whose API attributes omit muzzle
// velocity, this also pulls the product page and reads the "Muzzle" row of
// its on-page ballistics table; a few Classic Hunter loads state no velocity
// anywhere and get dropped by buildBerger.mjs.
//
// Output: scratchpad/berger_raw.json
import { writeFileSync } from "node:fs";

const STORE = "https://bergerbullets.com/wp-json/wc/store/products";
const AMMO_CATEGORY_ID = 979;
const UA = { "User-Agent": "Mozilla/5.0" };
const SCRATCH =
  "C:/Users/YGACPA/AppData/Local/Temp/claude/C--Users-Public-OneDrive-Projects-Ballistics/af6ffc11-ac36-4a0f-bf2f-4cbb92c3359f/scratchpad";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(url) {
  for (let i = 0; i < 4; i++) {
    try {
      const r = await fetch(url, { headers: UA });
      if (r.ok) return r.json();
    } catch {
      /* retry */
    }
    await sleep(500 * (i + 1));
  }
  throw new Error(`giving up on ${url}`);
}

let products = [];
for (let page = 1; page <= 6; page++) {
  const batch = await getJson(`${STORE}?per_page=100&page=${page}`);
  if (!Array.isArray(batch) || batch.length === 0) break;
  products = products.concat(batch);
  if (batch.length < 100) break;
  await sleep(200);
}

const ammo = products.filter((p) =>
  (p.categories || []).some((c) => c.id === AMMO_CATEGORY_ID)
);
console.log(`${products.length} products, ${ammo.length} in Rifle Ammunition`);

const attr = (p, name) =>
  (p.attributes || []).find((a) => a.name === name)?.terms?.[0]?.name ?? "";

const rows = [];
for (const p of ammo) {
  let mv = attr(p, "Muzzle Velocity (fps)");
  if (!mv) {
    // fall back to the "Muzzle" row of the product page's ballistics table
    try {
      const html = await fetch(p.permalink, { headers: UA }).then((r) => r.text());
      mv =
        (html.match(/attribute_pa_muzzle-velocity[\s\S]{0,200}?__value">\s*<p>\s*([\d,]+)/) || [])[1] ||
        (html.match(/>\s*Muzzle\s*<\/td>\s*<td>\s*([\d,]+)\s*<\/td>/) || [])[1] ||
        "";
      await sleep(200);
    } catch {
      /* leave mv blank */
    }
  }
  rows.push({
    name: p.name,
    permalink: p.permalink,
    sku: attr(p, "20ct Part #") || p.sku,
    cartridge: attr(p, "Cartridge"),
    weight: attr(p, "Bullet Weight"),
    line: attr(p, "Product Line"),
    g1bc: attr(p, "G1 BC"),
    g7bc: attr(p, "G7 BC"),
    mv: String(mv).replace(/,/g, ""),
  });
}

writeFileSync(`${SCRATCH}/berger_raw.json`, JSON.stringify(rows, null, 1));
console.log(`wrote ${rows.length} rows`);
const noMV = rows.filter((r) => !r.mv);
const noG7 = rows.filter((r) => !r.g7bc);
console.log(`missing MV: ${noMV.length}`, noMV.map((r) => r.name));
console.log(`missing G7: ${noG7.length}`, noG7.map((r) => r.name));
