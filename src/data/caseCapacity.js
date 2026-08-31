// Cartridge case capacity (grains of water), sourced directly from Nosler's
// own published per-cartridge load-data PDFs (nosler.com/{cartridge-slug},
// each cartridge has a PDF per bullet-weight bracket headed "CASE HOLDS: X
// Gr. WATER"). Pulled 2026-08-31.
//
// This is NOT ammo-intrinsic data the way muzzleVelocity/BC are in
// commercialAmmo.js — case capacity is a property of the CARTRIDGE (its
// physical case dimensions), the same regardless of which manufacturer
// loaded a given round, which is why this lives as its own lookup keyed by
// cartridge name rather than folded into individual catalog entries.
//
// Nosler measures capacity UNDER THE SEATED BULLET, not to the case mouth —
// a heavier bullet seated deeper leaves less room, so the same cartridge's
// capacity genuinely varies by several grains across bullet weights (e.g.
// Nosler's own 30-06 pages range ~59.7-67.7gr across their bullet-weight
// brackets). For each cartridge here, `noslerBulletWeightGrains` records
// which of Nosler's brackets was pulled — deliberately chosen to be close
// to THIS catalog's own typical (median) bullet weight for that cartridge,
// not necessarily the lightest/heaviest Nosler publishes. Don't be
// surprised if a value here reads lower than a case-capacity figure you
// find elsewhere online (e.g. a site measuring to the case mouth, or using
// a lighter bullet bracket) — this is deliberately matched to how this
// catalog actually uses the cartridge, not a universal "true" capacity.
//
// Coverage: 82 of the catalog's 131 distinct cartridges (63%). The rest —
// rimfire (not reloadable), obsolete/vintage lever-gun rounds, Weatherby
// RPM variants, safari/Nitro Express calibers, and a few brand-new
// cartridges Nosler hasn't published data for yet — simply aren't in
// Nosler's own load-data library. No fabricated/estimated fallback for
// those; they're absent from this table on purpose.
//
// Regenerate with scripts/matchNoslerSlugs.mjs + scripts/fetchNoslerCaseCapacity.mjs.

export const CASE_CAPACITY = {
  "17 Remington": { caseCapacityGrWater: 28.4, noslerBulletWeightGrains: 20 },
  "17 Remington Fireball": { caseCapacityGrWater: 21.7, noslerBulletWeightGrains: 20 },
  "204 Ruger": { caseCapacityGrWater: 30.6, noslerBulletWeightGrains: 32 },
  "22 Hornet": { caseCapacityGrWater: 14.2, noslerBulletWeightGrains: 34 },
  "22-250 Rem": { caseCapacityGrWater: 42.4, noslerBulletWeightGrains: 55 },
  "220 Swift": { caseCapacityGrWater: 46.4, noslerBulletWeightGrains: 55 },
  "221 Remington Fireball": { caseCapacityGrWater: 19.6, noslerBulletWeightGrains: 50 },
  "222 Rem": { caseCapacityGrWater: 25.8, noslerBulletWeightGrains: 40 },
  "223 Rem": { caseCapacityGrWater: 27.4, noslerBulletWeightGrains: 55 },
  "240 WBY MAG": { caseCapacityGrWater: 60.1, noslerBulletWeightGrains: 80 },
  "243 Win": { caseCapacityGrWater: 52.8, noslerBulletWeightGrains: 90 },
  "25-06 Rem": { caseCapacityGrWater: 63.3, noslerBulletWeightGrains: 110 },
  "250 Savage": { caseCapacityGrWater: 41.2, noslerBulletWeightGrains: 100 },
  "257 Roberts": { caseCapacityGrWater: 51.6, noslerBulletWeightGrains: 115 },
  "257 Roberts +P": { caseCapacityGrWater: 51.4, noslerBulletWeightGrains: 120 },
  "257 Wby Mag": { caseCapacityGrWater: 81.8, noslerBulletWeightGrains: 100 },
  "260 Rem": { caseCapacityGrWater: 47, noslerBulletWeightGrains: 130 },
  "264 Win Mag": { caseCapacityGrWater: 79.6, noslerBulletWeightGrains: 140 },
  "270 WBY MAG": { caseCapacityGrWater: 81.7, noslerBulletWeightGrains: 130 },
  "270 Win": { caseCapacityGrWater: 64.6, noslerBulletWeightGrains: 130 },
  "270 WSM": { caseCapacityGrWater: 73, noslerBulletWeightGrains: 130 },
  "28 Nosler": { caseCapacityGrWater: 92.5, noslerBulletWeightGrains: 160 },
  "280 Ackley Improved": { caseCapacityGrWater: 64.8, noslerBulletWeightGrains: 150 },
  "280 Rem": { caseCapacityGrWater: 62.5, noslerBulletWeightGrains: 150 },
  "30 TC": { caseCapacityGrWater: 48.5, noslerBulletWeightGrains: 155 },
  "30-06 Springfield": { caseCapacityGrWater: 60.2, noslerBulletWeightGrains: 165 },
  "30-30 Win": { caseCapacityGrWater: 36.6, noslerBulletWeightGrains: 150 },
  "30-378 Wby Mag": { caseCapacityGrWater: 121, noslerBulletWeightGrains: 180 },
  "30-40 Krag": { caseCapacityGrWater: 50.9, noslerBulletWeightGrains: 180 },
  "300 AAC Blackout": { caseCapacityGrWater: 19.1, noslerBulletWeightGrains: 125 },
  "300 H&H Mag": { caseCapacityGrWater: 77.6, noslerBulletWeightGrains: 180 },
  "300 PRC": { caseCapacityGrWater: 88, noslerBulletWeightGrains: 210 },
  "300 RCM": { caseCapacityGrWater: 61.4, noslerBulletWeightGrains: 180 },
  "300 Rem Ultra Mag": { caseCapacityGrWater: 104.7, noslerBulletWeightGrains: 180 },
  "300 Remington SA Ultra Mag": { caseCapacityGrWater: 65.6, noslerBulletWeightGrains: 165 },
  "300 RSAUM": { caseCapacityGrWater: 64.3, noslerBulletWeightGrains: 180 },
  "300 Savage": { caseCapacityGrWater: 44.4, noslerBulletWeightGrains: 150 },
  "300 Wby Mag": { caseCapacityGrWater: 91.8, noslerBulletWeightGrains: 180 },
  "300 Win Mag": { caseCapacityGrWater: 82.3, noslerBulletWeightGrains: 180 },
  "300 WSM": { caseCapacityGrWater: 71.3, noslerBulletWeightGrains: 180 },
  "308 Marlin Express": { caseCapacityGrWater: 41.7, noslerBulletWeightGrains: 150 },
  "308 Win": { caseCapacityGrWater: 48.3, noslerBulletWeightGrains: 165 },
  "338 Federal": { caseCapacityGrWater: 44.5, noslerBulletWeightGrains: 200 },
  "338 Lapua Mag": { caseCapacityGrWater: 101.7, noslerBulletWeightGrains: 250 },
  "338 Remington Ultra Magnum": { caseCapacityGrWater: 99.1, noslerBulletWeightGrains: 250 },
  "338 Win Mag": { caseCapacityGrWater: 76.4, noslerBulletWeightGrains: 225 },
  "338-378 WBY MAG": { caseCapacityGrWater: 119, noslerBulletWeightGrains: 250 },
  "340 WBY MAG": { caseCapacityGrWater: 89, noslerBulletWeightGrains: 250 },
  "35 Whelen": { caseCapacityGrWater: 63.3, noslerBulletWeightGrains: 200 },
  "350 Legend": { caseCapacityGrWater: 26.4, noslerBulletWeightGrains: 180 },
  "358 Win": { caseCapacityGrWater: 48.5, noslerBulletWeightGrains: 225 },
  "375 H&H Mag": { caseCapacityGrWater: 78.5, noslerBulletWeightGrains: 300 },
  "375 Remington Ultra Magnum": { caseCapacityGrWater: 105.2, noslerBulletWeightGrains: 260 },
  "375 Ruger": { caseCapacityGrWater: 85.5, noslerBulletWeightGrains: 260 },
  "400 Legend": { caseCapacityGrWater: 35.5, noslerBulletWeightGrains: 215 },
  "416 Rem Mag": { caseCapacityGrWater: 80, noslerBulletWeightGrains: 400 },
  "416 Rigby": { caseCapacityGrWater: 106, noslerBulletWeightGrains: 400 },
  "416 Ruger": { caseCapacityGrWater: 75.8, noslerBulletWeightGrains: 400 },
  "416 WBY MAG": { caseCapacityGrWater: 114.5, noslerBulletWeightGrains: 400 },
  "45-70 Gov't": { caseCapacityGrWater: 64.6, noslerBulletWeightGrains: 300 },
  "458 Lott": { caseCapacityGrWater: 75.8, noslerBulletWeightGrains: 500 },
  "458 Win Mag": { caseCapacityGrWater: 64.2, noslerBulletWeightGrains: 500 },
  "6.5 Creedmoor": { caseCapacityGrWater: 47.1, noslerBulletWeightGrains: 130 },
  "6.5 Grendel": { caseCapacityGrWater: 30, noslerBulletWeightGrains: 125 },
  "6.5 PRC": { caseCapacityGrWater: 62.3, noslerBulletWeightGrains: 140 },
  "6.5x55 Swedish": { caseCapacityGrWater: 50.2, noslerBulletWeightGrains: 140 },
  "6.8 SPC": { caseCapacityGrWater: 29.5, noslerBulletWeightGrains: 115 },
  "6mm Creedmoor": { caseCapacityGrWater: 48.1, noslerBulletWeightGrains: 105 },
  "6mm Rem": { caseCapacityGrWater: 51.8, noslerBulletWeightGrains: 95 },
  "7.62x39mm Soviet": { caseCapacityGrWater: 27.7, noslerBulletWeightGrains: 123 },
  "7mm Mauser (7x57)": { caseCapacityGrWater: 52.5, noslerBulletWeightGrains: 140 },
  "7mm PRC": { caseCapacityGrWater: 75.4, noslerBulletWeightGrains: 185 },
  "7mm Rem Mag": { caseCapacityGrWater: 78, noslerBulletWeightGrains: 150 },
  "7mm Remington SA Ultra Mag": { caseCapacityGrWater: 65.8, noslerBulletWeightGrains: 150 },
  "7mm Remington Ultra Mag": { caseCapacityGrWater: 105.4, noslerBulletWeightGrains: 150 },
  "7mm STW": { caseCapacityGrWater: 90.6, noslerBulletWeightGrains: 160 },
  "7mm Wby Mag": { caseCapacityGrWater: 81.4, noslerBulletWeightGrains: 150 },
  "7mm WSM": { caseCapacityGrWater: 73.5, noslerBulletWeightGrains: 150 },
  "7mm-08 Rem": { caseCapacityGrWater: 48.6, noslerBulletWeightGrains: 140 },
  "8x57": { caseCapacityGrWater: 51.5, noslerBulletWeightGrains: 200 },
  "9.3x62 Mauser": { caseCapacityGrWater: 60.4, noslerBulletWeightGrains: 286 },
  "9.3x74R": { caseCapacityGrWater: 66.7, noslerBulletWeightGrains: 286 },
};
