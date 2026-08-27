from py_ballisticcalc import *
import json

ATMO = dict(altitude=Distance.Foot(0), pressure=Pressure.InHg(29.92),
            temperature=Temperature.Fahrenheit(59), humidity=0.0)

CARTRIDGES = {
 "308_175_G7": (0.243, TableG7, 175, 0.308, 1.24, 2600, 1.5, 100),
 "223_55_G1":  (0.269, TableG1, 55, 0.224, 0.9, 3240, 1.5, 200),
 "65_140_G7":  (0.315, TableG7, 140, 0.264, 1.35, 2700, 2.0, 200),
}

# Wind cases: (cartridge, wind speed mph, wind clock position).
# Clock: 12 = blowing into the shooter's face (headwind), 3 = hits the
# shooter's right cheek, 6 = at the shooter's back (tailwind), 9 = left cheek.
# py-ballisticcalc's own convention is different (direction_from: 0 = from
# behind the shooter, 90 = from the shooter's left), so clock is converted
# via: py_direction_from_deg = (clock * 30 + 180) % 360.
WIND_CASES = {
 "308_175_G7_wind12":   ("308_175_G7", 10, 12),   # pure headwind
 "308_175_G7_wind6":    ("308_175_G7", 10, 6),    # pure tailwind
 "308_175_G7_wind3":    ("308_175_G7", 10, 3),    # pure crosswind, from the right
 "223_55_G1_wind9":     ("223_55_G1", 10, 9),     # pure crosswind, from the left
 "65_140_G7_wind1_30":  ("65_140_G7", 12, 1.5),   # oblique: both components nonzero
}

def build(bcv, tab, gr, cal, ln, mvv, sh, zero, twistIn=8):
    dm = DragModel(bcv, tab, gr, cal, ln)
    ammo = Ammo(dm, Velocity.FPS(mvv))
    gun = Weapon(sight_height=Distance.Inch(sh), twist=Distance.Inch(twistIn))
    calc = Calculator()
    zang = calc.set_weapon_zero(Shot(weapon=gun, ammo=ammo, atmo=Atmo(**ATMO)), Distance.Yard(zero))
    return dm, ammo, gun, calc, zang

out = {}

for name, (bcv, tab, gr, cal, ln, mvv, sh, zero) in CARTRIDGES.items():
    dm, ammo, gun, calc, zang = build(bcv, tab, gr, cal, ln, mvv, sh, zero)
    shot = Shot(weapon=gun, ammo=ammo, atmo=Atmo(**ATMO), relative_angle=Angular.Degree(0))
    shot.weapon.zero_elevation = zang
    r = calc.fire(shot, trajectory_range=Distance.Yard(1000), trajectory_step=Distance.Yard(100))
    rows = []
    for p in r.trajectory:
        rows.append({"d": round(p.distance >> Distance.Yard, 1), "v": round(p.velocity >> Velocity.FPS, 2),
                     "e": round(p.energy >> Energy.FootPound, 1), "h": round(p.height >> Distance.Inch, 3),
                     "t": round(p.time, 5)})
    out[name] = {"params": {"bc": bcv, "model": "G7" if tab is TableG7 else "G1", "grains": gr,
                             "mv": mvv, "sightHeight": sh, "zeroYd": zero},
                 "zeroAngleDeg": zang >> Angular.Degree, "rows": rows}

for name, (baseName, windMph, windClock) in WIND_CASES.items():
    bcv, tab, gr, cal, ln, mvv, sh, zero = CARTRIDGES[baseName]
    # twistIn=0 disables py-ballisticcalc's spin drift, which would otherwise
    # get folded into `windage` and contaminate this as a pure-wind reference.
    # Spin drift is a separate, later feature (see HANDOFF item 7) with its
    # own fixtures when we get there.
    dm, ammo, gun, calc, zang = build(bcv, tab, gr, cal, ln, mvv, sh, zero, twistIn=0)
    pyDirectionDeg = (windClock * 30 + 180) % 360
    wind = Wind(velocity=Unit.MPH(windMph), direction_from=Unit.Degree(pyDirectionDeg))
    shot = Shot(weapon=gun, ammo=ammo, atmo=Atmo(**ATMO), winds=[wind], relative_angle=Angular.Degree(0))
    shot.weapon.zero_elevation = zang
    r = calc.fire(shot, trajectory_range=Distance.Yard(1000), trajectory_step=Distance.Yard(100))
    rows = []
    for p in r.trajectory:
        rows.append({"d": round(p.distance >> Distance.Yard, 1), "v": round(p.velocity >> Velocity.FPS, 2),
                     "e": round(p.energy >> Energy.FootPound, 1), "h": round(p.height >> Distance.Inch, 3),
                     "t": round(p.time, 5), "w": round(p.windage >> Distance.Inch, 3)})
    out[name] = {"params": {"bc": bcv, "model": "G7" if tab is TableG7 else "G1", "grains": gr,
                             "mv": mvv, "sightHeight": sh, "zeroYd": zero,
                             "windMph": windMph, "windClock": windClock},
                 "zeroAngleDeg": zang >> Angular.Degree, "rows": rows}

print(json.dumps(out, indent=1))

# Usage:
#   pip install py-ballisticcalc
#   python test/fixtures/generate.py > test/fixtures/reference.json
