import React from "react";
import { C } from "./theme.js";

/**
 * Catches render/lifecycle errors in its subtree and shows a contained
 * fallback instead of letting them blank the whole page. Used twice in
 * App.jsx: once around the whole shell, and once around the active tab's
 * body keyed by tab name — so a throw in Compare (bad saved record, recharts
 * on a degenerate domain, a solver edge case that NaNs a formatter) leaves
 * Calculator and the user's saved data reachable, and switching tabs clears
 * it. Must be a class — React only exposes error catching via
 * getDerivedStateFromError / componentDidCatch, both class-only.
 */
export default class ErrorBoundary extends React.Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Surface it for anyone with the console open / for a bug report.
    console.error("ErrorBoundary caught:", error, info?.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div style={{ background: C.card, border: `1.5px solid ${C.ox}`, borderLeft: `5px solid ${C.ox}`,
                    padding: 16, marginBottom: 16 }}>
        <div style={{ font: "600 12px 'Oswald',sans-serif", letterSpacing: ".1em",
                      textTransform: "uppercase", color: C.ox }}>
          {this.props.label ? `${this.props.label} hit an error` : "Something went wrong"}
        </div>
        <div style={{ marginTop: 5, font: "400 12.5px 'IBM Plex Sans',sans-serif", color: C.ink }}>
          This view failed to render. Your other tabs and your saved data are unaffected — switch
          tabs, or reload the page to start fresh.
        </div>
        {error?.message && (
          <pre style={{ marginTop: 10, padding: "8px 10px", overflowX: "auto", background: C.field,
                        border: `1px solid ${C.rule}`, font: "400 11px 'IBM Plex Mono',monospace", color: C.muted }}>
            {String(error.message)}
          </pre>
        )}
        <button
          onClick={() => window.location.reload()}
          style={{ marginTop: 10, padding: "7px 14px", background: C.ink, color: C.card, border: "none",
                   cursor: "pointer", font: "600 11px 'Oswald',sans-serif", letterSpacing: ".12em" }}
        >
          Reload the page
        </button>
      </div>
    );
  }
}
