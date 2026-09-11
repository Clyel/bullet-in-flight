# bullet-in-flight — working notes

Read `README.md` first — it documents the physics, the architecture boundary, and
what's built. Then read `src/ballistics/solver.js` and `src/ballistics/vitalsWindow.js`.
`CODE-REVIEW.md` and `UX-REVIEW.md` cover the two big review passes. Verify the baseline
before changing anything: `npm install`, then `npm test` should print "All checks
passed"; if it doesn't, something is wrong with the environment, not the code.

## What this is

A point-mass exterior ballistics calculator, live at
https://clyel.github.io/bullet-in-flight/. Five tabs: **Calculator** (single load,
range table + trajectory chart), **Compare** (overlay saved loads), **Optimal Zero**
(compare the optimal zero across many catalog rounds or saved loads against one
shared rig), **Recoil** (free-recoil-energy comparison), **Help**. Auto-deploys to
GitHub Pages on every push to `main`.

## What is already done and working

Original v1 scope, all shipped: solver (forward Euler, 0.25ms steps, secant-iterated
zeroing), wind deflection (3D relative-velocity), Imperial/Metric unit switching,
MOA/MIL correction columns, Saved Datasets (localStorage per device, plus Supabase
cloud sync when signed in), Compare tab.

Built since: a ~1,800-entry commercial ammo catalog across eleven manufacturers
(Remington, Winchester, Nosler, Norma, Barnes, Federal, Hornady, Weatherby, Berger, Browning, Lapua; BC back-calculated from the
manufacturer's own published data where they don't state one — see
`scripts/deriveBC.mjs`), a cascading Caliber -> Manufacturer -> Load picker,
per-load vitals-zone radius + a "vitals window" readout and an "Optimal Zero" solve
for the zero that maximizes it, the Optimal Zero comparison tab, the Recoil tab
(SAAMI free recoil energy), a printable dope chart, a Compare comparison table, the
Help/FAQ tab, Supabase-backed accounts, GitHub Pages hosting, and the code-review
pass (dependency-free SVG charts, Optimal Zero Web Worker, bundle split, error
boundary — see `CODE-REVIEW.md`).

## Ground rules for working with me

- Confirm each step with me before moving to the next one. Do not chain several
  changes together without checking in.
- Show me full file contents rather than describing edits abstractly.
- If something is ambiguous or you're unsure, flag it and ask rather than guessing.
- Lock schema and architecture before writing code.
- Keep physics in `src/ballistics/` with zero React imports. Components receive a
  solved trajectory and render it. That boundary is what keeps the tests meaningful.
- Any change to the solver must keep `npm test` green. If a change legitimately
  shifts the numbers, say so explicitly and we'll decide whether to regenerate
  fixtures.
- **New physics requires new fixtures generated from an independent source — never
  from your own implementation.** A test built on numbers your own code produced
  proves only that the code is self-consistent; it will pass just as happily when the
  physics is wrong. Reference data must come from a separate solver, published
  tables, or a hand-derivation we work through together. If you cannot obtain an
  independent reference for something, say so before writing the feature rather than
  shipping a test that launders the error. (Logic that's built *on top of* the
  already-validated solver — like `vitalsWindow.js` — isn't new physics and doesn't
  need this, but it does need its own self-consistency check; see
  `test/solver.test.mjs`.)
- Before publishing/deploying (a `git push` to `main` goes live automatically), run
  `npm test` and verify the change live in the browser — this user has caught real
  bugs that only showed up running the app, not reading the code.
- **Large changes get an explicit checkpoint with me before they merge to `main`.**
  A merge to `main` *is* a deploy. CI being green and another agent session having
  reviewed it are not enough on their own. If a change swaps or removes a runtime
  dependency, bumps the build toolchain, changes how the app loads (bundle splitting,
  workers, lazy-loading, routing), touches auth/DB/storage, or spans several files
  across unrelated areas, stop and get my sign-off before merging — don't let it
  reach production on agent review alone. Small, self-contained fixes don't need this.

## What remains

**Features, roughly in priority order:**
1. **More ammo manufacturers — essentially done.** PRs #7-13 (Winchester,
   Barnes, Berger, Nosler, Browning, Norma, Lapua) all landed 2026-09-10 —
   eleven manufacturers, ~1,800 loads, 127 of them G7. What's left is tiny or
   hard: Sig Sauer (image-only PDF, needs OCR), budget brands (PPU/Fiocchi/
   S&B) with thin BC data. Buffalo Bore was checked and skipped (publishes no
   BC anywhere). CCI is rimfire-only — out of scope without a rimfire
   section. Catalog chunk is ~354 KB / 33 KB gzip; a compact encoding or
   lazy-load is the move if it keeps growing much.
   Federal is already in. Each add: a raw-harvest script + (if BC isn't published) a
   derive script, then the cartridge-name normalization pass before merge.
2. **Spin drift and Coriolis** — last on the original roadmap, "after wind is solid"
   — it is now. Needs independent fixtures like wind did.
3. Deferred UX items (from the 2026-09-09 UX pass) — **all shipped 2026-09-10:**
   collapse-filled-sections pass (PR #15), "add a round to Compare" from the
   empty state (PR #14), and cloud sync for the shared "My rig" (PR #16).
   **Still open:** a fully flattened/searchable catalog picker (Jake chose to
   keep the 3 cascading dropdowns with typeahead for now).
4. React 18 → 19.

**Shipped 2026-09-10 (in `main`, deployed, verified on ballisticnerd.com):**
- **Hash-based deep links** (PR #17) — `#tab/<slug>` opens straight to a tab
  (`calculator`/`compare`/`optimal-zero`/`recoil`/`help`), `#help/<id>` opens
  Help scrolled to a TOC section (`calculator`/`compare`/`optimal-zero`/`recoil`/
  `faq`/`submit`). `App.jsx`'s `initialRouteFromHash()` reads the hash once, as
  the `tab`/`helpTarget` `useState` initializers — a landing-page deep link, not
  a router; nothing inside the app ever writes the hash. Missing/unrecognized
  hash falls back to the default (Calculator) silently. Built for the in-progress
  user guide (a separate session, "UserGuide") so its tool cards and glossary
  entries can link straight into the live app.
- **"My rig" cloud sync** (PR #16) — the shared rig (sight height, vitals radius,
  temperature, station pressure, altitude) now syncs through `user_settings`
  (5 nullable `text` columns, migration run against prod) when signed in, instead
  of staying localStorage-only. `storage/myRigCloud.js` + `storage/useMyRig.js`
  (same cache/listener pattern as `useSavedLoads`); first sign-in with an empty
  cloud rig seeds it from local, silently. Calculator/OptimalZero/Compare all go
  through the hook now. Verified live against the real Supabase DB: empty-rig
  seed, edit+save round-trips to the cloud, a second signed-in context adopts the
  cloud rig without re-seeding, sign-out keeps the synced value locally.
- **Compare: add a round from the catalog** (PR #14) — `CommercialLoadPicker` in
  every Compare state including the empty one; the pick is saved as an ammo-only
  dataset (your saved rig, 200 yd zero, 500 yd) and auto-selected into the overlay.
- **Collapsible input sections** (PR #15) — every Calculator Step header folds its
  section to a one-line value summary, persisted per section in `localStorage`;
  "Expand all / Collapse all" at the panel top. `StepHead` gains `open`/`onToggle`;
  new `useCollapsibleSteps` hook + `--c-hover` token. Also closes the sticky-column
  dead-space item.
- **Leupold BAS ballistic-group classification** (`src/ballistics/reticleGroups.js`)
  — classifies a load against the Boone & Crockett / LR Varmint Hunter / Creedmoor
  reticles by drop at 500 yd with a forced 200 yd zero. Off-by-default "Leupold BAS"
  toggle on the trajectory chart. Thresholds from Leupold's BAS manual #55994.
- **Shot-angle hold advisory (rifleman's rule)** (`src/ballistics/inclineComp.js`)
  — `slant × cos(angle)`. "Shot angle" field in Step 4, advisory under the summary
  strip for angles ≥ 5°. Display-only. (Was the old "plain Leupold TBR" item.)
- **Recoil tab: load a saved dataset** as a setup starting point.
- **Calculator results-column scroll fix** (PR #6) — the sticky chart block was
  covering the range table on laptop-height screens once the BAS readout grew it
  past the viewport. Results column is now its own capped scroll region.
- **Winchester catalog** (PR #7) — +252 loads, `scripts/winchester_raw.mjs` +
  `scripts/buildWinchester.mjs`.
