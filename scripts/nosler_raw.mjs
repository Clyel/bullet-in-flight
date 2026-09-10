// Harvests Nosler's loaded rifle-ammunition catalog from nosler.com (Magento,
// server-rendered — the storefront GraphQL endpoint is disabled, so this
// walks the ammo product-line category pages for URLs, then each product
// page for specs).
//
// Each product page carries:
//   - a "More Information" table: Manufacturer SKU, Cartridge, Bullet Type,
//     Bullet Weight, Test Barrel Length, Handgun Ammunition (Yes/No)
//   - a "VELOCITY (FPS)" table: muzzle + 100..800 yd, all published by Nosler
// Nosler publishes NO ballistic coefficient anywhere, so buildNosler.mjs
// back-calculates a G1 BC from the published muzzle + 500 yd velocities the
// same way the Hornady / Federal entries were done.
//
// Output: scratchpad/nosler_raw.json
import { writeFileSync } from "node:fs";

const UA = { headers: { "User-Agent": "Mozilla/5.0" } };
const BASE = "https://www.nosler.com";
const CATEGORIES = [
  "trophy-gradetm",
  "trophy-gradetm-long-range",
  "trophy-gradetm-safari",
  "match-gradetm",
  "ballistic-tipr-hunting",
  "ballistic-tipr-varmint",
  "expansion-tiptm",
  "noslercustom",
];
const SCRATCH =
  "C:/Users/YGACPA/AppData/Local/Temp/claude/C--Users-Public-OneDrive-Projects-Ballistics/af6ffc11-ac36-4a0f-bf2f-4cbb92c3359f/scratchpad";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getText(url) {
  for (let i = 0; i < 4; i++) {
    try {
      const r = await fetch(url, UA);
      if (r.ok) return r.text();
    } catch {
      /* retry */
    }
    await sleep(500 * (i + 1));
  }
  throw new Error(`giving up on ${url}`);
}

async function mapPool(items, size, fn) {
  const out = [];
  let i = 0;
  await Promise.all(
    Array.from({ length: size }, async () => {
      while (i < items.length) {
        const idx = i++;
        out[idx] = await fn(items[idx]);
        await sleep(150);
      }
    })
  );
  return out;
}

const isProductUrl = (u) =>
  /^https:\/\/www\.nosler\.com\/[a-z0-9-]+\.html$/.test(u) &&
  /-\d+gr-/.test(u) &&
  /-ammunition(-\d+)?\.html$/.test(u);

// 1. product URLs from every ammo category page
const urlSet = new Set();
for (const c of CATEGORIES) {
  const html = await getText(`${BASE}/products/ammunition/product-line/${c}.html?product_list_limit=all`);
  for (const m of html.matchAll(/href="(https:\/\/www\.nosler\.com\/[a-z0-9-]+\.html)"/g)) {
    if (isProductUrl(m[1])) urlSet.add(m[1]);
  }
  await sleep(200);
}
const urls = [...urlSet];
console.log(`${urls.length} product URLs`);

// 2. specs per product
const strip = (s) => s.replace(/<[^>]+>/g, "").replace(/&#x20;/g, " ").replace(/&quot;/g, '"').trim();
const attrOf = (html, label) => {
  const re = new RegExp(`data-th="${label.replace(/ /g, "&#x20;")}"[^>]*>([\\s\\S]*?)</td>`, "i");
  const m = html.match(re);
  return m ? strip(m[1]) : "";
};

const rows = await mapPool(urls, 6, async (url) => {
  const html = await getText(url);
  const name = strip((html.match(/<span[^>]*data-ui-id="page-title-wrapper"[^>]*>([\s\S]*?)<\/span>/i) || [])[1] || "");
  // The velocity table has two markup styles and runs to muzzle..600 or
  // muzzle..800 depending on the load. The data row is the first <tr> of
  // 5-9 numeric <td> after the "VELOCITY (FPS)" heading (the label row is
  // "Muzzle 100 … 800", which isn't all-numeric, so it doesn't match).
  // Column i is the (i*100) yd velocity, i=0 muzzle. The ENERGY table's
  // data row comes later; we take the first match.
  const afterHead = html.slice(html.indexOf("VELOCITY (FPS)"));
  const velRow = afterHead.match(/<tr>\s*((?:<td>\s*[\d,]+\s*<\/td>\s*){5,9})<\/tr>/);
  const vel = velRow
    ? [...velRow[1].matchAll(/<td>\s*([\d,]+)\s*<\/td>/g)].map((m) => +m[1].replace(/,/g, ""))
    : [];
  return {
    url,
    name,
    sku: attrOf(html, "Manufacturer SKU"),
    cartridge: attrOf(html, "Cartridge"),
    bulletType: attrOf(html, "Bullet Type"),
    weight: attrOf(html, "Bullet Weight"),
    testBarrel: attrOf(html, "Test Barrel Length"),
    handgun: attrOf(html, "Handgun Ammunition"),
    leadFree: attrOf(html, "Lead Free"),
    vel, // [muzzle,100,200,300,400,500,600,700,800]
  };
});

writeFileSync(`${SCRATCH}/nosler_raw.json`, JSON.stringify(rows, null, 1));
console.log(`wrote ${rows.length} rows`);
const noVel = rows.filter((r) => r.vel.length < 6);
const noSku = rows.filter((r) => !r.sku);
console.log(`no usable velocity row (< muzzle..500): ${noVel.length}`);
for (const r of noVel) console.log(`  ${r.url.split("/").pop()}`);
console.log(`no sku: ${noSku.length}`);
const weird = rows.filter(
  (r) => r.vel.length >= 6 && !(r.vel[0] >= r.vel[r.vel.length - 1] && r.vel[0] > 800 && r.vel[0] < 4600)
);
console.log(`suspect velocity row: ${weird.length}`);
for (const r of weird) console.log(`  ${r.sku} ${r.cartridge} ${r.weight}  ${r.vel.join(",")}`);
