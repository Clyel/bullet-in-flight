import React, { useMemo, useState } from "react";
import { C, label } from "../components/theme.js";
import { Field, UnitField, Segmented, StepHead, Notice } from "../components/ui.jsx";
import { num } from "../solveFromForm.js";
import { bcFromVelocity, bcFromTimeOfFlight } from "../ballistics/bcFromChrono.js";
import { formatDisplay, unitSuffix } from "../units.js";
import { useUnits } from "../UnitsContext.jsx";

// Standard sea-level atmosphere (matches ballistics/atmosphere.js's own
// standardAtmosphere(0)) -- the field always holds a real number, never
// blank, since bcFromChrono.js needs tempF/pressInHg to actually solve.
// atmoTouched only tracks whether that default is still in effect, for the
// provenance note on the result below.
const DEFAULT_TEMP_F = "59";
const DEFAULT_PRESS_INHG = "29.92";

export default function BcFromChrono({ onBack }) {
  const { system } = useUnits();
  const [muzzleVelocity, setMuzzleVelocity] = useState("");
  const [distanceYd, setDistanceYd] = useState("");
  const [dragModel, setDragModel] = useState("G7");
  const [mode, setMode] = useState("Downrange velocity");
  const [targetVelocity, setTargetVelocity] = useState("");
  const [targetTimeSec, setTargetTimeSec] = useState("");
  const [tempF, setTempF] = useState(DEFAULT_TEMP_F);
  const [pressInHg, setPressInHg] = useState(DEFAULT_PRESS_INHG);
  const [atmoTouched, setAtmoTouched] = useState(false);
  const [atmoOpen, setAtmoOpen] = useState(false);

  const handleTempChange = (val) => { setAtmoTouched(true); setTempF(val); };
  const handlePressChange = (val) => { setAtmoTouched(true); setPressInHg(val); };

  const result = useMemo(() => {
    const mv = num(muzzleVelocity);
    const d = num(distanceYd);
    const tF = num(tempF);
    const pH = num(pressInHg);
    if (!(mv > 0) || !(d > 0) || !Number.isFinite(tF) || !Number.isFinite(pH)) return null;

    if (mode === "Downrange velocity") {
      const tv = num(targetVelocity);
      if (!(tv > 0)) return null;
      return bcFromVelocity({ muzzleVelocity: mv, targetVelocity: tv, distanceYd: d, dragModel, tempF: tF, pressInHg: pH });
    }
    const t = num(targetTimeSec);
    if (!(t > 0)) return null;
    return bcFromTimeOfFlight({ muzzleVelocity: mv, targetTimeSec: t, distanceYd: d, dragModel, tempF: tF, pressInHg: pH });
  }, [muzzleVelocity, distanceYd, dragModel, mode, targetVelocity, targetTimeSec, tempF, pressInHg]);

  const disp = (raw, category) => {
    const n = parseFloat(raw);
    return Number.isFinite(n) ? `${formatDisplay(n, category, system)} ${unitSuffix(category, system)}` : null;
  };
  const atmoSummary = [disp(tempF, "temperature"), disp(pressInHg, "pressure")].filter(Boolean).join("  ·  ");
  const summaryStyle = {
    margin: "-6px 0 8px 32px", font: "500 12px/1.5 'IBM Plex Sans',sans-serif",
    color: C.muted, fontVariantNumeric: "tabular-nums",
  };
  const atmoNote = atmoTouched
    ? `at ${atmoSummary}`
    : `assuming standard atmosphere (${atmoSummary})`;

  return (
    <div>
      <BackLink onClick={onBack} />

      <p style={{ marginTop: 0, marginBottom: 16, font: "400 12.5px/1.5 'IBM Plex Sans',sans-serif", color: C.muted }}>
        Back-solve a bullet's real ballistic coefficient from your own chronograph data, instead of
        trusting the box's published number. Enter your muzzle velocity and the distance to a second
        reading, then whichever of downrange velocity or time of flight you actually measured.
      </p>

      <UnitField label="Muzzle velocity" category="velocity" value={muzzleVelocity} onChange={setMuzzleVelocity} />
      <UnitField label="Distance to second reading" category="distance" value={distanceYd} onChange={setDistanceYd} />

      <div style={{ marginBottom: 14 }}>
        <span style={{ ...label, display: "block", marginBottom: 5 }}>Drag model</span>
        <Segmented options={["G1", "G7"]} value={dragModel} onChange={setDragModel} />
        <div style={{ margin: "5px 0 0", font: "400 12px/1.5 'IBM Plex Sans',sans-serif", color: C.muted }}>
          Solve under whichever model (G1 or G7) you'll actually use this BC with afterward — a BC is
          only meaningful paired with the drag model it was solved under.
        </div>
      </div>

      <div style={{ marginBottom: 14 }}>
        <span style={{ ...label, display: "block", marginBottom: 5 }}>What did you measure?</span>
        <Segmented options={["Downrange velocity", "Time of flight"]} value={mode} onChange={setMode} />
      </div>

      {mode === "Downrange velocity" ? (
        <UnitField label="Downrange velocity" category="velocity" value={targetVelocity} onChange={setTargetVelocity} />
      ) : (
        <Field label="Time of flight" value={targetTimeSec} onChange={setTargetTimeSec} suffix="sec" />
      )}

      <StepHead eyebrow="Optional" name="Atmosphere" open={atmoOpen} onToggle={() => setAtmoOpen((o) => !o)} />
      {atmoOpen ? (
        <>
          <UnitField label="Temperature" category="temperature" value={tempF} onChange={handleTempChange} />
          <UnitField
            label="Station pressure"
            hint="Absolute pressure where you are standing, not sea-level corrected."
            category="pressure"
            value={pressInHg}
            onChange={handlePressChange}
          />
        </>
      ) : (
        <div style={summaryStyle}>{atmoSummary}</div>
      )}

      {result && (result.ok ? (
        <div style={{ background: C.card, border: `1.5px solid ${C.rule}`, padding: 16, margin: "20px 0 16px" }}>
          <div style={label}>Ballistic coefficient</div>
          <div style={{ font: "700 28px 'IBM Plex Mono',monospace", color: C.ink, margin: "4px 0 6px" }}>
            {result.ballisticCoefficient.toFixed(3)}{" "}
            <span style={{ font: "500 14px 'Oswald',sans-serif", color: C.muted }}>{dragModel}</span>
          </div>
          <div style={{ font: "400 12px/1.5 'IBM Plex Sans',sans-serif", color: C.muted }}>
            Chrono-measured from your own data, not a catalog figure — {atmoNote}.
          </div>
        </div>
      ) : (
        <div style={{ marginTop: 20 }}>
          <Notice tone={C.ox} title="Couldn't solve">{result.reason}</Notice>
        </div>
      ))}
    </div>
  );
}

function BackLink({ onClick }) {
  return (
    <button
      onClick={onClick}
      style={{ display: "block", background: "none", border: "none", padding: 0, marginBottom: 14,
               cursor: "pointer", color: C.steel, textDecoration: "underline",
               font: "600 11px 'IBM Plex Sans',sans-serif" }}
    >
      ← Handloader's Tools
    </button>
  );
}
