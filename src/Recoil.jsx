import React, { useMemo, useState } from "react";
import { C, label, numeric } from "./components/theme.js";
import { Field, UnitField, SyncStatusHint, ImportActions, StepHead } from "./components/ui.jsx";
import CommercialLoadPicker from "./components/CommercialLoadPicker.jsx";
import { freeRecoilVelocity, freeRecoilEnergy, estimateChargeWeight, DEFAULT_LOAD_DENSITY } from "./ballistics/recoil.js";
import { CASE_CAPACITY } from "./data/caseCapacity.js";
import { useRecoilSetups } from "./storage/useRecoilSetups.js";
import { num } from "./solveFromForm.js";
import { useUnits } from "./UnitsContext.jsx";
import { toDisplay, unitSuffix } from "./units.js";

// Setups are compared, not just calculated one at a time — "rifle + optics
// weight" IS the variable this whole tab exists to isolate (a 6.5lb
// mountain rifle vs. a 9lb varmint rig in the same cartridge), so unlike
// OptimalZero's shared "rig" applied to every row, weight lives per-row
// here. Sticky across adds anyway (see FORM_DEFAULTS below) so comparing a
// few loads through the SAME rifle — the more common case — doesn't mean
// retyping the weight each time.
const FORM_DEFAULTS = {
  name: "",
  rifleWeightLb: "8",
  grains: "",
  muzzleVelocity: "",
  cartridge: "",
  chargeGr: "",
};

const CARTRIDGES_WITH_CAPACITY = Object.keys(CASE_CAPACITY).sort((a, b) => a.localeCompare(b));

export default function Recoil() {
  const { system } = useUnits();
  const [form, setForm] = useState(FORM_DEFAULTS);
  const [chargeTouched, setChargeTouched] = useState(false);
  const { setups, addError, add, remove, importCount, runImport, dismissImport, signedIn } = useRecoilSetups();

  const set = (key) => (val) => setForm((f) => ({ ...f, [key]: val }));

  // Picking a catalog round fills grains/MV (ballistics) AND the cartridge
  // used for the charge-weight estimate — but only overwrites the charge
  // field itself if the user hasn't already typed their own number in it.
  const handleSelectCommercial = (ammo) => {
    setForm((f) => {
      const next = { ...f, grains: String(ammo.grains), muzzleVelocity: String(ammo.muzzleVelocity), cartridge: ammo.cartridge };
      if (!chargeTouched) {
        const est = estimateChargeWeight(ammo.cartridge);
        next.chargeGr = est != null ? est.toFixed(1) : "";
      }
      return next;
    });
  };

  const handleCartridgeChange = (cartridge) => {
    setForm((f) => {
      const next = { ...f, cartridge };
      if (!chargeTouched) {
        const est = estimateChargeWeight(cartridge);
        next.chargeGr = est != null ? est.toFixed(1) : "";
      }
      return next;
    });
  };

  const handleChargeChange = (val) => {
    setChargeTouched(true);
    set("chargeGr")(val);
  };

  const rifleWeightLb = num(form.rifleWeightLb);
  const grains = num(form.grains);
  const muzzleVelocity = num(form.muzzleVelocity);
  const chargeGr = num(form.chargeGr);
  const canAdd = rifleWeightLb > 0 && grains > 0 && muzzleVelocity > 0 && chargeGr > 0;
  const chargeIsEstimate = chargeTouched === false && form.cartridge && estimateChargeWeight(form.cartridge) != null;

  const handleAdd = async () => {
    if (!canAdd) return;
    const ok = await add({
      name: form.name.trim() || form.cartridge || "Custom setup",
      cartridge: form.cartridge,
      rifleWeightLb: String(rifleWeightLb), grains: String(grains),
      muzzleVelocity: String(muzzleVelocity), chargeGr: String(chargeGr),
      chargeIsEstimate: Boolean(chargeIsEstimate),
    });
    if (!ok) return;
    // Rifle weight stays put — the common next step is trying another load
    // through the same gun. Everything setup-specific resets.
    setForm((f) => ({ ...FORM_DEFAULTS, rifleWeightLb: f.rifleWeightLb }));
    setChargeTouched(false);
  };

  // Numeric fields round-trip through storage as strings (both localStorage
  // and the DB read path stringify them — see recoilSetups.js/recoilSetupsCloud.js),
  // so num() here matches how every other page in this app treats form state.
  const results = useMemo(() => setups.map((setup) => {
    const g = num(setup.grains), mv = num(setup.muzzleVelocity),
          w = num(setup.rifleWeightLb), c = num(setup.chargeGr);
    return {
      ...setup, grains: g, muzzleVelocity: mv, rifleWeightLb: w, chargeGr: c,
      velocity: freeRecoilVelocity(g, mv, c, w),
      energy: freeRecoilEnergy(g, mv, c, w),
    };
  }), [setups]);

  const wSuf = unitSuffix("weight", system);
  const weight = (lb) => toDisplay(lb, "weight", system);
  const vSuf = unitSuffix("velocity", system);
  const vel = (fps) => toDisplay(fps, "velocity", system);
  const eSuf = unitSuffix("energy", system);
  const energy = (ftLb) => toDisplay(ftLb, "energy", system);

  const sub = { ...label, display: "block", marginBottom: 5 };

  return (
    <div className="bif-grid">
      <div style={{ background: C.card, border: `1.5px solid ${C.rule}`, padding: 16 }}>
        {/* Round first, same as Calculator's "Step 1 — The load" -- what
            you're evaluating comes before anything else, not naming or
            weight, which only matter once there's actually a round here. */}
        <StepHead n={1} name="The round" first />
        <span style={sub}>Pick a commercial round</span>
        <CommercialLoadPicker onSelect={handleSelectCommercial} resetLoadAfterSelect />
        <div style={{ marginBottom: 16, font: "400 10.5px/1.4 'IBM Plex Sans',sans-serif", color: C.muted }}>
          Fills in bullet weight, muzzle velocity, and the powder-charge estimate.
        </div>

        <span style={sub}>Or enter your own</span>
        <Field label="Bullet weight" value={form.grains} onChange={set("grains")} suffix="gr" />
        <UnitField label="Muzzle velocity" category="velocity" value={form.muzzleVelocity} onChange={set("muzzleVelocity")} />

        <StepHead n={2} name="The rifle" />
        <UnitField
          label="Rifle + optics weight"
          hint="The whole assembled rig as fired — scope, rings, suppressor, sling, everything. Weigh it or add up spec-sheet numbers."
          category="weight" value={form.rifleWeightLb} onChange={set("rifleWeightLb")}
        />

        <StepHead n={3} name="The charge estimate" />
        <span style={sub}>Cartridge (for charge estimate)</span>
        <select
          value={form.cartridge}
          onChange={(e) => handleCartridgeChange(e.target.value)}
          style={{ width: "100%", padding: "7px 8px", marginBottom: 5,
                   border: `1.5px solid ${C.rule}`, background: C.card, color: C.ink,
                   font: "500 13px 'IBM Plex Mono',monospace" }}
        >
          <option value="">None — I'll enter my own charge weight</option>
          {CARTRIDGES_WITH_CAPACITY.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <div style={{ marginBottom: 16, font: "400 10.5px/1.4 'IBM Plex Sans',sans-serif", color: C.muted }}>
          Set automatically by the commercial-round picker above; only 82 of this app's cartridges have Nosler
          case-capacity data to estimate from — pick one here directly if your round wasn't in that list.
        </div>

        <Field
          label="Powder charge"
          hint={chargeIsEstimate
            ? `Estimated from case capacity at ${(DEFAULT_LOAD_DENSITY * 100).toFixed(0)}% load density. Overwrite it if you know your actual charge.`
            : "Enter your load's actual charge weight, or pick a cartridge above for an estimate."}
          value={form.chargeGr} onChange={handleChargeChange} suffix="gr"
        />

        {/* Naming/adding isn't its own numbered step, same reasoning as
            Calculator's save block -- it's not a fourth thing to configure,
            it only makes sense once Steps 1-3 above are actually filled in. */}
        <Field label="Name this setup" hint="Optional — defaults to the cartridge." inputMode="text"
               value={form.name} onChange={set("name")} />
        <SyncStatusHint signedIn={signedIn} noun="setups" />
        <button
          onClick={handleAdd}
          disabled={!canAdd}
          style={{ width: "100%", padding: 9, background: canAdd ? C.ink : C.rule, color: C.card,
                   border: "none", cursor: canAdd ? "pointer" : "default",
                   font: "600 11px 'Oswald',sans-serif", letterSpacing: ".12em" }}
        >
          Add setup to comparison
        </button>
        {addError && (
          <div style={{ marginTop: 8, font: "500 11px/1.4 'IBM Plex Sans',sans-serif", color: C.ox }}>
            Couldn't add: {addError}
          </div>
        )}
      </div>

      <div>
        {importCount > 0 && (
          <Notice tone={C.brass} title="Recoil setups found on this device">
            {importCount} {importCount === 1 ? "setup" : "setups"} saved locally, from before you signed in.
            <ImportActions onImport={runImport} onDismiss={dismissImport} />
          </Notice>
        )}
        {results.length === 0 ? (
          <Notice tone={C.brass} title="Nothing to compare yet">
            Add a setup on the left. Add a second (a different cartridge, or the same load in a lighter or
            heavier rifle) to see them side by side.
          </Notice>
        ) : (
          <>
            <div style={{ background: C.card, border: `1.5px solid ${C.rule}`, overflowX: "auto", marginBottom: 12 }}>
              <table>
                <thead>
                  <tr style={{ background: C.ink }}>
                    {["Setup", `Weight (${wSuf})`, "Bullet", `Velocity (${vSuf})`, "Charge",
                      `Recoil Velocity (${vSuf})`, `Free Recoil Energy (${eSuf})`, ""].map((head_, i, arr) => (
                      <th key={head_ || i} scope="col"
                          style={{ padding: "9px 12px", textAlign: i === 0 ? "left" : i === arr.length - 1 ? "center" : "right",
                                   font: "600 10px 'Oswald',sans-serif", letterSpacing: ".12em",
                                   textTransform: "uppercase", color: C.card, whiteSpace: "nowrap" }}>
                        {head_}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {results.map((r, i) => (
                    <tr key={r.id} style={{ background: i % 2 ? C.cardAlt : C.card }}>
                      <td style={{ ...numeric, padding: "7px 12px", fontWeight: 600 }}>
                        {r.name}
                        {r.cartridge && r.name !== r.cartridge && (
                          <div style={{ font: "400 10.5px 'IBM Plex Sans',sans-serif", color: C.muted, marginTop: 2 }}>
                            {r.cartridge}
                          </div>
                        )}
                      </td>
                      <td style={{ ...numeric, padding: "7px 12px", textAlign: "right" }}>{weight(r.rifleWeightLb).toFixed(2)}</td>
                      <td style={{ ...numeric, padding: "7px 12px", textAlign: "right" }}>{r.grains}gr</td>
                      <td style={{ ...numeric, padding: "7px 12px", textAlign: "right" }}>{Math.round(vel(r.muzzleVelocity)).toLocaleString("en-US")}</td>
                      <td style={{ ...numeric, padding: "7px 12px", textAlign: "right" }}>
                        {r.chargeGr}gr{r.chargeIsEstimate ? <span style={{ color: C.muted }}> (est.)</span> : ""}
                      </td>
                      <td style={{ ...numeric, padding: "7px 12px", textAlign: "right" }}>{vel(r.velocity).toFixed(1)}</td>
                      <td style={{ ...numeric, padding: "7px 12px", textAlign: "right", fontWeight: 600 }}>
                        {energy(r.energy).toFixed(1)} {eSuf}
                      </td>
                      <td style={{ padding: "7px 8px", textAlign: "center" }}>
                        <button
                          onClick={() => remove(r.id)}
                          aria-label={`Remove ${r.name}`}
                          style={{ background: "none", border: "none", cursor: "pointer", color: C.ox,
                                   font: "600 14px 'IBM Plex Mono',monospace", padding: "0 4px" }}
                        >
                          &times;
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <RecoilBars results={results} />
          </>
        )}

        <p style={{ marginTop: 4, font: "400 11px/1.5 'IBM Plex Sans',sans-serif", color: C.muted }}>
          <strong style={{ color: C.ink }}>Free Recoil Energy</strong> only — SAAMI's own physics (conservation of
          momentum and kinetic energy, rifle gas-velocity factor 1.75&times;), not &ldquo;felt&rdquo; recoil. Stock
          geometry, recoil pads, and action type all affect how a rifle actually feels to shoot, and none of that
          reduces to a formula, so it isn't estimated here. A charge weight marked &ldquo;est.&rdquo; is a case-capacity
          approximation, not a substitute for your own load data.
        </p>
      </div>
    </div>
  );
}

// A simple horizontal bar per setup keeps the energy comparison readable at
// a glance once there are more than two or three rows — the table above has
// the exact numbers, this is just for the "which of these kicks harder"
// read. Plain SVG, no charting library: the app already reserves recharts
// for the trajectory line charts, and a handful of static bars don't need it.
function RecoilBars({ results }) {
  const { system } = useUnits();
  const eSuf = unitSuffix("energy", system);
  const energy = (ftLb) => toDisplay(ftLb, "energy", system);
  // Bar width is a ratio (r.energy / max) -- unit-invariant, since both
  // sides scale by the same factor, so this stays in raw canonical ft-lb
  // regardless of display unit. Only the printed number needs conversion.
  const max = Math.max(...results.map((r) => r.energy), 1);
  return (
    <div style={{ background: C.card, border: `1.5px solid ${C.rule}`, padding: "14px 16px" }}>
      <div style={{ ...label, color: C.ink, marginBottom: 10 }}>Free recoil energy, compared</div>
      {results.map((r) => (
        <div key={r.id} style={{ marginBottom: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between",
                        font: "500 11px 'IBM Plex Sans',sans-serif", color: C.ink, marginBottom: 2 }}>
            <span>{r.name}</span>
            <span style={{ ...numeric }}>{energy(r.energy).toFixed(1)} {eSuf}</span>
          </div>
          <div style={{ height: 10, background: C.field }}>
            <div style={{ height: "100%", width: `${(r.energy / max) * 100}%`, background: C.ox,
                          transition: "width 200ms" }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function Notice({ tone, title, children }) {
  return (
    <div style={{ background: C.card, border: `1.5px solid ${tone}`, borderLeft: `5px solid ${tone}`,
                  padding: 14, marginBottom: 16 }}>
      <div style={{ font: "600 12px 'Oswald',sans-serif", letterSpacing: ".1em",
                    textTransform: "uppercase", color: tone }}>
        {title}
      </div>
      <div style={{ marginTop: 5, font: "400 12.5px 'IBM Plex Sans',sans-serif", color: C.ink }}>
        {children}
      </div>
    </div>
  );
}
