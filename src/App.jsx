import React, { useState } from "react";
import { C } from "./components/theme.js";
import { Segmented } from "./components/ui.jsx";
import { UnitsProvider, useUnits } from "./UnitsContext.jsx";
import Calculator from "./Calculator.jsx";
import Compare from "./Compare.jsx";
import OptimalZero from "./OptimalZero.jsx";
import Recoil from "./Recoil.jsx";
import Help from "./Help.jsx";

// Maps the main tab switcher's value to the Help tab's matching section id,
// for the contextual "How does this page work?" link below the switcher.
const HELP_SECTION_BY_TAB = {
  Calculator: "calculator",
  Compare: "compare",
  "Optimal Zero": "optimal-zero",
  Recoil: "recoil",
};

export default function App() {
  return (
    <UnitsProvider>
      <AppShell />
    </UnitsProvider>
  );
}

function AppShell() {
  const [tab, setTab] = useState("Calculator");
  const [helpTarget, setHelpTarget] = useState(null);
  const { system, setSystem } = useUnits();

  // `key` (not just `id`) so clicking the same help link twice in a row
  // still re-scrolls — Help.jsx's effect keys off the whole object, and an
  // unchanged id string wouldn't retrigger it on its own.
  const goToHelp = (id) => {
    setHelpTarget({ id, key: Date.now() });
    setTab("Help");
  };

  return (
    <div className="app-shell" style={{ minHeight: "100%", background: C.field, padding: "18px 14px 40px", color: C.ink }}>
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

        <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: tab === "Help" ? 16 : 8 }}>
          <div style={{ maxWidth: 460, flex: 1, minWidth: 300 }}>
            <Segmented
              options={["Calculator", "Compare", "Optimal Zero", "Recoil", "Help"]}
              value={tab}
              onChange={(v) => { if (v === "Help") setHelpTarget(null); setTab(v); }}
            />
          </div>
          <div style={{ maxWidth: 200 }}>
            <Segmented
              options={["Imperial", "Metric"]}
              value={system === "metric" ? "Metric" : "Imperial"}
              onChange={(v) => setSystem(v === "Metric" ? "metric" : "imperial")}
            />
          </div>
        </div>

        {tab !== "Help" && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 16px", marginBottom: 16 }}>
            <HelpLink onClick={() => goToHelp(HELP_SECTION_BY_TAB[tab])}>How does {tab} work?</HelpLink>
            <HelpLink onClick={() => goToHelp("faq")}>FAQ</HelpLink>
            <HelpLink onClick={() => goToHelp("submit")}>Suggest an idea</HelpLink>
          </div>
        )}

        {tab === "Calculator" ? <Calculator />
          : tab === "Compare" ? <Compare />
          : tab === "Optimal Zero" ? <OptimalZero />
          : tab === "Recoil" ? <Recoil />
          : <Help scrollTarget={helpTarget} />}
      </div>
    </div>
  );
}

function HelpLink({ onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{ background: "none", border: "none", cursor: "pointer", padding: 0,
               color: C.steel, textDecoration: "underline",
               font: "500 11.5px 'IBM Plex Sans',sans-serif" }}
    >
      {children}
    </button>
  );
}
