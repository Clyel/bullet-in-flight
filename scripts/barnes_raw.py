# Extracts Barnes's "Centerfire Rifle Ballistics" master chart into JSON.
#
# Source: https://barnesbullets.com/content/Barnes-Ballistics-Charts/CFR-Imperial.pdf
# (the file barnesbullets.com links as "Barnes Master Ballistics Charts"),
# pulled 2026-09-10, saved alongside as barnes_master_chart.pdf.
#
# The chart is a single tall (11x17) page laid out in InDesign as separate
# per-column text frames, so `pdftotext` — even -layout / -table — shreds it:
# the cartridge column doesn't line up row-for-row with the data. PyMuPDF's
# find_tables() recovers the real grid, including the cartridge column as a
# merged cell that only carries a value on the first row of each group
# (forward-filled here).
#
# Output: scratchpad/barnes_raw.json — an array of
#   { cartridge, line, sku, weight, style, mv, bc }
# All BCs on this chart are G1 (Barnes prints the G1 BC on the box).
import json
import re
import sys

import pymupdf

SCRATCH = (
    "C:/Users/YGACPA/AppData/Local/Temp/claude/"
    "C--Users-Public-OneDrive-Projects-Ballistics/"
    "af6ffc11-ac36-4a0f-bf2f-4cbb92c3359f/scratchpad"
)

doc = pymupdf.open(f"{SCRATCH}/barnes_master_chart.pdf")
tables = doc[0].find_tables().tables
if not tables:
    sys.exit("no table found on page 1")
rows = tables[0].extract()

# rows[0..2] are the banner / blank / header; data starts at row 3.
# Column order: cartridge, line, sku, wt, style, sight-height, zero,
#               velocity(cell), energy(cell), trajectory(cell), bc, barrel.
ascii_only = lambda s: re.sub(r"[^\x20-\x7e]", "", s or "").strip()

out = []
cartridge = None
for r in rows[3:]:
    c = ascii_only(r[0])
    if c:
        cartridge = c
    sku = ascii_only(r[2])
    if not re.match(r"^\d", sku):
        continue  # skip sub-headers / stray rows
    weight = re.sub(r"[^0-9.].*$", "", ascii_only(r[3]))          # drop †-footnotes
    style = re.sub(r"\s*[^A-Za-z0-9 /()+.\-].*$", "", ascii_only(r[4])).strip()
    mv = (ascii_only(r[7]).split() or [""])[0]                     # first token = MUZZLE
    bc = ascii_only(r[10])
    out.append(
        {"cartridge": cartridge, "line": ascii_only(r[1]), "sku": sku,
         "weight": weight, "style": style, "mv": mv, "bc": bc}
    )

json.dump(out, open(f"{SCRATCH}/barnes_raw.json", "w"), indent=1)

bad_bc = [o for o in out if not re.match(r"^0?\.\d+$", o["bc"])]
bad_mv = [o for o in out if not re.match(r"^\d{3,4}$", o["mv"])]
print(f"{len(out)} rows, {len(set(o['cartridge'] for o in out))} cartridges")
print(f"bad BC: {len(bad_bc)}  bad MV: {len(bad_mv)}")
for o in bad_bc + bad_mv:
    print("  ", o)
