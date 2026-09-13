# Extracts SIG SAUER's official ballistics chart PDF into JSON.
#
# Source: https://www.sigsauer.com/media/sigsauer/resources/Ballistics_Data_2024.pdf
# (linked live from sigsauer.com/ballistics's "VIEW THE 2024 BALLISTICS CHART"
# button as of 2026-09-13; internally still labeled "2023 BALLISTICS DATA" in
# its own footer -- that's SIG's own stale label, not a pull-date error here).
# Unlike the older 2020-sig-ammo-ballistics-chart.pdf (a single scanned/
# rendered image, no text layer -- what HANDOFF.md's "needs OCR" note was
# about), this one has a real extractable text layer: no OCR needed at all,
# just a line-based parser for its fixed per-row field order.
#
# Two field orders appear in the source, by section:
#   - most sections: caliber, weight, V, KE, BC, velocity-line, energy-line,
#     trajectory-line, SKU  (SKU last)
#   - "MARKSMAN & MARKSMAN ELITE": caliber, weight, V, KE, BC, SKU,
#     velocity-line, energy-line, trajectory-line  (SKU before the 3 lines)
# Handled per-section below rather than guessed generically.
#
# Output: scratchpad/sig_raw.json -- an array of
#   { section, caliber, weight, mv, bc, sku }
# (velocity/energy/trajectory lines aren't needed downstream -- this catalog
# only stores muzzleVelocity + BC, same as every other manufacturer here.)
#
# Rifle sections only (pistol/handgun sections -- ELITE DEFENSE, FMJ HANDGUN,
# MATCH V-CROWN -- are skipped; this app and its whole catalog are rifle-only).
import json
import re
import sys
from urllib.request import Request, urlopen

import pymupdf

SCRATCH = (
    "C:/Users/YGACPA/AppData/Local/Temp/claude/"
    "C--Users-Public-OneDrive-Projects-Ballistics/"
    "af6ffc11-ac36-4a0f-bf2f-4cbb92c3359f/scratchpad"
)
URL = "https://www.sigsauer.com/media/sigsauer/resources/Ballistics_Data_2024.pdf"
PDF_PATH = f"{SCRATCH}/sig_ballistics_2024.pdf"

req = Request(URL, headers={"User-Agent": "Mozilla/5.0"})
with urlopen(req) as r, open(PDF_PATH, "wb") as f:
    f.write(r.read())

doc = pymupdf.open(PDF_PATH)
lines = []
for page in doc:
    lines.extend(l.strip() for l in page.get_text().splitlines())

# (header text, capture mode) -- mode "sku_last" or "sku_mid"; None = skip
# (pistol/handgun section, or a section this app has no use for).
SECTIONS = {
    "ELITE DEFENSE": None,
    "FMJ HANDGUN": None,
    "FMJ RIFLE": "sku_last",
    "MARKSMAN & MARKSMAN": "sku_mid",
    "ELITE SERIES \nVARMINT & PREDATOR": "sku_last",  # not matched directly; see below
    "ELITE SERIES COPPER": "sku_last",
    "MATCH": None,
    "ELITE SERIES TIPPED": "sku_last",
    "ELITE HUNTER ACCUBOND": "sku_last",
    "VENARI": "sku_last",
}
# Multi-line headers collapse to one lookup key by joining with the next
# line: "ELITE SERIES " + "VARMINT & PREDATOR" -> checked as a pair below,
# same for "MARKSMAN & MARKSMAN " + "ELITE" and "ELITE SERIES TIPPED" +
# "LEAD CORE TIPPED" and "MATCH" + "V-CROWN" and "ELITE DEFENSE" + "V-CROWN".
HEADER_STARTS = [
    "ELITE DEFENSE", "FMJ HANDGUN", "FMJ RIFLE", "MARKSMAN & MARKSMAN",
    "ELITE SERIES", "MATCH", "ELITE HUNTER ACCUBOND", "VENARI",
]
MODE_BY_START = {
    "ELITE DEFENSE": None, "FMJ HANDGUN": None, "FMJ RIFLE": "sku_last",
    "MARKSMAN & MARKSMAN": "sku_mid", "ELITE SERIES": "sku_last",
    "MATCH": None, "ELITE HUNTER ACCUBOND": "sku_last", "VENARI": "sku_last",
}
NUM = re.compile(r"^\d+$")
BC = re.compile(r"^0\.\d+$")
PIPE = re.compile(r"\|")

out = []
mode = None
section = None
i = 0
n = len(lines)
while i < n:
    line = lines[i]
    matched_header = next((s for s in HEADER_STARTS if line.startswith(s)), None)
    if matched_header:
        mode = MODE_BY_START[matched_header]
        section = line
        i += 1
        continue
    if line.startswith("CALIBER") or line in ("Weight ", "(gr)", "V (ft/sec)", "KE (ft-lbs)", "G1 BC", "PRODUCT SKU") \
            or line.startswith("VELOCITY IN") or line.startswith("ENERGY IN") or line.startswith("TRAJECTORY IN") \
            or PIPE.search(line) and not NUM.match(line.split(" | ")[0].strip() or "x") is None and False:
        i += 1
        continue
    # A row starts at a caliber name: not blank, not a pure number, not a BC,
    # not a pipe-delimited data line, not a table-header fragment.
    if mode and line and not NUM.match(line) and not BC.match(line) and "|" not in line \
            and line not in ("MUZZLE | 25 YDS | 50 YDS | 100 YDS", ) \
            and not line.startswith(("MUZZLE", "100 YDS", "25 YDS")) \
            and line not in ("2023 BALLISTICS DATA", "sigsauer.com"):
        caliber = line
        try:
            weight = lines[i + 1]
            v = lines[i + 2]
            ke = lines[i + 3]
            bc = lines[i + 4]
            if not (NUM.match(weight) and NUM.match(v) and NUM.match(ke) and BC.match(bc)):
                i += 1
                continue
            if mode == "sku_mid":
                sku = lines[i + 5]
                vel_line = lines[i + 6]
                consumed = 6
            else:
                vel_line = lines[i + 5]
                sku = lines[i + 8]
                consumed = 9
            # Use the velocity-vs-range table's own first value as the real
            # muzzle velocity, not the separate "V (ft/sec)" summary column
            # a few lines up -- they usually agree, but disagree for one row
            # (5.56mm, E556M4: summary says 2750, the table it's actually
            # built from starts at 2816). The table's own number is what SIG's
            # own downrange figures for that row were computed from, so it's
            # the one that keeps this app's simulation consistent with SIG's
            # published trajectory, not just its summary column.
            mv = vel_line.split("|")[0].strip()
            out.append({"section": section, "caliber": caliber, "weight": weight, "mv": mv, "bc": bc, "sku": sku})
            i += consumed
            continue
        except IndexError:
            pass
    i += 1

json.dump(out, open(f"{SCRATCH}/sig_raw.json", "w"), indent=1)
print(f"{len(out)} rows")
for o in out:
    print(f"  [{o['section'][:24]:24}] {o['caliber']:28} {o['weight']:>4}gr  MV {o['mv']:>5}  BC {o['bc']}  {o['sku']}")

# --- SKU-vs-caliber consistency check -----------------------------------
# Every other section's SKU prefix matches its printed caliber (confirmed by
# hand while building buildSig.mjs). The VENARI section is the one
# exception: its printed CALIBER text is shifted/wrong for every row (a real
# authoring bug in SIG's own PDF, confirmed by cross-checking rendered page
# images against SKU prefixes AND each row's own embedded weight, both of
# which line up with a DIFFERENT caliber than the row's printed name -- see
# buildSig.mjs for the corrected mapping). This check exists so a future
# re-pull that fixes (or changes) that bug gets flagged instead of silently
# re-applying a stale correction.
PREFIX_CARTRIDGE = {
    "223": "223 Remington", "556": "5.56mm", "225": "22-250 Remington",
    "243": "243 Winchester", "6MMC": "6mm Creedmoor", "65CM": "6.5 Creedmoor",
    "270": "270 Winchester", "277SF": "277 SIG Fury", "300A": "300 Blackout",
    "300B": "300 Blackout", "300H": "300 Blackout", "308": "308 Winchester",
    "3006": "30-06 Springfield", "3WM": "300 Winchester Magnum",
    "7RM": "7mm Remington Magnum", "7MM": "7mm Remington Magnum",
    "300WM": "300 Winchester Magnum",  # VENARI's own SKU spells this out in full, unlike "3WM" elsewhere
}
prefixes_by_len = sorted(PREFIX_CARTRIDGE, key=len, reverse=True)
for o in out:
    body = re.sub(r"^[EHV]", "", o["sku"])  # strip the one leading brand-code letter
    prefix = next((p for p in prefixes_by_len if body.startswith(p)), None)
    expected = PREFIX_CARTRIDGE.get(prefix)
    if expected and expected.split()[0] not in o["caliber"] and o["caliber"].split()[0] not in expected:
        print(f"  MISMATCH: sku {o['sku']} (prefix {prefix} -> {expected}) printed as {o['caliber']!r}")
