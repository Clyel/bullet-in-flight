// Runs optimalSightIn off the main thread. Each call is a ternary + a
// bisection search, each probe a full re-zero — ~50ms even after the
// allocation-free zeroing pass, so a dozen selected rounds froze the
// Optimal Zero table for the better part of a second on every rig edit.
//
// Pure physics import, zero React — the src/ballistics boundary is exactly
// what makes this safe to run in a worker. Jobs are processed one at a
// time (a worker is still single-threaded); each result is posted back as
// it finishes, so the table fills in progressively.
import { optimalSightIn } from "./vitalsWindow.js";

self.onmessage = (e) => {
  const { gen, key, base, vitalsRadiusIn } = e.data;
  try {
    self.postMessage({ gen, key, result: optimalSightIn(base, vitalsRadiusIn) });
  } catch (err) {
    self.postMessage({ gen, key, error: err.message });
  }
};
