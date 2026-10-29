import React, { useState } from "react";
import { C } from "./theme.js";
import { Notice } from "./ui.jsx";

const KEY = "bullet-in-flight:introDismissed";

const read = () => {
  try { return localStorage.getItem(KEY) === "1"; } catch { return false; }
};

/**
 * One-time orientation above the Calculator for someone who has never used
 * it. The page opens on an example load so there's an answer to look at
 * straight away -- which is also why it has to say the numbers are an example,
 * not theirs. Dismissed once, remembered on this device.
 */
export default function IntroStrip() {
  const [dismissed, setDismissed] = useState(read);
  if (dismissed) return null;

  const dismiss = () => {
    try { localStorage.setItem(KEY, "1"); } catch { /* private mode -- hides for this visit only */ }
    setDismissed(true);
  };

  return (
    <Notice tone={C.steel} title="New here?">
      This page opens on an example (a 30-06 Remington load) so you can see how it works. To get your own
      answer, pick your ammo in step 1, check your sight height and zero in step 2, and set how far out you
      want in step 4. Your answer is the sentence at the top of the results, beside the form or below it on a
      phone. The target, air and wind steps have sensible defaults.
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
