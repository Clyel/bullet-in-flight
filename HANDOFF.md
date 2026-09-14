# bullet-in-flight — working notes

Read `README.md` first — it documents the physics, the architecture boundary, and
what's built. Then read `src/ballistics/solver.js` and `src/ballistics/vitalsWindow.js`.
`CODE-REVIEW.md` and `UX-REVIEW.md` cover the two big review passes. Verify the baseline
before changing anything: `npm install`, then `npm test` should print "All checks
passed"; if it doesn't, something is wrong with the environment, not the code.

## What this is

A point-mass exterior ballistics calculator, live at https://ballisticnerd.com.
**Calculator** (single load, range table + trajectory chart, spin drift/Coriolis under
an Advanced section), **Compare** (overlay saved loads), **Optimal Zero** (compare the
optimal zero across many catalog rounds or saved loads against one shared rig),
**Recoil** (free-recoil-energy comparison), **Bullet Energy** (quick multi-row muzzle
energy comparison), **Handloader's Tools** (a hub, currently one tool: BC from
Chronograph), **Help**. Auto-deploys to GitHub Pages on every push to `main`.

## What is already done and working

Original v1 scope, all shipped: solver (forward Euler, 0.25ms steps, secant-iterated
zeroing), wind deflection (3D relative-velocity), Imperial/Metric unit switching,
MOA/MIL correction columns, Saved Datasets (localStorage per device, plus Supabase
cloud sync when signed in), Compare tab.

Built since: a ~1,850-entry commercial ammo catalog across twelve manufacturers
(Remington, Winchester, Nosler, Norma, Barnes, Federal, Hornady, Weatherby, Berger, Browning, Lapua, Sig Sauer; BC back-calculated from the
manufacturer's own published data where they don't state one — see
`scripts/deriveBC.mjs`), a single-search catalog picker (see below),
per-load vitals-zone radius + a "vitals window" readout and an "Optimal Zero" solve
for the zero that maximizes it, the Optimal Zero comparison tab, the Recoil tab
(SAAMI free recoil energy), the Bullet Energy tab (quick multi-row muzzle-energy
comparator), spin drift and Coriolis (Calculator's collapsed Advanced section),
the Handloader's Tools hub with BC from Chronograph (back-solve a real BC from a
shooter's own chronograph data), a printable dope chart, a Compare comparison table,
the Help/FAQ tab, Supabase-backed accounts, GitHub Pages hosting, the React 18→19
toolchain bump, and the code-review pass (dependency-free SVG charts, Optimal Zero
Web Worker, bundle split, error boundary — see `CODE-REVIEW.md`).

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
   Barnes, Berger, Nosler, Browning, Norma, Lapua) all landed 2026-09-10; Sig
   Sauer landed 2026-09-13 (PR #27, see below) — twelve manufacturers, ~1,850
   loads. What's left is tiny or hard: budget brands (PPU/Fiocchi/S&B) with
   thin BC data. Buffalo Bore was checked and skipped (publishes no BC
   anywhere). CCI is rimfire-only — out of scope without a rimfire section.
   Catalog chunk is ~360 KB / 33 KB gzip; a compact encoding or lazy-load is
   the move if it keeps growing much.
   Federal is already in. Each add: a raw-harvest script + (if BC isn't published) a
   derive script, then the cartridge-name normalization pass before merge.
2. Deferred UX items (from the 2026-09-09 UX pass) — **all shipped:** collapse-
   filled-sections pass (PR #15), "add a round to Compare" from the empty
   state (PR #14), cloud sync for the shared "My rig" (PR #16, all
   2026-09-10), and the flattened/searchable catalog picker (PR #29,
   2026-09-13, see below) — item #7 from the original review, picked back up
   once the catalog grew large enough to justify the full rebuild Jake
   deferred at the time.
3. React 18 → 19 — **shipped 2026-09-13 (PR #26, see below).**
4. **Main tab switcher's mobile scaling has a ceiling.** PR #25 (Handloader's
   Tools) fixed a real 375px overflow by shrinking the switcher's font below
   a 400px breakpoint (`.bif-main-tabs` in styles.css) — the third size-based
   patch to this switcher after the 460→580 and 580→720 `maxWidth` bumps
   before it. UX Review's read when this was fixed: another one-off patch
   like this probably won't hold once an 8th tab lands — worth a real
   responsive nav pattern at that point (e.g. wrapping to two rows, an
   overflow/"more" menu) instead of chasing it with another number. Not
   urgent — flagging it now so it's a planned decision next time, not one
   made under time pressure.

The original roadmap's last physics item (spin drift + Coriolis) shipped
2026-09-13 — see below. Every item in this list has now shipped; nothing is
currently pending here beyond item #4's flagged-for-later responsive-nav
follow-up.

**Shipped 2026-09-13/14 (in `main`, deployed, verified on ballisticnerd.com):**
- **Catalog picker rebuilt as one flattened search box** (PR #29) — UX-REVIEW.md item
  #7's full rebuild, picked back up once the catalog grew from 855 to ~1,852 loads / 8
  to 12 manufacturers (exactly the growth the original pitch bet would eventually
  justify it). Replaces the three-select Caliber → Manufacturer → Load cascade with one
  search box over the whole flattened catalog; caliber/manufacturer survive as
  optional, additive filter chips instead of mandatory sequential steps.
  `onSelect(ammo)` contract unchanged — none of the 5 existing call sites (Calculator,
  Compare, Optimal Zero, Recoil, Bullet Energy) needed touching. Hand-rolled relevance
  scoring (no new dependency): a query match at the start of the cartridge name
  outranks a start-match on manufacturer/bullet, which outranks any mid-string hit;
  every typed token must match something (AND across tokens). Capped to top 40
  results; a live count only shows past 20 matches. One shared row renderer behind two
  shells — desktop inline popover, mobile full-screen sheet with autofocus + a
  persistent Cancel button. Each result's accessible name is one well-formed string
  covering every field (screen readers can't perceive the two-line visual layout),
  derived-BC labeling included. Auto-advance-on-one-option needed no special code — it
  falls out of the search paradigm for free. Tagged `pre-catalog-picker-rebuild` on the
  pre-rebuild commit as an explicit rollback point before starting, per Jake's ask.
  UX Review's pass caught two real issues, both fixed before merge: (1) Compare.jsx had
  two separate `return` statements (empty-state vs. populated-state) both rendering the
  same `CommercialLoadPicker` JSX — two structurally different trees meant React
  couldn't preserve the picker's identity across the 0→1 saved-datasets transition, so
  a brand-new user's very first catalog pick silently lost its "Added: ..." confirmation
  and refocus-for-next-search. Restructured to one consistent tree. (2) The small
  "+ Caliber filter"/"+ Manufacturer filter" chip-adders had no arrow-key navigation —
  brought up to the same combobox/listbox ARIA pattern the main search box already had.
- **Two production fixes folded into the same PR**, both flagged directly by Jake while
  reviewing: (1) a stale-deploy-chunk error ("Failed to fetch dynamically imported
  module") on Compare, from a deploy landing while someone already had the page open —
  `main.jsx` now listens for Vite's own `vite:preloadError` event and reloads once
  automatically (sessionStorage-guarded against looping; falls through to the existing
  ErrorBoundary if a reload genuinely doesn't fix it — UX Review verified this exact
  layered behavior by actually renaming a built chunk file to force a real 404). (2)
  Compare hardcoded every catalog-added dataset's `maxRangeYd` at 500 with no field to
  override it, so comparing at long-range distances silently showed "beyond this load's
  charted distance" — bumped to 1500, matching Calculator's own existing zeroRangeYd
  sanity-check ceiling.
- **Field Guide kept current across tonight's ships** (PRs #28, #30, #31, all content-
  only, maintained by the "UserGuide" peer session, reviewed and merged by this one):
  catalog stats (1,800+/11 → 1,850+/12, PR #28); Quick Start step 1 and the tool-list
  screenshot rewritten for the search-box picker rebuild, the now-obsolete "third
  dropdown" trip-up note removed rather than patched (PR #30); a new Handloader's
  Tools card, screenshot, glossary entry, and FAQ entry on chrono-measured vs. derived
  BC (PR #31). Every image and numeric claim was independently re-verified before
  merge, not just visually skimmed — e.g. PR #31's round-trip screenshot (this guide's
  own recurring 30-06 example fed back into BC from Chronograph, solving back to its
  real 0.265 G7) was re-run through `bcFromVelocity()` directly to confirm the number,
  not just eyeballed.
- **React 18 → 19** (PR #26) — the toolchain item from "What remains." No app code
  changes needed (already on `createRoot`/`StrictMode`, zero `propTypes`/
  `defaultProps`/`forwardRef`/`findDOMNode` usage anywhere), so none of React 19's
  actual breaking changes applied here. `@vitejs/plugin-react` stayed on 5.x and vite
  itself untouched, so this didn't drag in a vite major. Verified every tab live under
  the new version, including a live BC-from-chronograph solve and the print-dope-chart
  portal (`createPortal` onto `document.body`) — zero console warnings. One tradeoff on
  the record: the main JS chunk grew ~23 KB gzip under React 19.
- **Sig Sauer added to the commercial ammo catalog** (PR #27) — the last "more
  manufacturers" item. 52 rifle entries across 12 cartridges (223 Rem, 5.56 NATO,
  22-250 Rem, 243 Win, 6mm/6.5 Creedmoor, 270 Win, 277 SIG Fury — new to the catalog,
  300 AAC Blackout, 308 Win, 30-06, 300 Win Mag, 7mm Rem Mag), all published G1 BC. The
  2020 chart the original note pointed at really was image-only ("needs OCR"), but
  sigsauer.com/ballistics now links a 2024 edition with a real text layer instead — no
  OCR needed after all, just `scripts/sig_raw.py` (a line-based parser for its two
  field orders) + `scripts/buildSig.mjs`. Two real bugs in Sig's own PDF were caught
  and corrected rather than trusted: the VENARI (Soft Point) table's printed caliber
  name is wrong for all 8 of its rows (confirmed via SKU prefix + embedded weight +
  physical plausibility all agreeing), and one row's (5.56mm) summary velocity column
  disagrees with its own detailed velocity table by 66fps (used the detailed table —
  see `commercialAmmo.js`'s header comment for the full writeup). Cross-validated a
  corrected row against Sig's own published downrange velocity: this app's solver
  lands within 10fps of it, not just internally consistent with the correction.
  Catalog now ~1,850 entries across twelve manufacturers; ~360 KB / 33.6 KB gzip.
- **Handloader's Tools hub + BC from Chronograph** (PR #25) — a gap identified after
  JBM Ballistics shut down: back-solve a bullet's real ballistic coefficient from a
  shooter's own chronograph data (downrange velocity or time of flight) instead of
  trusting the box's published number. New top-level **Handloader's Tools** tab,
  deliberately a hub (card grid) rather than a flat tool tab, to keep tools aimed at
  handloaders off the main bar as more land there over time — always opens to the
  grid, never skips straight into the lone tool, so behavior can't silently change the
  day a second tool ships. Nested hash routes (`#tab/handloader-tools`, `#tab/
  handloader-tools/bc-from-chrono`). `src/ballistics/bcFromChrono.js` wraps the
  already-validated `integrate()`/`sampleAt()` in a direction-agnostic bisection root-
  find — zero new force physics, so no independent fixtures, but new *logic* with its
  own way to be subtly wrong, validated instead by round-trip self-consistency in
  `test/solver.test.mjs` (forward-solve a known BC, invert-solve the synthetic
  measurement, recover the same BC — same treatment `vitalsWindow.js`'s
  `optimalSightIn()` got). The solver verifies its own residual actually zeros before
  returning an answer rather than surfacing a converged-but-off result with false
  confidence, and physically impossible input (downrange velocity ≥ muzzle velocity, a
  time faster than physically possible) is rejected up front with a clear amber
  Notice. Result is labeled "chrono-measured," deliberately not reusing the catalog's
  "derived BC" wording — opposite epistemic cases (derived = no published figure
  exists; chrono-measured = empirical, from the shooter's own rifle) — with its own
  FAQ entry explaining the distinction. Atmosphere defaults to standard (59°F/
  29.92inHg, collapsed) but the result always states which atmosphere it assumed, live,
  the moment either field is touched. UX Review caught a real mobile bug during her
  pass — the main tab switcher (now at 7 tabs) overflowed a 375px viewport by a few
  px — fixed by scoping a font/padding shrink to just that switcher (`.bif-main-tabs`
  in styles.css) rather than touching the shared `Segmented` component or bumping its
  `maxWidth` a fourth time; see "What remains" above for her flagged follow-up.
- **Spin drift and Coriolis effect** (PR #23) — the last item on the original
  physics roadmap. Manual-entry-only twist rate/bullet length/diameter for spin
  drift (bullet length isn't published anywhere in the 1,800-load catalog);
  latitude-only "flat-fire" Coriolis, not full 3D (no azimuth input, no change
  to the RK4 integrator — see below). Both live together in a new "Advanced"
  section at the very bottom of the input panel, collapsed by default even on
  a first visit. New `src/ballistics/spinDrift.js` (Litz gyroscopic
  approximation over the Miller stability coefficient) and
  `src/ballistics/coriolis.js` (closed-form flat-fire horizontal deflection) —
  both verified line-for-line against py-ballisticcalc's own source (same
  reference solver the wind fixtures use) and by hand, with real independent
  fixtures extending `test/fixtures/generate.py`/`reference.json` (not just
  self-consistency checks — these are genuine new physical effects). Both are
  deliberately closed-form corrections composed onto windage *after*
  `solveTrajectory()` runs (in `solveFromForm.js`), not forces integrated into
  `solver.js`'s RK4 loop — the validated integrator is completely untouched.
  Windage column now shows whenever wind OR spin drift OR Coriolis is active
  (`isWindageActive`), not just wind. A real bug was caught and fixed in the
  *existing* wind-fixture test loop while adding these: it was silently
  "passing" on `NaN` comparisons for rows missing certain fields (`NaN >
  threshold` is always `false`) — now explicitly guarded.
- **Bullet Energy tab** (PR #21) — 6th tab, between Recoil and Help. A simple
  multi-row muzzle-energy calculator modeled on the *idea* of a reference site
  Jake liked (larrywillis.com/bullet-energy.html), not its UI: live-calculating
  (not button-triggered), 2 starter rows with add/×-remove (not a fixed grid),
  session-only state (a scratch pad, no saved-loads overlap). Per row: bullet
  weight (gr) + velocity (unit-aware) → energy (unit-aware), "—" while
  incomplete. Zero new physics — calls the existing `energyFtLb()` from
  `src/ballistics/solver.js` directly. Horizontal bar chart once 2+ rows have
  valid data (mirrors Recoil's `RecoilBars` pattern, not shared as a component
  yet — two call sites, not worth extracting). New `src/BulletEnergy.jsx`;
  wired into `App.jsx`'s tab switcher + `HELP_SECTION_BY_TAB`
  + the `#tab/#help` hash-routing slugs (PR #17), and a new Help.jsx section
  (explicitly notes this is *muzzle* energy, not energy at range, per UX
  Review's flagged ambiguity). Caught live before shipping: the tab switcher's
  container (`maxWidth: 460`, sized for 5 tabs) made "Optimal Zero" and the new
  "Bullet Energy" both wrap to two lines while the other four stayed
  single-line — bumped to 580.
- **Bullet Energy catalog picker, Phase 2** (PR #22) — the per-round picker
  deferred when the tab shipped, added on Jake's go. Deliberately not a
  per-row picker (the shape UX Review flagged as fighting the tool's "simple"
  framing) — one `CommercialLoadPicker` above the table, same "picker adds to
  the list" pattern Compare/OptimalZero use. A pick fills the first still-blank
  row rather than always appending (the 2 starter rows get used first), then
  appends once every row has something — manual typing into a row is
  unaffected either way. Help.jsx's section updated to mention it.
- **Field Guide refresh for PR #19** (PR #20) — two screenshots + a few copy
  lines were stale after the Step 1 declutter shipped (fused load lock, default
  collapse, default-on chart overlays, the Range header). Content-only, no app
  code — recaptured by the "UserGuide" session, reviewed and merged by this one.
- **Field Guide refresh for Bullet Energy + spin drift/Coriolis** (PR #24) —
  hero stat 5→6 tools, new Bullet Energy tool card + screenshot, glossary
  entries for twist rate/spin drift/Coriolis, a trip-up note on the Advanced
  section's three-field requirement (leave any one of twist/length/diameter
  blank and spin drift silently stays off), a new FAQ entry on how both
  effects work, and a fix to "What isn't modeled yet?" (previously still
  claimed spin drift/Coriolis weren't modeled). The FAQ's accuracy claim
  (worst-case deviation within 0.01in, tighter than the core trajectory's own
  0.15in) was checked against `node test/solver.test.mjs`'s actual output
  before merging, not just asserted. Content-only, no app code — recaptured by
  the "UserGuide" session, reviewed and merged by this one.

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
