import React from "react";
import { C } from "./components/theme.js";
import BcFromChrono from "./handloaderTools/BcFromChrono.jsx";

// A hub, not a flat top-level tool -- Jake's own call, to keep tools aimed
// at handloaders (not the average factory-ammo shooter browsing the main
// tab bar) from crowding it as more of them show up over time. One card
// today; add a real sub-nav once there are 2-3 tools to switch between
// instead of building switcher chrome for exactly one item (UX Review's
// call -- the switcher would just look unfinished and need redoing the day
// tool #2 lands anyway).
//
// Clicking the "Handloader's Tools" tab always lands here on the grid, even
// with a single card -- App.jsx resets `tool` to null on every click of the
// top-level tab, rather than skipping straight into the lone tool. A
// skip-when-one/grid-when-many rule would make the tab's own behavior
// silently change out from under users the day a second tool ships.
const TOOLS = [
  {
    id: "bc-from-chrono",
    name: "BC from Chronograph",
    blurb: "Back-solve your bullet's real ballistic coefficient from your own chronograph data, instead of trusting the box.",
  },
];

export default function HandloaderTools({ tool, onOpenTool, onBackToHub }) {
  if (tool === "bc-from-chrono") return <BcFromChrono onBack={onBackToHub} />;
  return <ToolGrid onOpenTool={onOpenTool} />;
}

function ToolGrid({ onOpenTool }) {
  return (
    <div>
      <p style={{ marginTop: 0, marginBottom: 16, font: "400 12.5px/1.5 'IBM Plex Sans',sans-serif", color: C.muted }}>
        Tools for handloaders and anyone chasing more than a factory number — kept off the main tab
        bar so it doesn't get crowded for everyone else.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 }}>
        {TOOLS.map((t) => (
          <button
            key={t.id}
            onClick={() => onOpenTool(t.id)}
            style={{ textAlign: "left", background: C.card, border: `1.5px solid ${C.rule}`, padding: 16,
                     cursor: "pointer", color: "inherit", font: "inherit" }}
          >
            <div style={{ font: "600 15px 'Oswald',sans-serif", color: C.ink, marginBottom: 6 }}>{t.name}</div>
            <div style={{ font: "400 12.5px/1.5 'IBM Plex Sans',sans-serif", color: C.muted }}>{t.blurb}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
