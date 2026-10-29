import React, { useState } from "react";
import { C } from "./theme.js";
import { Notice } from "./ui.jsx";

const KEY = "bullet-in-flight:introDismissed";

// Dismissed, or never needed: anything else this app has stored on this
// device (saved loads, a rig, units, a folded section) means they've used it.
const read = () => {
  try {
    if (localStorage.getItem(KEY) === "1") return true;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith("bullet-in-flight:") && k !== KEY) return true;
    }
    return false;
  } catch {
    return false;
  }
};

/**
 * One-time orientation above the Calculator for someone who has never used
 * it. The page opens on an example load so there's an answer to look at
 * straight away -- which is also why it has to say the numbers are an example,
 * not theirs. Dismissed once, remembered on this device.
 */
export default function IntroStrip({ onDismiss }) {
  const [dismissed, setDismissed] = useState(read);
  if (dismissed) return null;

  const dismiss = () => {
    try { localStorage.setItem(KEY, "1"); } catch { /* private mode -- hides for this visit only */ }
    setDismissed(true);
    // The strip is about to unmount, taking keyboard focus with it.
    onDismiss?.();
  };

  return (
    <Notice tone={C.steel} title="New here?">
      This opens on an example 30-06 load. To get your own answer: pick your ammo, check your zero, then
      read the sentence at the top of the results.
      <div style={{ marginTop: 8 }}>
        <button
          type="button"
          className="bif-tap-link"
          onClick={dismiss}
          style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: C.steel,
                   textDecoration: "underline", font: "600 12px 'IBM Plex Sans',sans-serif" }}
        >
          Got it
        </button>
      </div>
    </Notice>
  );
}
