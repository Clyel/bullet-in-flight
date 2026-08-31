// Retries just the cartridges that failed on the first pass (fixed PDF-path
// regex), merging successes into the existing results file rather than
// re-running the whole batch.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";

const SCRATCH = "C:/Users/YGACPA/AppData/Local/Temp/claude/C--Users-Public-OneDrive-Projects-Ballistics/af6ffc11-ac36-4a0f-bf2f-4cbb92c3359f/scratchpad";
const PDF_DIR = `${SCRATCH}/nosler_pdfs`;
if (!existsSync(PDF_DIR)) mkdirSync(PDF_DIR);

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64)";
const matched = JSON.parse(readFileSync(`${SCRATCH}/nosler_matched.json`, "utf8"));
const priorFailures = JSON.parse(readFileSync(`${SCRATCH}/case_capacity_failures.json`, "utf8"));
const priorResults = JSON.parse(readFileSync(`${SCRATCH}/case_capacity_results.json`, "utf8"));

const toRetry = matched.filter((m) => priorFailures.some((f) => f.cartridge === m.cartridge));

async function fetchText(url) {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}
async function fetchBuffer(url) {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

const newResults = [];
const stillFailing = [];

for (const row of toRetry) {
  const pageUrl = `https://www.nosler.com/${row.slug}`;
  try {
    const html = await fetchText(pageUrl);
    const pdfHrefs = [...html.matchAll(/href="(\/media\/[^"]+\.pdf)"/gi)].map((m) => m[1]);
    if (pdfHrefs.length === 0) throw new Error("no PDF links found on page");

    const withWeights = pdfHrefs.map((href) => {
      const m = href.match(/-(\d+)gr/i);
      return { href, weight: m ? Number(m[1]) : null };
    }).filter((w) => w.weight != null);
    if (withWeights.length === 0) throw new Error("PDF links found but none had a parseable bullet weight");

    withWeights.sort((a, b) => Math.abs(a.weight - row.representativeGrains) - Math.abs(b.weight - row.representativeGrains));
    const chosen = withWeights[0];
    const pdfUrl = `https://www.nosler.com${chosen.href}`;
    const localPath = `${PDF_DIR}/${row.cartridge.replace(/[^a-z0-9]+/gi, "_")}.pdf`;

    const buf = await fetchBuffer(pdfUrl);
    writeFileSync(localPath, buf);

    const text = execFileSync("pdftotext", ["-layout", localPath, "-"], { encoding: "utf8" });
    const capMatch = text.match(/(\d+(?:\.\d+)?)\s*Gr\.?\s*WATER/i);
    if (!capMatch) throw new Error("PDF downloaded but 'Gr. WATER' pattern not found in extracted text");

    newResults.push({
      cartridge: row.cartridge,
      representativeGrains: row.representativeGrains,
      noslerBulletWeightGrains: chosen.weight,
      caseCapacityGrWater: Number(capMatch[1]),
      sourceUrl: pdfUrl,
    });
    console.log(`OK  ${row.cartridge} -> ${capMatch[1]}gr water (Nosler ${chosen.weight}gr bullet)`);
  } catch (e) {
    stillFailing.push({ cartridge: row.cartridge, slug: row.slug, error: e.message });
    console.log(`FAIL ${row.cartridge}: ${e.message}`);
  }
  await new Promise((r) => setTimeout(r, 300));
}

const merged = [...priorResults, ...newResults];
writeFileSync(`${SCRATCH}/case_capacity_results.json`, JSON.stringify(merged, null, 2));
writeFileSync(`${SCRATCH}/case_capacity_failures.json`, JSON.stringify(stillFailing, null, 2));
console.log(`\nTotal now: ${merged.length} succeeded, ${stillFailing.length} still failing.`);
