import React, { Suspense, lazy, useState } from "react";
import { C } from "./components/theme.js";
import { Segmented } from "./components/ui.jsx";
import { UnitsProvider, useUnits } from "./UnitsContext.jsx";
import { AuthProvider } from "./AuthContext.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import AuthPanel from "./components/AuthPanel.jsx";

// Calculator is the landing tab — keep it in the initial bundle. The other
// four are split out and fetched on first visit to each, so their code
// (and the catalog data Recoil/Optimal Zero pull in) isn't parsed for a
// visitor who never opens them.
import Calculator from "./Calculator.jsx";
const Compare = lazy(() => import("./Compare.jsx"));
const OptimalZero = lazy(() => import("./OptimalZero.jsx"));
const Recoil = lazy(() => import("./Recoil.jsx"));
const BulletEnergy = lazy(() => import("./BulletEnergy.jsx"));
const HandloaderTools = lazy(() => import("./HandloaderTools.jsx"));
const Help = lazy(() => import("./Help.jsx"));

// Maps the main tab switcher's value to the Help tab's matching section id,
// for the contextual "How does this page work?" link below the switcher.
// Handloader's Tools points at one shared section covering the hub and its
// one tool together -- split into per-tool sections once there's enough
// content on that page that sharing it reads as cluttered (UX Review/
// UserGuide's call), same "grow with content" logic as the hub's own nav.
const HELP_SECTION_BY_TAB = {
  Calculator: "calculator",
  Compare: "compare",
  "Optimal Zero": "optimal-zero",
  Recoil: "recoil",
  "Bullet Energy": "bullet-energy",
  "Handloader's Tools": "handloader-tools",
};

// Landing-page deep links -- `#tab/compare` opens straight to a tab,
// `#help/faq` opens Help scrolled to a section (any TOC id from Help.jsx:
// calculator/compare/optimal-zero/recoil/bullet-energy/handloader-tools/
// faq/submit). Slugs, not the tab switcher's own display strings, so a URL
// never has to carry a space. This is NOT a router: read once on first
// mount only, for a link landing from the user guide or a shared URL --
// navigating inside the app never touches the hash again, and there's no
// back-button/history integration. An unrecognized or missing hash falls
// back to today's default (silently -- a stale/typo'd link should still
// open the app, not show an error).
//
// Handloader's Tools nests one optional extra segment for its own hub --
// `#tab/handloader-tools` lands on the tool grid, `#tab/handloader-tools/
// bc-from-chrono` opens a specific tool directly. Still read-once-on-mount,
// still silently falls back (an unrecognized tool id just lands on the
// grid) -- a minimal, consistent extension of the same scheme rather than a
// new one (UX Review's call).
const TAB_SLUG = {
  calculator: "Calculator",
  compare: "Compare",
  "optimal-zero": "Optimal Zero",
  recoil: "Recoil",
  "bullet-energy": "Bullet Energy",
  "handloader-tools": "Handloader's Tools",
  help: "Help",
};

function initialRouteFromHash() {
  const [kind, ...rest] = window.location.hash.replace(/^#/, "").split("/");
  if (kind === "help") {
    const arg = rest.join("/");
    return { tab: "Help", helpTarget: arg ? { id: arg, key: Date.now() } : null, handloaderTool: null };
  }
  if (kind === "tab" && TAB_SLUG[rest[0]]) {
    const tab = TAB_SLUG[rest[0]];
    const handloaderTool = tab === "Handloader's Tools" && rest[1] ? rest[1] : null;
    return { tab, helpTarget: null, handloaderTool };
  }
  return { tab: "Calculator", helpTarget: null, handloaderTool: null };
}

export default function App() {
  return (
    <ErrorBoundary>
      <UnitsProvider>
        <AuthProvider>
          <AppShell />
        </AuthProvider>
      </UnitsProvider>
    </ErrorBoundary>
  );
}

function AppShell() {
  const [tab, setTab] = useState(() => initialRouteFromHash().tab);
  const [helpTarget, setHelpTarget] = useState(() => initialRouteFromHash().helpTarget);
  const [handloaderTool, setHandloaderTool] = useState(() => initialRouteFromHash().handloaderTool);
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
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12,
                         flexWrap: "wrap", borderBottom: `2px solid ${C.ink}`, paddingBottom: 8, marginBottom: 16 }}>
          <div>
            <h1 style={{ margin: 0, font: "700 30px/1 'Oswald',sans-serif", textTransform: "uppercase" }}>
              The Ballistic Nerd
            </h1>
            <p style={{ margin: "4px 0 0", font: "400 11.5px 'IBM Plex Sans',sans-serif", color: C.muted }}>
              Point-mass trajectory. Heights are measured from the line of sight, so the bullet starts
              one sight height low, rises through the near zero, and falls back through the far zero.
            </p>
          </div>
          <div style={{ paddingTop: 6 }}>
            <AuthPanel />
          </div>
        </header>

        <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: tab === "Help" ? 16 : 8 }}>
          {/* 720, not 580 -- 7 tabs now share this row (was 6), and 580 was
              already sized for 6. Bumped again the same way it was bumped to
              580 last time -- see UX Review's own heads-up when Handloader's
              Tools was scoped that this would need another pass eventually
              (flagged non-blocking, not a reason to change that plan -- the
              whole point of the hub is keeping tools like this OFF the bar,
              which still holds; the count just keeps growing on its own
              regardless).
              `bif-main-tabs` -- 7 labels at 11px overflows a 375px viewport
              by a few pixels (UX Review caught this live, scrollWidth 379 vs
              clientWidth 375). Shrunk via styles.css's own mobile breakpoint
              rather than a bigger maxWidth here or a change to Segmented's
              shared default -- every other Segmented usage in the app is a
              short 2-4-option toggle that already fits at any width, so this
              stays scoped to just this one switcher instead of touching a
              component six other call sites also render. */}
          <div className="bif-main-tabs" style={{ maxWidth: 720, flex: 1, minWidth: 300 }}>
            <Segmented
              options={["Calculator", "Compare", "Optimal Zero", "Recoil", "Bullet Energy", "Handloader's Tools", "Help"]}
              value={tab}
              onChange={(v) => {
                if (v === "Help") setHelpTarget(null);
                if (v === "Handloader's Tools") setHandloaderTool(null);
                setTab(v);
              }}
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
            {/* Real navigation (a static page at /guide/, not app state), so
                an <a> here instead of the in-app HelpLink button -- opens in
                its own tab rather than replacing the app. */}
            <a
              href="/guide/"
              target="_blank"
              rel="noopener"
              style={{ color: C.steel, textDecoration: "underline",
                       font: "500 11.5px 'IBM Plex Sans',sans-serif" }}
            >
              Field Guide ↗
            </a>
          </div>
        )}

        {/* Keyed by tab so a throw in one view is contained there and clears
            when you switch away — a broken Compare can't take Calculator or
            your saved data down with it. Suspense covers the lazy chunks;
            a failed chunk fetch throws and the boundary catches it. */}
        <ErrorBoundary key={tab} label={tab}>
          <Suspense fallback={<TabLoading />}>
            {tab === "Calculator" ? <Calculator />
              : tab === "Compare" ? <Compare />
              : tab === "Optimal Zero" ? <OptimalZero />
              : tab === "Recoil" ? <Recoil />
              : tab === "Bullet Energy" ? <BulletEnergy />
              : tab === "Handloader's Tools" ? (
                  <HandloaderTools
                    tool={handloaderTool}
                    onOpenTool={setHandloaderTool}
                    onBackToHub={() => setHandloaderTool(null)}
                  />
                )
              : <Help scrollTarget={helpTarget} />}
          </Suspense>
        </ErrorBoundary>
      </div>
    </div>
  );
}

// Shown for the fraction of a second a lazy tab chunk takes to arrive on
// first visit. Deliberately minimal — a spinner would flash and be gone.
function TabLoading() {
  return (
    <div style={{ padding: "40px 4px", font: "400 12px 'IBM Plex Sans',sans-serif", color: C.muted }}>
      Loading…
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
