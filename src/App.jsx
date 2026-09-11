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
const Help = lazy(() => import("./Help.jsx"));

// Maps the main tab switcher's value to the Help tab's matching section id,
// for the contextual "How does this page work?" link below the switcher.
const HELP_SECTION_BY_TAB = {
  Calculator: "calculator",
  Compare: "compare",
  "Optimal Zero": "optimal-zero",
  Recoil: "recoil",
};

// Landing-page deep links -- `#tab/compare` opens straight to a tab,
// `#help/faq` opens Help scrolled to a section (any TOC id from Help.jsx:
// calculator/compare/optimal-zero/recoil/faq/submit). Slugs, not the tab
// switcher's own display strings, so a URL never has to carry a space.
// This is NOT a router: read once on first mount only, for a link landing
// from the user guide or a shared URL -- navigating inside the app never
// touches the hash again, and there's no back-button/history integration.
// An unrecognized or missing hash falls back to today's default (silently
// -- a stale/typo'd link should still open the app, not show an error).
const TAB_SLUG = {
  calculator: "Calculator",
  compare: "Compare",
  "optimal-zero": "Optimal Zero",
  recoil: "Recoil",
  help: "Help",
};

function initialRouteFromHash() {
  const [kind, ...rest] = window.location.hash.replace(/^#/, "").split("/");
  const arg = rest.join("/");
  if (kind === "help") return { tab: "Help", helpTarget: arg ? { id: arg, key: Date.now() } : null };
  if (kind === "tab" && TAB_SLUG[arg]) return { tab: TAB_SLUG[arg], helpTarget: null };
  return { tab: "Calculator", helpTarget: null };
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
