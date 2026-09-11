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

**Shipped 2026-09-11 (in `main`, deployed, verified on ballisticnerd.com):**
- **Calculator Step 1 declutter + sensible defaults** (PR #19, 5 changes from a UX
  Review spec, confirmed with Jake before each batch):
  1. Fused load lock — muzzle velocity + bullet weight + BC/drag-model collapse
     into one locked summary line once a catalog/saved load resolves ("172gr @
     2825 fps · G7 0.265 — Remington's published data [Override]"), replacing
     4 redundant places that used to show the same numbers. `CommercialLoadPicker`'s
     "Filled in:" chip dropped (was only ever shown by InputPanel). Collateral fix:
     `LoadIdentity`'s "Custom load" subtitle no longer hardcodes "fps" in Metric.
  2. First-time visitors get Steps 2-6 collapsed, Step 1 open — `useCollapsibleSteps`
     gains a `defaultCollapsed` param, seeded only when the storage key has never
     been written.
  3. Chart's 3 toggles get a "Chart overlays" label; Vitals Zero + Optimal Sight-in
     default on (Leupold BAS stays off).
  4. MOA/MIL toggle row above the range table gets a "Range" header, mirroring the
     chart's own title+toggles pattern.
  5. "Name this load" suggests a name instead of starting blank — the catalog
     identity string, or (once solved) `describeLoad(v, system)` for a hand-typed
     load, live-updating, stopping the moment you type your own (`nameTouched`,
     same pattern as `chargeTouched`/`rigTouched`). Caution styling + escape-hatch
     note if an unreviewed suggestion would silently overwrite an existing saved
     name. New shared `src/describeLoad.js` (was 3 copies of the same unit-aware
     formatting). Real footgun caught during live-testing, not shipped as specced:
     letting plain "Load a saved dataset" re-arm the suggester would auto-fill a
     name that doesn't have to match the dataset's real saved name — fixed by
     having plain Load blank the name instead (matching its pre-existing behavior),
     while Edit still pre-fills the real name, guarded.
- **Field Guide** (PR #18) — a standalone companion page to the in-app Help tab,
  live at `ballisticnerd.com/guide/`: every tool with real screenshots, a jargon
  glossary, common trip-ups, an FAQ. Plain HTML+CSS+JS in `public/guide/`, no
  framework/build step/dependency beyond the Google Fonts CDN the app already
  uses — Vite copies `public/` verbatim, so it needed zero `vite.config.js` or
  routing changes. Content built by the "UserGuide" session (reviewed in full
  before merge — technical claims fact-checked against this repo's own README,
  e.g. the accuracy-table FAQ answer matches README's Accuracy table exactly).
  Linked from the app two ways (placement per the UX Review session): "Field
  Guide ↗" as a 4th item in the per-tab link row on every non-Help tab, and a
  `Notice` callout above Help's own TOC (which hides that row). Both real
  `<a target="_blank">`s, not in-app navigation — a same-tab click would unmount
  the whole SPA.
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
