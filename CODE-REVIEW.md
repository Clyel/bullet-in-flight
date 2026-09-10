# Code review — lighter / faster / more dependable

**Reviewer:** engineering pass from a separate Claude Code session, 2026-09-09
**Baseline:** `main` @ `e778c58` (exactly what's live at ballisticnerd.com)
**Method:** full read of `src/`, `test/`, `scripts/`, `supabase/schema.sql`, build config and
CI; `npm test` (green); production build + a measured `manualChunks` experiment; targeted
repros of suspected bugs in Node against the real `ballistics/` modules.

Companion to `UX-REVIEW.md` — that pass owned layout/copy/interaction; this one owns bundle
weight, render/compute cost, correctness of the numeric layer, and operability. The hard
guardrails from `UX-REVIEW.md` ("How to read this doc") and `HANDOFF.md` were treated as
binding: nothing here pulls React into `src/ballistics/`, nothing moves physics into
components, nothing changes the canonical-imperial-internal rule or the G1/G7↔BC coupling,
and `COLUMN_DEFS` stays the single source for RangeTable + DopeChart.

---

## Status as of 2026-09-10

**Every finding (#1–#14) is done** on branch `code-review-fixes` (kept off `main` —
push-to-main auto-deploys, and #7 needs a live DB migration first). Each commit has
`npm test` green and was verified against a production preview build across all five tabs.
Commits, oldest first:

- `675be6c` — **#1–#3, #7** (Tier 1). Final table row lands exactly on the requested max
  range (+ regression test); `ErrorBoundary` around the shell and each tab; `supabaseClient`
  degrades to local-only instead of throwing when env is absent; `saveLoadCloud` is one
  atomic upsert on a new `unique(user_id, name)`.
- `a8596fe` — **#4a/b/c**. `manualChunks` splits `@supabase` + the catalog; the four
  non-Calculator tabs and both chart components (recharts) are `React.lazy`.
- `3e563df` — **#4d**. `@supabase/supabase-js` behind an async `getSupabase()`, off the
  initial bundle.
- `d84ebbc` — **#5, #6**. `sampleAt` binary-searches; the chart sample grids are `useMemo`'d.
- `267947b` — **#8**. `integrate({ visit })` + `heightAtRange` — allocation-free zeroing
  (self-consistency test proves bit-identical). `optimalSightIn` ~130–150 ms → ~51 ms.
- `ed8b4d2` — **#9**. Optimal Zero solve runs in a Web Worker; rows stream in.
- `ea16354` — **#10, #12**. One `<Notice>` and one `useUnitFormatters()`; `commas` imported
  not redefined; the `JSON.stringify(v)` / `JSON.stringify(baseBallisticParams)` memo keys
  are gone; Calculator's setters built once.
- `65e2492` — **#11**. Module-level cache for the saved-loads / recoil-setups lists — a tab
  switch no longer refetches.
- `e181e72` `a5165a3` — **#13**. Vite 5→7, `@vitejs/plugin-react` 4→5, Node 20→22, Supabase
  patch — `npm audit` now clean. The unused `user_settings` / `catalog_selection_events`
  schema is marked "PROVISIONED, NOT YET WIRED".
- `614cb4f` — **#14**. recharts replaced by `components/Plot.jsx` (~220 lines, zero deps) —
  a hand-rolled SVG line plot. Both charts rewritten against it; the `React.lazy` /
  `ChartFallback` scaffolding that only existed to defer recharts is gone. Verified light +
  dark, imperial + metric, 375px mobile (0px overflow), mouse + touch tooltip.

**Measured:** the single **256 KB gzip** original chunk is now `index` 67 + `catalog` 16 on
the critical path, `supabase` 59 deferred behind first paint, every other chunk <6 KB gzip.
~160 KB gzip total, **no chart library**. `npm audit` clean, build ~1.1 s.

**One action left for you:**

- **#7 deploy step.** The `unique (user_id, name)` constraint must be applied to the live
  Supabase DB *before* this branch ships, or every save `upsert` fails. One-liner is in
  `supabase/schema.sql`. Then smoke-test save / re-save / import while signed in — that path
  can't be tested without an account + writes to the production DB.

**Deliberately not touched:** React 18→19, and the `<canvas>` charting libs — the SVG plot
is the endpoint, not a stepping stone.

---

## Ranked summary

| # | Finding | Class | Effort | Risk |
|---|---------|-------|--------|------|
| 1 | Range table drops the final row when "distance out to" isn't a multiple of the table step; SummaryStrip then mislabels it | Correctness | S | low |
| 2 | No error boundary — one throw white-screens the whole app, including the offline calculator | Dependability | S | low |
| 3 | `supabaseClient.js` throws at module load if env vars are missing, taking the calculator down with it | Dependability | S | low |
| 4 | Single 1,015 KB / 256 KB-gzip JS chunk; nothing split, nothing lazy | Weight | S→M | low→med |
| 5 | `CompareChart` / `TrajectoryChart` rebuild their sample arrays (and full-path min/max scans) unmemoized on every render | Speed | S | low |
| 6 | `sampleAt` is O(n) from index 0, called in monotonic loops by both charts and the table builder | Speed | S | low |
| 7 | `saveLoadCloud` does select-then-write with no `unique(user_id,name)` — racey, can duplicate | Dependability | S | low |
| 8 | `solveZeroAngle` re-integrates and re-allocates the entire path on every secant pass | Speed | M | med |
| 9 | Optimal Zero runs every row's `optimalSightIn` (~130–150 ms) synchronously on the main thread | Speed | M | med |
| 10 | `Notice`, the unit-formatter closure block, and `commas` are copy-pasted across 4–6 files | Cleanliness | S | low |
| 11 | Three independent `useSavedLoads()` instances each re-fetch from the cloud on every tab mount | Speed / cost | M | low |
| 12 | `useMemo(… , [JSON.stringify(v)])` — stringify-per-render as a dependency key | Cleanliness | S | low |
| 13 | Dev-toolchain vulns + stale majors (Vite 5, plugin-react 4, Node 20); catalog-stats schema is provisioned but unused | Hygiene | S→M | low |
| 14 | `recharts` is 80 KB gzip for two line charts — the single biggest "lighter" lever, if you want it | Weight | L | med |

Recommended order: **1, 2, 3** (cheap, pure dependability) → **4, 5, 6** (cheap, measurable
speed/weight) → **7, 10, 12** (cleanup that de-risks the rest) → **8, 9, 11** (real work,
real payoff) → **13** (a chore batch) → **14** (a decision, not a task).

---

## Tier 1 — correctness & dependability, all small

### 1. The last range-table row goes missing on non-multiple max ranges

`solveTrajectory` builds the table with `for (let d = 0; d <= maxRangeYd + 1e-6; d += step)`
(`solver.js:233`). When `maxRangeYd` isn't an exact multiple of `step`, the loop stops at the
last full step and never emits a row at `maxRangeYd` itself. `last: rows[rows.length - 1]`
(`solver.js:256`) is then that short row — and `SummaryStrip` labels it with `maxRangeYd`
anyway (`SummaryStrip.jsx:21`, `"At {round(maxRangeYd)} {dSuf}"`).

Repro (Node, real module):

```
solveTrajectory({ …30-06 defaults…, maxRangeYd: 450, tableStepYd: 100 })
→ rows end at 400 yd; solution.last.range === 400
→ SummaryStrip renders "At 450 yd → 2158 fps"   (that's the 400-yd velocity)
```

This isn't an edge case: **every metric session hits it.** The metric step presets map to
`mToYd(25|50|100)` = 27.34 / 54.68 / 109.36 canonical yards (`InputPanel.jsx:17`), so
`maxRangeYd` is essentially never a multiple of `step` in metric. Imperial users hit it any
time they type a max range that isn't round to the step (450/100, 300/25-off-by-typo, etc.).

**Fix (pure `solver.js`, ~3 lines):** after the loop, if the last row's range is short of
`maxRangeYd` by more than an epsilon, push one more `sampleAt(path, maxRangeYd)` row. Guard
the epsilon so the exact-multiple case doesn't produce a duplicate `range` (which would also
collide `RangeTable`'s `key={r.range}`). Add a fixture assertion: "last table row range ===
requested max range, for a max range deliberately not on the step grid."

Guardrail check: stays in the physics module, stays canonical, stays deterministic, and
`npm test` stays meaningful (new independent-ish assertion, not a fixture regen).

### 2. No error boundary anywhere

`main.jsx` renders `<App/>` straight into the root with no `componentDidCatch` /
`getDerivedStateFromError` in the tree (confirmed by grep). Any throw during render —
recharts internals on a degenerate domain, a malformed saved-load record from an older
schema, a solver edge case that returns `NaN` into a formatter — replaces the entire page
with a blank screen, including the Calculator tab that needs nothing but the local solver.

**Fix:** a small class `ErrorBoundary` in `components/`, wrapped around the tab-body switch in
`App.jsx` (so a broken Compare doesn't kill Calculator), with a "something went wrong on this
tab — reload" fallback. Purely presentational; no guardrail interaction. ~30 lines.

### 3. `supabaseClient.js` throws at import time

```js
if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY. …");
}
```

`AuthContext.jsx` imports this eagerly, `App.jsx` imports `AuthProvider` eagerly, so a
missing/typo'd env var at build time takes down the whole app — including the solver, which
is the actual product and has zero dependency on Supabase. A fork, a local `npm run dev`
without `.env.local`, or one bad CI secret and there's a white screen instead of a working
calculator.

**Fix:** degrade instead of throw. If the env is absent, export a `null`/stub client, have
`AuthContext` treat that as "auth unavailable" (no session, `signIn`/`signUp` no-op with a
visible "accounts are disabled in this build" message), and let `useSavedLoads` /
`useRecoilSetups` fall through to their existing localStorage paths. `console.warn` once so
it's not silent. This also makes the app genuinely offline-capable, which suits a
range-day-on-a-phone tool.

### 7. `saveLoadCloud` — select-then-write race, no DB-level guard

`saveLoadCloud` (`savedLoadsCloud.js:70`) does `select id where name = …` then branches to
`update` or `insert`. Two things:

- **Race:** double-clicking "Save" on a new name, or a slow network, runs the select twice
  before either insert lands → two rows with the same name. `listSavedLoadsCloud` then shows
  both; `deleteLoadCloud(id)` only removes one; overwrite-by-name becomes non-deterministic.
- **`schema.sql:52`** has no `unique (user_id, name)` on `saved_loads` (nor on
  `recoil_setups`, though that one's insert-only by design so it matters less).

**Fix:** add `unique (user_id, name)` to `saved_loads` and replace the select+branch with a
single `.upsert(row, { onConflict: 'user_id,name' })`. One round trip, atomic, and the
client code gets shorter. `importLocalLoadsToCloud` needs the same conflict target (or an
explicit "skip existing").

---

## Tier 2 — weight & speed, mostly cheap

### 4. Bundle: one chunk, nothing deferred

`npm run build` today: **`index-*.js` 1,015 KB raw / 256 KB gzip**, single file, plus a
warning Vite prints and the repo ignores. Measured split (a `manualChunks` experiment run
during this review — numbers are real):

| chunk | raw | gzip | needed when |
|---|---|---|---|
| app code | 99 KB | 29 KB | always |
| `commercialAmmo` catalog | 170 KB | 16 KB | on first catalog pick (compresses very well) |
| `@supabase/supabase-js` | 216 KB | 57 KB | only for auth/sync |
| vendor (react-dom etc.) | 221 KB | 73 KB | always |
| charts (recharts + d3-*) | 310 KB | 80 KB | Calculator + Compare only |

Total gzip is unchanged (~255 KB) but it becomes cacheable and deferrable. Do these in
order — each is independently shippable:

**4a. `manualChunks` in `vite.config.js`** (~10 lines). Split vendor / charts / supabase /
catalog. Zero behaviour change; the payoff is that a deploy that only touches app code no
longer busts the 240 KB of vendor+charts+supabase in everyone's cache. Also raises
`build.chunkSizeWarningLimit` deliberately or fixes the thing it's warning about — right now
the warning is just noise.

**4b. `React.lazy` for the non-Calculator tabs.** `App.jsx:89` already does a plain
conditional render of `<Calculator/> : <Compare/> : <OptimalZero/> : <Recoil/> : <Help/>`.
Wrap Compare / OptimalZero / Recoil / Help in `React.lazy` + one `<Suspense fallback>`.
Calculator (the landing tab) loses its only-other-recharts-consumer, Help, and the
DopeChart print portal from the initial parse. Small, mechanical, no guardrail contact.

**4c. Lazy-load recharts inside `TrajectoryChart`.** The chart sits above the fold on
Calculator, so this trades a brief chart-shaped skeleton for ~80 KB gzip off the critical
path. Render `SummaryStrip` + `RangeTable` immediately (they're the numeric truth anyway),
`import("recharts")` on mount, swap the chart in when it resolves. Worth it; the flash is
mild and only on cold load.

**4d. Lazy-load `@supabase/supabase-js`.** `AuthContext` calls `getSession()` on mount, so
the client is on the critical path today for 57 KB gzip that a signed-out first-time visitor
never benefits from. Defer client creation to `requestIdleCallback` / first interaction with
the auth UI, and treat "auth still loading" as signed-out (it already renders that way for
the first frame — `AuthContext.jsx:11`).

### 5. Charts recompute their data unmemoized every render

`CompareChart.jsx:48` builds `data` with a bare `const data = []` loop — `SAMPLES (251) ×
results × sampleAt(path ≈ 3000 pts)` ≈ 3M array-of-object walks — plus a second full-path
`minH/maxH` loop, on **every render**, including the local `showVitals` checkbox toggle and
any parent re-render. `TrajectoryChart.jsx:49-70` has the same shape: inline `data` stride
map + a separate `for (const p of path)` min/max scan, unmemoized.

**Fix:** `useMemo` each `data`/domain block keyed on its real inputs (`[results, atYd,
system]` for Compare; `[path, maxRangeYd, system]` for Trajectory). `CommercialLoadPicker`
already uses `useMemo` heavily — same instinct, it just didn't reach the charts.

### 6. `sampleAt` is a linear scan from the start

`sampleAt` (`solver.js:163`) walks from index 0 every call. It's called:

- ~N times in `solveTrajectory`'s table loop (small N, fine),
- **251 × per selected load** in `CompareChart` with a *monotonically increasing* target,
- 250× in `CompareChart` again for vitals, 100yd lookups in `optimalSightIn`, etc.

Because `path` is sorted by `x`, this should be a binary search (`solver.js` already has one
in `dragCoefficient` — same pattern). For the chart loops specifically, a cursor-based
resampler ("give me the path sampled at this ascending grid") collapses O(samples × n) to
O(n + samples). Pure `solver.js`, covered by the existing fixture comparison.

### 8. `solveZeroAngle` re-integrates the whole path per secant pass

`HANDOFF.md` rough-edge #1. Each `trial(angle)` call (`solver.js:135`) runs a full
`integrate` that builds and returns the entire `{x,y,z,v,t,mach}` array, when the secant
loop only needs `heightAt(zeroRangeYd)`. ~5–8 passes → ~5–8 full path allocations per zero
solve, and `optimalSightIn` calls `solveZeroAngle` 100+ times per optimize.

**Fix:** an `integrate` option (`collectPath: false` or a dedicated `heightAtRange(params,
rangeYd)`) that steps without pushing and returns the interpolated height at one range,
early-exiting once `x` passes it. Keep the full-path `integrate` for the final render solve.
This is the enabling change for #9 to be affordable. Must keep `npm test` green — the zero
angle is directly asserted (`angleErr` tolerance 0.002°), so this is well-fenced.

### 9. Optimal Zero blocks the main thread

Every selected row calls `optimalSightIn` (~130–150 ms: a ternary search + a bisection, each
probe a full re-zero) synchronously in a `useMemo` (`OptimalZero.jsx:109`). The 400 ms
debounce stops it firing per-keystroke but doesn't stop the multi-second freeze once it does
fire with a dozen rows. Options, best first:

- **Web Worker.** The worker imports `src/ballistics/` directly (that boundary is *why* this
  is clean — no React in the worker), posts `{rows}` back. Keeps the UI responsive, shows
  per-row spinners. Pairs naturally with the Calculator's optimal-sight-in toggle too.
- Failing that: memoize per `entry.key` so removing/adding one row doesn't recompute the
  rest, and `requestIdleCallback`-chunk the row loop so the browser can paint between rows.

Either way, #8 roughly halves the per-call cost first.

---

## Tier 3 — cleanliness

### 10. Duplicated code across the tab files

- **`Notice`** is defined identically at the bottom of `Calculator.jsx`, `Compare.jsx`,
  `OptimalZero.jsx`, `Recoil.jsx` (4 verbatim copies). → `components/ui.jsx`.
- The **unit-formatter closure block** — `const dist = (yd) => toDisplay(yd, "distance",
  system)`, `vel`, `len`, `energy`, and the matching `dSuf`/`vSuf`/… — is re-declared in
  `SummaryStrip`, `RangeTable`, `CompareTable`, `CompareChart`, `TrajectoryChart`,
  `OptimalZero`, `Recoil` (~7 places, ~8 lines each). → a `useUnitFormatters()` hook
  returning a memoized `{ dist, vel, len, energy, dSuf, … }` for the current system. Shrinks
  each consumer and removes the "did I convert this one?" surface.
- **`commas`** is exported from `RangeTable.jsx:8` *and* re-defined byte-for-byte in
  `CompareTable.jsx:7`. Import it.

None of this touches the physics boundary or `COLUMN_DEFS`' single-source rule.

### 11. `useSavedLoads` fetches 3× on tab switches

Calculator, Compare and Optimal Zero each call `useSavedLoads()`, which does its own
`listSavedLoadsCloud()` on mount (`useSavedLoads.js:50`). Tabs unmount on switch
(`UX-REVIEW.md` line ~42), so every Calculator→Compare→Calculator round trip is 3 fresh
Supabase round trips for data that rarely changed. Same for `useRecoilSetups`.

**Fix:** lift the list + refresh into a context provider mounted once in `App.jsx`, or a
module-level cache invalidated on `save`/`remove`/`import`. Keeps the hook API identical for
callers.

### 12. `useMemo(…, [JSON.stringify(v)])`

`Calculator.jsx:214` and `TrajectoryChart.jsx:38` (`JSON.stringify(baseBallisticParams)`)
use `JSON.stringify` of an object as the dependency key. It works and the objects are small,
but it runs on *every* render, it's key-order sensitive, and it's a pattern that gets copied
(it already has been, once). Cleaner: depend on the primitive fields directly, or keep a
`useRef` of the last-serialized input and compare. Low urgency — flagging so it doesn't
spread further.

Related minor: `Calculator.jsx:74` rebuilds the `set` handler map (~17 closures) every
render via `Object.fromEntries`; `useMemo` it.

---

## Tier 4 — hygiene

### 13a. Dev-toolchain vulnerabilities (production-safe, still stale)

`npm audit`: 1 high + 1 moderate, both **dev-server only** (esbuild's "any site can hit the
dev server" advisory; Vite path-traversal / `server.fs.deny` bypass / `launch-editor` NTLM
disclosure on Windows). The static build output is unaffected, so this isn't a live-site
risk — but it's a signal the toolchain is a major version behind. `npm outdated`:

```
vite                 5.4.21 → 8.2.2
@vitejs/plugin-react   4.7.0 → 6.1.1
react / react-dom    18.3.1 → 19.3.0
recharts             2.15.4 → 3.10.1
@supabase/supabase-js 2.115 → 2.116
```

Suggested batching: (1) a "tooling refresh" PR — Vite 5→7, plugin-react 4→6, the deferred
Node 20→22 bump in `.github/workflows/deploy.yml` (already on the `UX-REVIEW.md` deferral
list), Supabase patch. Low risk, clears the audit. (2) React 18→19 and (3) recharts 2→3 are
separate deliberate changes — recharts 3 especially, given #14.

### 13b. Provisioned-but-unused schema

`schema.sql` defines `user_settings` (a synced `unit_system`) and the whole
`catalog_selection_events` + `cartridge_popularity` tracking surface, with detailed comments
implying the client writes to them. Nothing in `src/` does — `UnitsContext` is
localStorage-only, and `CommercialLoadPicker` never logs a pick (grep confirms no
`catalog_selection` / `user_settings` reference anywhere in `src/`). Either wire them or add
a one-line "// not yet consumed by the client" to each so a future reader doesn't assume the
stats are real.

### 13c. Defensive hardening (low, not urgent)

- `sampleAt` / `machCrossing` / `sightLineCrossings` divide by `(b.x - a.x)` / `(a.mach -
  b.mach)` with no zero guard. Not reachable today (the `v < 1` break needs the bullet to
  essentially stop, which doesn't happen inside any charted range — verified with an extreme
  405 gr / 1200 fps / 1200 yd case, no `NaN`). A one-line `if (b.x === a.x) return …` guard
  is cheap insurance if the step size or break condition ever changes.
- `solveZeroAngle` only checks `Number.isFinite` on the *first* trial (`solver.js:143`). If a
  later secant jump produces a `NaN` trajectory the loop breaks and returns whatever `a1`
  held. For genuinely unreachable targets a thrown "can't zero at this range" is friendlier
  than a silent garbage angle.
- `test/solver.test.mjs` `TOL.energy` is 3.0 but `README.md` documents worst-observed 0.8;
  `height` tol 0.5 vs 0.15 documented. Not wrong — just looser than reality, so a real 3×
  regression in energy would pass silently. Consider tightening toward the documented
  figures.

---

## Tier 5 — the one big lever

### 14. recharts is 80 KB gzip for two line charts

`recharts` + its `d3-*` transitive deps are the single largest movable chunk (see #4's
table), and the app uses it for exactly two things: `TrajectoryChart` (one line + reference
lines/dots/areas) and `CompareChart` (N lines + reference lines + legend). `Recoil.jsx`
already proves the alternative — its `RecoilBars` is hand-rolled SVG, no library, and it's
fine.

Options, if "lighter" is worth real effort:

- **uPlot** (~15 KB gzip) — built for exactly this (fast 2D line charts), has the crosshair
  tooltip. ~65 KB gzip saved, meaningful reimplementation of both chart components.
- **Hand-rolled SVG** like `RecoilBars`, scaled up — most control, zero deps, but you're
  rebuilding axes/ticks/tooltip/responsive-resize by hand. Only if the charts stay simple.
- **Stay on recharts but upgrade to 3.x** and lean on its tree-shaking / the `recharts/es6`
  entry — smaller win, much smaller effort, and needed for #13a anyway.

This is a decision for Jake, not a task to just do — it's the highest weight payoff and the
highest risk/effort item on the list. Everything above it is worth doing regardless of how
this one lands.

---

## Not problems (checked, leave alone)

- Physics/UI boundary is clean — `src/ballistics/*` has zero React imports, all pure
  functions, `recoil.js` and `angular.js` correctly identified as not-needing independent
  fixtures.
- Canonical-imperial-internal is held consistently; conversions only at `units.js` edges.
- `isAnimationActive={false}` is set on every recharts `<Line>` — good, that's the usual
  perf trap avoided.
- localStorage access is `try/catch`-wrapped everywhere it's touched (`savedLoads.js`,
  `recoilSetups.js`, `UnitsContext.jsx`, the import-offered trackers).
- `.env.local` is correctly gitignored (`*.local`); no secrets tracked; `dist/` ignored.
- The `DopeChart` print-portal + `COLUMN_DEFS` sharing is a genuinely good pattern — the
  printed card provably can't drift from the on-screen table.
- CI runs `npm test` before `npm run build` before deploy — a red test can't ship.
