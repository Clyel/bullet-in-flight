import React, { useState } from "react";
import { C } from "./components/theme.js";
import { Segmented } from "./components/ui.jsx";
import { UnitsProvider, useUnits } from "./UnitsContext.jsx";
import Calculator from "./Calculator.jsx";
import Compare from "./Compare.jsx";

export default function App() {
  return (
    <UnitsProvider>
      <AppShell />
    </UnitsProvider>
  );
}

function AppShell() {
  const [tab, setTab] = useState("Calculator");
  const { system, setSystem } = useUnits();

  return (
    <div style={{ minHeight: "100%", background: C.field, padding: "18px 14px 40px", color: C.ink }}>
      <div className="bif-wrap">
        <header style={{ borderBottom: `2px solid ${C.ink}`, paddingBottom: 8, marginBottom: 16 }}>
          <h1 style={{ margin: 0, font: "700 30px/1 'Oswald',sans-serif", textTransform: "uppercase" }}>
            Bullet in Flight
          </h1>
          <p style={{ margin: "4px 0 0", font: "400 11.5px 'IBM Plex Sans',sans-serif", color: C.muted }}>
            Point-mass trajectory. Heights are measured from the line of sight, so the bullet starts
            one sight height low, rises through the near zero, and falls back through the far zero.
          </p>
        </header>

        <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
          <div style={{ maxWidth: 280, flex: 1, minWidth: 200 }}>
            <Segmented options={["Calculator", "Compare"]} value={tab} onChange={setTab} />
          </div>
          <div style={{ maxWidth: 200 }}>
            <Segmented
              options={["Imperial", "Metric"]}
              value={system === "metric" ? "Metric" : "Imperial"}
              onChange={(v) => setSystem(v === "Metric" ? "metric" : "imperial")}
            />
          </div>
        </div>

        {tab === "Calculator" ? <Calculator /> : <Compare />}
      </div>
    </div>
  );
}
