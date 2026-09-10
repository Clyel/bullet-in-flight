// Harvests Browning's centerfire-rifle ammunition from browningammo.com.
//
// Browning Ammunition is an Olin/Winchester brand and runs the same
// platform: the rifle category page is server-rendered with the product
// URLs, each product page carries the internal symbol id in
// `data-id="…"`, and `wdm2.azurewebsites.net/api/v1/symbol/{id}` returns
// the full spec (published G1 BC, cartridge, weight, bullet type, product
// line, and the muzzle velocity in velocitys.us.data).
//
// Output: scratchpad/browning_raw.json
import { writeFileSync } from "node:fs";

const UA = { headers: { "User-Agent": "Mozilla/5.0" } };
const CAT = "https://browningammo.com/Products/Ammunition/Rifle";
const API = "https://wdm2.azurewebsites.net/api/v1/symbol/";
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
async function getJson(url) {
  const t = await getText(url);
  return JSON.parse(t);
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

// 1. product URLs from the rifle category page
const catHtml = await getText(CAT);
const paths = [
  ...new Set(
    [...catHtml.matchAll(/\/Products\/Ammunition\/Rifle\/[A-Za-z0-9-]+\/(B192\d{6})/g)].map((m) => m[0])
  ),
];
console.log(`${paths.length} product URLs`);

// 2. each product page -> internal symbol id -> the v1 API spec
const rows = await mapPool(paths, 5, async (path) => {
  const html = await getText(`https://browningammo.com${path}`);
  const id = (html.match(/j-symbol-ballistics"\s+data-id="(\d+)"/) || [])[1];
  if (!id) return { path, _noId: true };
  const j = await getJson(`${API}${id}`);
  const d = j.data || {};
  const mv = d.velocitys?.us?.data?.find((x) => x.distance === "muzzle")?.value ?? "";
  return {
    path,
    symbolId: id,
    sku: d.name,
    cartridge: d.cartridge?.name ?? "",
    weight: d.weight ?? "",
    bulletType: d.bulletType?.name ?? "",
    feature: d.feature?.name ?? "",
    subBrand: d.subBrand?.name ?? "",
    gun: d.gun?.name ?? "",
    bc: d.ballisticCoefficient ?? "",
    mv: String(mv).replace(/,/g, ""),
    isLeadFree: d.isLeadFree ?? null,
  };
});

const ok = rows.filter((r) => !r._noId && /rifle/i.test(r.gun));
writeFileSync(`${SCRATCH}/browning_raw.json`, JSON.stringify(ok, null, 1));
console.log(`wrote ${ok.length} rows`);

const noId = rows.filter((r) => r._noId);
const noBc = ok.filter((r) => !(parseFloat(r.bc) > 0));
const noMv = ok.filter((r) => !(parseFloat(r.mv) > 0));
if (noId.length) console.log(`no symbol id: ${noId.length}`, noId.map((r) => r.path));
console.log(`no BC: ${noBc.length}`, noBc.map((r) => `${r.sku} ${r.cartridge}`));
console.log(`no MV: ${noMv.length}`, noMv.map((r) => `${r.sku} ${r.cartridge}`));
console.log(`cartridges: ${[...new Set(ok.map((r) => r.cartridge))].length}`);
console.log(`lines: ${JSON.stringify([...new Set(ok.map((r) => r.feature))])}`);
