# UX / UI review — ballisticnerd.com

**Reviewer:** design pass from a separate Claude Code session (`ballistics-2a`), 2026-09-08
**Method:** live walkthrough of the deployed site (Calculator, Compare, Optimal Zero, Recoil,
Help) at 1440px, ~530px and 375px viewports, plus interaction tests (manual edits, junk
values, unit switching, sign-in modal), cross-checked against the source in this repo.

---

## Status as of 2026-09-09

Worked through collaboratively (this session + `ballistics-2a`, several rounds of live
verification each), landed in three commits:

- `2d5288c` — mobile overflow (#1), guarded BC/drag-model control (#4), metric energy (half
  of #8 — see note there), catalog picker smallest-viable-version + amber-warning bug +
  duplicate-data cleanup (#7, at the scope Jake chose — see #7 below), "no saved datasets"
  placeholder (§3)
- `54d637a` — idle-state catalog explainer split: G1/G7 fact moved to Help, derived-BC note
  made just-in-time in the confirmation line instead of a standing paragraph (not its own
  priority-list item, but the same "progressive disclosure vs. losing the explanation"
  tension called out in "How to read this doc")
- `80c08f6` — Step-N headers given real visual hierarchy (not its own priority-list item
  either — a follow-on request, mocked first, three rounds of live review before commit)

Priority-list items **2, 3, 5, 6, 9, 10** are still open — see the table below for per-item
status and what's actually shipped vs. deferred.

---

## How to read this doc

This is a designer's argument, made as strongly as it can be. **You own operability and
correctness — where a suggestion here trades away a guardrail or adds interaction cost that
doesn't pay for itself, push back and propose the middle path.** Specifically, weigh every
idea below against:

- **The G1/G7 ↔ BC coupling.** The single place a user mistake produces a *confidently wrong
  answer* instead of an error. Any change to the load form must make that harder to get
  wrong, not easier. If a "cleaner" layout weakens the warning, it loses.
- **The altitude double-count trap.** `README.md:60` calls it "the most common way to get
  quietly wrong numbers." The altitude field's "only fills the two fields above" behavior is
  confusing *by design* to avoid a worse bug. Redesign it, don't just delete the caveat.
- **Progressive disclosure vs. losing the explanation.** A lot of the microcopy is genuinely
  load-bearing. "Make it smaller / hide it" is only right if the thing stays discoverable at
  the moment it matters.
- **The physics/UI boundary.** Nothing here should push logic into components. All of it is
  presentational.

Treat it as a friendly adversarial review. Rank, argue, reject with reasons, ship what
survives. If you think I'm wrong about the catalog picker or the sticky-results layout,
that's the interesting conversation — have it.

## What's already good (keep)

- Cascade picker **auto-advances** when a step has one option (`CommercialLoadPicker.jsx:52`,
  `:60`) — genuinely nice.
- The **"Filled in: 2700 fps · 143gr · G7 0.314"** confirmation chip (`:117`) is the right
  pattern.
- Header flips to **"CUSTOM LOAD / 172gr @ 50000 fps"** the moment you edit a filled field —
  good, honest state.
- Microcopy is precise and honest ("derived BC", "not felt recoil", "not applied on top of
  them").
- Numbered steps with the one truly-optional block (wind) unnumbered and last
  (`InputPanel.jsx:41`).
- `focus-visible` and `prefers-reduced-motion` are handled (`styles.css:12`, `:15`).
- Transonic shading on chart + table.
- The print-portal solution for the dope card (`styles.css:19`).

---

## Priority list

| # | Change | Why | Effort | Status |
|---|--------|-----|--------|--------|
| 1 | **Responsive: kill mobile horizontal overflow** | Site is unusable on a phone — ~135px of overflow at 375px; helper text and table columns clip | M | ✅ Done — `.bif-grid > * { min-width: 0 }`, verified 0px overflow at 375px |
| 2 | **Sticky results column on desktop** | Inputs and the chart they drive are never on screen together after the first viewport | S | ⬜ Open |
| 3 | **Text size + contrast pass** | Helper/label/nav text is 10–11.5px at 3.15:1 — fails WCAG AA, and it's where all the guidance lives | S–M | ⬜ Open — Step-N headers got a separate, unrelated size/weight pass (not this item); body/hint contrast untouched |
| 4 | **Bind drag-model + BC into one guarded control** | The only wrong-answer-not-error input pairing | S | ✅ Done — catalog loads lock to a read-only summary with Override; mismatch guard moved to the drag-model toggle (not the BC field) with an inline confirm, not `window.confirm` (silently no-ops when dialogs are suppressed) |
| 5 | **Input validation / sanity bounds** | 50,000 fps silently computes a Mach 44 trajectory today | M | ⬜ Open — agreed direction (soft bounds everywhere, hard-guard only BC/weight/MV ≤ 0 against NaN/Infinity) but not built |
| 6 | **Consistent, obviously-editable input styling** | Underline-only 19px mono fields read as display values, not inputs | M | ⬜ Open |
| 7 | **Catalog picker → one searchable picker** | Three native selects over 130 calibers; no type-ahead, poor on mobile, can't compare loads while choosing | M–L | 🟡 Partial, by explicit choice — Jake picked the "smallest viable version" (§5) over the full flattened-search rebuild: kept the three-select cascade, swapped native `<select>` for a filterable combobox (substring match, keyboard nav, full ARIA). The stuck amber-warning bug and the duplicate-load data issue (both called out under this item) are fully fixed. |
| 8 | **Metric mode: convert energy, re-map step/range presets** | Energy still shows `ft·lb` in metric; table lands on 91/183/274 | S | 🟡 Partial — energy unit conversion done (new `energy` category in `units.js`, wired through every display); the step/range-preset re-mapping to clean metric values is not |
| 9 | **Per-tab form duplication + empty-state dead ends** | Compare/Recoil/Optimal Zero each rebuild a rig form; Compare/Recoil open to "go do something on another tab first" | L | ⬜ Open — discussed (see Q3 below), not built |
| 10 | **Dark mode** | Outdoor / low-light tool, `color-scheme` is hardcoded `light` (`styles.css:1`) | M | ⬜ Open |

---

## Full findings by area

### 1. Layout & responsive

- **`styles.css:9`** — `.bif-grid { grid-template-columns: 310px 1fr }` with a single
  breakpoint at `max-width: 860px` (`:10`). Below 860 it stacks to one column, but the
  single column still overflows on a phone: at 375px the document is ~507px wide. Grid
  children default to `min-width: auto` and won't shrink below their content's min size —
  the native `<select>`s (longest option `300 Remington SA Ultra Mag`) and the numeric
  fields set the floor. Add `.bif-grid > * { min-width: 0 }` and `min-width: 0` on the
  inner fl?ex/grid wrappers, then re-test at 360px. This is also a WCAG 1.4.10 (reflow)
  failure. **✅ Done.**
- **No `position: sticky` anywhere.** `align-items: start` (`:9`) means the right column is
  as tall as its content (~920px) while the left form is ~1940px, so scrolling the form
  leaves ~1000px of blank `C.field` where the results were. Make the results block (or at
  least the summary strip + chart) `position: sticky; top: 0` on wide viewports. Biggest
  single feel improvement for the effort.
- **One breakpoint only.** 861–1120px (the `max-width` of `.bif-wrap`) gets a cramped
  310+1fr with no intermediate treatment. Consider a mid stop, and make the left column
  `minmax(280px, 340px)`.
- **`App.jsx:54`** — the subtitle ("Point-mass trajectory. Heights are measured from the
  line of sight…") is hardcoded in the shared header and shows on Recoil, Compare, Help
  where it's irrelevant and, for a first-time visitor, is a dense opener. Move it into the
  Calculator tab, or swap it for a plain one-liner and let each tab carry its own intro.
- **`App.jsx:64`** — the Imperial/Metric segmented control sits far right in the same row as
  the tab bar; at the wrap point it detaches oddly. Fine, low priority.

### 2. Typography & contrast

- **`theme.js:16`** — `label` is `600 10px 'Oswald'` with `.14em` tracking in `C.muted`
  (`#5E6357`). On `C.field` (`#B7BBAD`) that's ~**3.15:1** — below AA (4.5:1) for text this
  size. Same color + ~10.5px is repeated inline for every hint (`ui.jsx:29`,
  `InputPanel.jsx:47`, `CommercialLoadPicker.jsx:130`, …) and for inactive nav
  (`ui.jsx:65`).
- **Fix:** darken `C.muted` toward `#40453B` (~5.3:1) and lift the hint/label floor to
  12–13px. The step labels already use `C.ink` (`InputPanel.jsx:34`) — good; the field
  labels should be close to that.
- **`ui.jsx:19`** — inputs render at `500 19px 'IBM Plex Mono'`. Monospace + big + no box =
  "readout", not "field". Keep mono for the aligned range table where digit alignment
  earns it; reconsider for form inputs (or at least give them a box — see §4).
- **Base font.** `<body>` computes to Times New Roman on the live site (no base
  `font-family` set; `styles.css` only sets `background`). Text containers override it, but
  set an explicit base to be safe.
- **Three families** (Oswald / IBM Plex Sans / IBM Plex Mono) is defensible for this
  aesthetic; just be deliberate — Oswald for labels/headings, one Plex for prose, mono
  reserved for tabular data.

### 3. Load form — data entry (deep dive)

**Is the process explained well enough?** The *model* is explained; the *presentation of the
explanation* buries it.

- **The "OR" is doing critical work and is nearly invisible.** `Pick a commercial round` /
  `Or load a saved dataset` (`InputPanel.jsx:52`) / `Or enter your own` (`:85`) are three
  *mutually exclusive* paths rendered as three identically-weighted `sub` spans. A first-
  timer can pick a catalog load and then start typing into the manual fields below without
  realizing one overrode the other. Make them visibly exclusive — segmented
  "Catalog / Saved / Manual", an accordion, or heavy dividers with the "OR" as a real
  separator.
- **The seeded default isn't communicated as a default.** Page loads with a complete 30-06
  trajectory, but the three catalog selects read `Caliber…` (looks unset) while the header
  reads `30-06 SPRINGFIELD`. A user can't tell if that's a real result or a placeholder,
  and can't tell that they could just change one field and go. Either seed the picker's
  visible state, or label the first result "Example — edit anything below."
- **`InputPanel.jsx:97` + `ui.jsx` `Segmented` — drag model and BC are two separate
  controls with the coupling explained only in a 10.5px hint** (`Must be the ${dragModel}
  value. Mixing the two gives wrong answers.`). This is the wrong-answer-not-error pairing;
  it deserves the loudest treatment in the form:
  - When the catalog fills it: render BC as derived/locked ("G7 0.314 — from Hornady"), not
    a bare editable field a user might "correct".
  - When manual: wrap the `Segmented` + BC `Field` in one bordered group titled "Ballistic
    coefficient", with the match rule as visible body text inside the group, not a hint
    below it.
  - **✅ Done, both — plus the guard ended up on the drag-model toggle itself (not the BC
    field), since the BC value can't tell in isolation whether it still matches the model.**
- **No validation, anywhere.** `Field` (`ui.jsx:7`) is a plain text `<input>` with
  `inputMode="decimal"` — no `type=number`, no `min`/`max`/`step`, no downstream sanity
  check. Verified live: MV = `50000` → accepted, Mach 44, 954,000 ft·lb, no warning. Add
  soft bounds with a non-blocking inline caution ("50,000 fps is ~15× a typical rifle —
  sure?"). Hard-guard against zero/negative BC and weight (those can divide-by-zero or
  NaN the solver).
- **`InputPanel.jsx:165` — Altitude.** Styled identically to real parameters but is a
  one-shot helper that stuffs Temperature + Pressure (`:26`), hence the confusing "Only
  fills the two fields above. It is not applied on top of them." Redesign as a clearly
  secondary action — e.g. a small "Estimate from altitude…" link that expands a single
  input + Apply — so it never looks like a live input. (Keep the anti-double-count
  behavior; just make it legible.)
- **`InputPanel.jsx:53` — the "Or load a saved dataset" select shows `No saved datasets
  yet` as a disabled-looking option for every new user.** Hide the whole block until
  `savedLoads.length > 0`. **✅ Done.**
- **`InputPanel.jsx:189` — wind direction as a text field with suffix `o'clock`.** A
  12-position control (dial or 12 small buttons) would be more intuitive and unspoofable.
  Wind being under an unnumbered "Optional" block is the right call.
- **Steps 2–5 are all permanently expanded with a paragraph each.** The form is a very long
  scroll. Consider: two-up the short numeric pairs (temp/pressure, sight height/zero),
  collapse hints into `(i)` popovers, and give Steps 2–5 a one-line collapsed summary
  ("200yd zero · 1.5in sight · 59°F / 29.92inHg · no wind") that expands on tap.
- **Touch targets.** `Segmented` buttons are `padding: 7px 4px` → ~31px tall (`ui.jsx:63`);
  the `HelpLink` row (`App.jsx:99`) is ~15px text. Bump interactive controls to 44px min
  for the range-day phone case.

### 4. Input affordance

- **`ui.jsx:11`** — `Field` wraps the input in a `span` with `borderBottom: 1.5px` only,
  transparent background, `border: none` on the input itself. Underline-only fields
  reliably test as "not editable" with new users, and here the 19px mono value makes it
  worse. Give inputs a full border or a subtle inset fill + the existing focus-visible
  ring. Apply the same treatment to the auth modal fields.
- **`ui.jsx:21`** — the unit suffix is the last child of the flex row, so it's the first
  thing to clip when width is tight (seen on mobile: `in`, `inHg`, `o'clock` cut off).
  Make it a fixed-width adornment inside the field box.
- **Selects vs. text fields look like different systems** — the catalog `<select>`s get a
  full `1.5px solid` box (`CommercialLoadPicker.jsx:78`), the numeric fields get an
  underline. Unify.

### 5. Catalog picker — three dropdowns vs. a popup

**Keep the caliber → manufacturer → load *logic* (it matches how shooters think). The
problem is three native `<select>`s.** Concrete issues:

- 130-item native `<select>` for caliber: browser first-letter jump on desktop, a long
  spinning wheel on mobile. No substring match ("creed" won't find "6.5 Creedmoor").
- Three controls with identical placeholder styling look like the empty/disabled state
  (disabled selects even go solid `C.rule`, `:92`).
- No sense of scale at any step — "how many 6.5 Creedmoor loads exist?"
- You must commit to a manufacturer before seeing any loads; you can't browse or compare.
- Options can't show the data you're choosing between (MV / BC / bullet).
- **`CommercialLoadPicker.jsx:124` — the amber "Pick a load above — the fields below haven't
  changed yet" warning is shown whenever caliber+manufacturer are set but `loadId` is
  blank.** That's the *resting state* after `resetLoadAfterSelect` fires (Optimal Zero,
  Recoil), so those tabs sit under a permanent amber warning after every add. Bug.
  **✅ Fixed** — a `lastApplied` state distinguishes "just added" from "never picked," with
  its own confirmation message.
- **Data:** `6.5 Creedmoor / Hornady` lists `120gr CX (derived BC)` twice
  (`hrn-6-5-creedmoor-120-cx` and `-120-cx-2`) — dedupe in `commercialAmmo.js` or
  disambiguate the label. **Verified these are two real, distinct Hornady products at
  different published muzzle velocities (2925/3050 fps) — deduping would have thrown away
  real data.** ✅ Disambiguated the label with MV instead. While checking that, found and
  removed 14 *actual* byte-for-byte duplicate entries elsewhere in the catalog; one
  remaining case (`hrn-223-rem-55-hp-match-2`) has the same MV as its near-duplicate but a
  conflicting BC — left both, flagged rather than guessed.

**Recommendation: one searchable picker, not a modal per se.**

A single combobox / autocomplete over the flattened 855-load list, with caliber +
manufacturer demoted to optional filter chips above it. Type `143 eld-x` or
`creedmoor hornady` and match instantly; *or* click caliber → brand to narrow. Each result
row shows `caliber · brand · grains · bullet · BC · MV` so the choice is informed. This
collapses three selects + two hint paragraphs into one "Choose a factory load" button + a
"Selected: …" chip, which also shortens the form.

- **Desktop:** inline expanding panel or popover under the button — *not* a centered modal.
  A modal hides the catalog behind a click and adds focus-management burden; the win is the
  search field and the data-rich rows, not the overlay.
- **Mobile:** the same component as a full-screen sheet with a real text input (this is
  where "popup" genuinely helps).
- **Smallest viable version** if a rebuild isn't on the table: swap each native `<select>`
  for a lightweight combobox (type-ahead + keyboard nav) and add a count per step
  ("41 loads"). Fixes ~70% of the pain, touches nothing else.
  **✅ This is the version Jake picked and shipped** — substring-match combobox with full
  keyboard nav and ARIA wiring, cascade/auto-advance logic untouched. Per-step result count
  wasn't added. The full flattened-search rebuild (one box over all 855 loads) is still on
  the table if the minimal version doesn't hold up in practice.

**Operability check for you:** the cascade's auto-advance-on-single-option behavior
(`:52`, `:60`) is a real usability asset — whatever replaces the selects should keep an
equivalent. And `onSelect` firing the *full* catalog entry (`:21`) is the right contract;
don't regress it to an id.

### 6. Trajectory chart

- Hover tooltip works and is useful (range / height / velocity / Mach). No hover on
  mobile — add tap-to-pin.
- Auto-scaled gridlines land on ugly values: `14 / -15 / -35 / -55` in (and
  `35 / -34 / -94 / -129 cm` in metric). Force nice round intervals.
- Tooltip over-precision: "279.42 yd", "-5.37 in". Round to whole yards / 0.1 in.
- Chart is ~310px tall in a very wide column — shallow letterbox for a 42-inch drop. More
  height (and making it the sticky element) would help read the arc.
- "Vitals window at your current zero: 251 yd" is arguably the key output for a hunter and
  it's small muted text under the legend. Promote it into the summary strip.

### 7. Range / dope table

- Clean on desktop. On mobile it clips with no scroll container — wrap in
  `overflow-x: auto`, or switch to stacked per-range cards.
- MOA / MIL columns are off by default — for anyone dialing a scope that's the point of the
  card. Consider defaulting one on.
- "Print dope chart (PDF)" is a plain text link below the table — make it a button and
  surface it near the top of the results too.

### 8. Metric mode

- **Energy stays `ft·lb` with imperial values** in the summary strip and the table header
  in metric mode — real bug. Should be joules. **✅ Fixed** — turned out `units.js` had no
  `energy` category at all; added one and wired it through every display (summary strip,
  compare table, range table + dope chart, Optimal Zero, Recoil's table and bar chart).
- Table rows land on 91 / 183 / 274 because the default `tableStepYd` and "distance out to"
  aren't re-mapped on unit switch. The step *presets* are handled well
  (`InputPanel.jsx:9-18`); extend the same idea — on switch to metric, snap max-range to a
  clean metre value and re-pick the nearest clean step.
- Muzzle velocity shows `861.1`, axis shows `457.2 m` — drop the decimal on values that
  should read whole.
- Bullet weight stays in grains (`InputPanel.jsx:87`, hardcoded `gr`). Defensible
  convention, but the FAQ claims "the toggle applies everywhere" — reconcile the copy or
  the behavior.

### 9. Navigation & IA

- **Per-tab form duplication.** Calculator, Optimal Zero and Recoil each rebuild a
  caliber/rig form; users re-enter the same rig. The Help text *explains* why Optimal Zero's
  rig is separate — if it needs a FAQ entry, the model isn't landing. Consider one shared
  "My rig" with per-tab overrides.
- **Empty states are dead ends.** Compare and Recoil open to "save something on the
  Calculator tab first." Let users add a round to those tabs directly from the catalog
  (Recoil half-does this already).
- **`App.jsx:82` — the "How does X work?" / "FAQ" / "Suggest an idea" link row** is three
  tiny links wedged under the tabs; the first two just jump to Help (which is already a
  tab). Fold them into the Help tab / a single affordance, and give "Suggest an idea" a
  real button where it won't get lost.
- Tab label "Optimal Zero" wraps inside its segmented button on narrow widths — shorten, or
  let the bar scroll.

### 10. Sign-in / accounts

- The modal is Email + Password with **no statement of what an account buys you.** The value
  prop ("keep them everywhere") lives only in `SyncStatusHint` (`ui.jsx:83`), not in the
  modal. Put it in the modal.
- Live: modal doesn't close on Escape (backdrop click / Cancel only). No "forgot password",
  no show-password toggle.
- Modal fields are underline-only again.

### 11. Color & aesthetic

- The monochrome military-sage palette is a strong, memorable identity — keep the concept.
  It's hurting contrast because *everything* is a tint of the same olive. Keep sage for
  chrome/background; pull body text to near-black; keep one or two functional accents
  (`C.brass` for warnings, `C.steel` for the trajectory line already work).
- **`InputPanel.jsx:110` — "Save current load" uses `background: C.rule` when disabled and
  `C.ink` when active**, but the active state (`C.ink` fill, `C.card` text) still reads a
  bit like a disabled control next to the sage. Primary actions could use a warmer, more
  obviously "pressable" treatment.
- `color-scheme` is hardcoded `light` (`styles.css:1`) and there's no `prefers-color-scheme`
  path. Dawn/dusk tool — worth a dark theme, or at least honoring the OS setting.

### 12. Accessibility checklist

- Contrast: muted text fails AA (§2).
- Text size: 10–11.5px throughout (§2).
- Touch targets < 44px (§3).
- Mobile horizontal scroll = reflow failure (§1). **✅ Fixed.**
- Modal: verify focus trap + focus return; add Escape.
- Chart: confirm a text alternative (visually-hidden table or `aria` summary) exists;
  tooltip data is hover-only today.
- `focus-visible` is handled globally (`styles.css:12`) — good; just confirm it reads on the
  transparent inputs.

---

## Open questions for you

1. Is the sticky-results layout compatible with how Compare / Optimal Zero lay out, or does
   it only make sense on Calculator?
   **Still open — not reached yet.**
2. Catalog picker: rebuild to a searchable picker, or ship the minimal combobox swap first
   and revisit? What's the appetite?
   **Resolved:** minimal combobox swap, shipped. Jake's call, explicit: keep the
   caliber→manufacturer→load cascade, add type-to-filter on each. Full rebuild stays an
   option later.
3. Shared "My rig" across tabs — is the per-tab separation a deliberate hill, or legacy?
   **Discussed, not built.** Agreed direction: not a fully shared mutable rig (would
   silently mutate a comparison you set up earlier) — shared *defaults* with independent
   per-tab snapshots, and a visible "using saved rig · reset to current" indicator when a
   tab's rig has drifted from current defaults. Nobody's implemented it yet.
4. Metric energy-unit bug — is that a display-layer fix in `units.js`, or does something
   downstream assume `ft·lb`?
   **Resolved:** pure display-layer gap — `units.js` had no `energy` category at all. Fixed.
5. Do you want a follow-up pass with actual mockups (responsive layout, the guarded
   BC/drag-model group, the searchable picker), or is this enough to work from?
   **Partially resolved:** the guarded BC/drag-model group got built directly (no mockup
   needed — the shape was clear enough from this doc's own recommendation). Step-N header
   prominence — a request that came up after this doc, not in it — did go through a mockup
   pass first. Responsive layout and the searchable-picker rebuild haven't been mocked or
   built.
