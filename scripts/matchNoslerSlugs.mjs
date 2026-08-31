// Matches our catalog's 131 cartridges against Nosler's load-data slug list,
// via the same style of token-normalization used earlier to merge
// manufacturer cartridge-name variants in commercialAmmo.js.
import { readFileSync, writeFileSync } from "node:fs";

const SCRATCH = "C:/Users/YGACPA/AppData/Local/Temp/claude/C--Users-Public-OneDrive-Projects-Ballistics/af6ffc11-ac36-4a0f-bf2f-4cbb92c3359f/scratchpad";

const catalogCartridges = JSON.parse(readFileSync(`${SCRATCH}/catalog_cartridges.json`, "utf8"));
const allSlugs = readFileSync(`${SCRATCH}/nosler_slugs.txt`, "utf8").trim().split("\n");

// Drop the non-cartridge nav links mixed into the same href list.
const NON_CARTRIDGE = new Set([
  "dealer-locator", "explore", "limited-edition-m21-carbon-rifle", "load-data",
  "nosler-suppressors", "order-processing", "privacy-policy-use",
  "return-requests", "website-use-policy",
]);
const slugs = allSlugs.filter((s) => !NON_CARTRIDGE.has(s));

const REPL = [
  [/\bremington\b/gi, "rem"], [/\bwinchester\b/gi, "win"], [/\bmagnum\b/gi, "mag"],
  [/\bspringfield\b/gi, "spring"], [/\bgovernment\b/gi, "govt"], [/\bgov.t\b/gi, "govt"],
  [/\bweatherby\b/gi, "wby"], [/\bimproved\b/gi, "imp"], [/\bshort\b/gi, "s"],
  [/\bcreedmoor\b/gi, "crd"], [/\bswedish mauser\b/gi, "swedish"],
];
const norm = (s) => {
  let t = s.toLowerCase();
  for (const [re, rep] of REPL) t = t.replace(re, rep);
  t = t.replace(/[."'()]/g, "").replace(/[\s-]+/g, "");
  return t;
};

const slugNorm = new Map(slugs.map((s) => [norm(s.replace(/-/g, " ")), s]));

// Confirmed by hand against the actual slug list — cases the generic
// normalizer can't bridge without cartridge-specific knowledge (alternate
// names, abbreviations Nosler spells out, etc).
const MANUAL_ALIAS = {
  "250 Savage": "250-3000-savage",
  "257 Roberts +P": "257-roberts",
  "270 WSM": "270-winchester-short-magnum-wsm",
  "300 H&H Mag": "300-holland-holland-magnum",
  "300 PRC": "300-prc-precision-rifle-cartridge",
  "300 RCM": "300-ruger-compact-magnum-rcm",
  "300 Rem Ultra Mag": "300-remington-ultra-magnum-rum",
  "300 Remington SA Ultra Mag": "300-remington-short-action-ultra-magnum-saum",
  "300 RSAUM": "300-remington-short-action-ultra-magnum-saum",
  "300 WSM": "300-winchester-short-magnum-wsm",
  "350 Legend": "350-legend-180gr-load-data",
  "375 H&H Mag": "375-holland-holland-magnum",
  "375 Remington Ultra Magnum": "375-remington-ultra-magnum-rum",
  "400 Legend": "400-legend-215-grain-load-data",
  "45-70 Gov't": "45-70-govt-strong-actions-only",
  "6.5x55 Swedish": "65-55-swedish-mauser",
  "6.8 SPC": "68-remington-spc",
  "7.62x39mm Soviet": "762-39mm",
  "7mm Mauser (7x57)": "7-57mm-mauser",
  "7mm Remington SA Ultra Mag": "7mm-remington-saum",
  "7mm Remington Ultra Mag": "7mm-remington-ultra-magnum-rum",
  "7mm STW": "7mm-shooting-times-westerner-stw",
  "7mm WSM": "7mm-winchester-short-magnum-wsm",
  "8x57": "8-57mm-js-mauser",
};

const matched = [];
const unmatched = [];
for (const row of catalogCartridges) {
  const key = norm(row.cartridge);
  const slug = MANUAL_ALIAS[row.cartridge] ?? slugNorm.get(key);
  if (slug) matched.push({ ...row, slug });
  else unmatched.push(row.cartridge);
}

console.log(`Matched ${matched.length} / ${catalogCartridges.length}`);
console.log("--- unmatched ---");
console.log(unmatched.join("\n"));

writeFileSync(`${SCRATCH}/nosler_matched.json`, JSON.stringify(matched, null, 2));
writeFileSync(`${SCRATCH}/nosler_unmatched.json`, JSON.stringify(unmatched, null, 2));
