import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./styles.css";

// A deploy can land while someone already has the page open -- their loaded
// index.html points at chunk files by content hash (every tab but Calculator
// is its own lazy-loaded chunk, see App.jsx), and switching to a tab whose
// chunk the new deploy replaced with a different hash 404s the fetch. Vite
// fires this event for exactly that case (its own designed hook, not
// something bolted on here) instead of leaving a raw unhandled rejection for
// ErrorBoundary's generic "this view failed" card to catch. A fresh load
// picks up the current index.html/hashes and fixes it, so this reloads once
// automatically rather than making someone notice the error and click
// reload themselves. Guarded to at most once per tab (sessionStorage
// survives the reload) so a genuinely offline/broken fetch doesn't loop.
window.addEventListener("vite:preloadError", () => {
  if (sessionStorage.getItem("bif-reloaded-for-stale-chunk")) return;
  sessionStorage.setItem("bif-reloaded-for-stale-chunk", "1");
  window.location.reload();
});

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
