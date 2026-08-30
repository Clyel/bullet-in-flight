# Handoff prompt for Claude Code

Paste everything below the line into Claude Code from inside the project folder.

---

I'm picking up a project from a previous session. The repo is in this folder. Read
`README.md` first — it documents the physics, the architecture boundary, and what's
built. Then read `src/ballistics/solver.js` and `src/ballistics/vitalsWindow.js`.

## What this is

A point-mass exterior ballistics calculator, live at
https://clyel.github.io/bullet-in-flight/. Three tabs: **Calculator** (single load,
range table + trajectory chart), **Compare** (overlay saved loads), **Optimal Zero**
(compare the optimal zero across many catalog rounds or saved loads against one
shared rig). Auto-deploys to GitHub Pages on every push to `main`.

## What is already done and working

Original v1 scope, all shipped: solver (forward Euler, 0.25ms steps, secant-iterated
zeroing), wind deflection (3D relative-velocity), Imperial/Metric unit switching,
MOA/MIL correction columns, Saved Datasets (localStorage, persists per-device across
sessions, does not sync across devices), Compare tab.

Built since, not in the original scope: an 855-entry commercial ammo catalog across
four manufacturers (BC back-calculated from the manufacturer's own published data
where they don't state one — see `scripts/deriveBC.mjs`), a cascading
Caliber -> Manufacturer -> Load picker, per-load vitals-zone radius + a "vitals
window" readout (how far a trajectory stays within that radius) and an "Optimal
Zero" solve for the zero that maximizes it, a whole Optimal Zero comparison tab, and
GitHub Pages hosting.

**Verify the baseline before changing anything:** run `npm install`, then `npm test`.
It should print "All checks passed." If it doesn't, stop and say so — something is
wrong with the environment, not the code.

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

## What remains

**Known rough edges, low priority:**
1. `solveZeroAngle` re-integrates the whole trajectory on every secant pass.
   Invisible at these ranges, but wasteful if we ever batch-solve.
2. Production bundle is ~745KB (183KB gzipped) in a single chunk — recharts and the
   catalog data are the main weight. Not broken, worth revisiting with code-splitting
   if it ever becomes a real complaint.

**Features, roughly in priority order:**
3. **Leupold Boone & Crockett ballistic group classification** — fully scoped, not
   yet built. Purely drop-based (inches of drop at 500yd with a 200yd zero), sourced
   from Leupold's own published BAS manual, no proprietary formula needed. Computable
   with the existing solver, no new physics.
4. **Compare page ballistics comparison table** — a compact table alongside the
   overlaid chart. Not yet designed; "elegant, doesn't crowd the page" is the only
   constraint set so far.
5. **Printable PDF "dope chart"** — a quick-reference trajectory/ballistics card for
   a given load. Not yet scoped.
6. **Felt recoil calculator** — a fourth tab, similar in spirit to Compare/Optimal
   Zero. Not yet scoped — there are a lot of variables (rifle weight, powder charge,
   stock design/fit, etc.) and "how exact do we want this" needs deciding before any
   design work.
7. **Spin drift and Coriolis** — last on the original roadmap, "after wind is solid"
   — it is now. Needs independent fixtures like wind did.
8. Plain Leupold TBR (True Ballistic Range) angle-compensation — a much smaller,
   separate idea from item 3 above (trivial cosine correction for inclined shots),
   mentioned in passing, not requested outright.

Start by running the tests and confirming the baseline, then tell me what you'd
tackle first and why. Don't write code yet.
