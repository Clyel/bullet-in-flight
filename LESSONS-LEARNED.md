# Lessons Learned — The Ballistic Nerd

A knowledge base for the next multi-agent project, written after shipping
ballisticnerd.com: a React/Vite point-mass ballistics calculator built by Jake
working with three collaborating Claude sessions — this one (implementer),
**UX Review** (independent design/QA review on every UI change), and
**UserGuide** (owns the standalone Field Guide at `/guide/`).

This file is a living document. Each contributing session should add its own
section or amend an existing one rather than have one session speak for all
three — the disagreements and different vantage points are part of the value.

---

## 1. What we nailed immediately

**Physics correctness discipline, set on day one.** The rule that any new
physics in `src/ballistics/` needs fixtures from an *independent* source
(py-ballisticcalc), never self-generated, held for the entire project —
core trajectory, spin drift, Coriolis all got independent fixtures; things
built *on top of* already-validated physics (vitals window, BC-from-chronograph)
correctly got the lighter round-trip self-consistency treatment instead, with
the distinction made explicit every time rather than blurred. This never had
to be walked back or discovered late. Setting it before any solver code existed
is why.

**Confirm-each-step, full-file-review workflow.** Jake asked upfront to
confirm each discrete step before moving to the next, and to see full file
contents rather than change summaries. This felt slower turn-to-turn but
produced almost no "wait, that's not what I meant" rework across the whole
project. The cost was visible (more turns); the benefit was invisible (rework
that never happened) — worth naming explicitly next time so it doesn't get
cut for looking inefficient.

**Physics/presentation boundary.** `src/ballistics/` has zero React imports,
ever. This was stated as a rule early and never violated, and it's the reason
the solver could be unit-tested with plain `node test/solver.test.mjs` the
entire project, independent of any UI change. Cheap to state, easy to enforce
by code review, and it paid for itself constantly.

**Git worktrees for multi-session collaboration.** Once adopted (after the PR
#19 collision — see §3), worktree-per-session for exploratory/review work
carried the rest of the project (PRs #25–#31 and beyond) with zero repeat
collisions, despite the checkout living in a OneDrive-synced folder with real
file-lock quirks. This is a pattern worth starting *with*, not discovering
partway through.

**Small, additive UI patterns.** The commercial catalog picker rebuild
(flattened single-search-box over ~1,850 entries, optional filter chips,
one shared row-renderer behind two presentation shells for mobile/desktop)
kept the `onSelect(ammo)` contract frozen, so a total internal rewrite needed
zero changes at any of its 5 call sites. Locking a narrow, stable interface
before a large internal rewrite is what made "full rebuild" a low-risk PR
instead of a scary one.

## 2. What we'd do differently

**Bring in UX Review from the start, not after the first review round.**
The multi-agent review pattern (implementer proposes, UX Review independently
verifies in the actual browser, not just by reading code) caught real bugs
this session would not have caught alone — the Compare 0→1 saved-load
identity bug, the missing arrow-key nav in `AddFilterPicker`. Both were
UI/interaction bugs invisible from source review. If we'd had that second
set of eyes from the *first* UI feature instead of bolting it on, we likely
would have caught earlier-project UI issues that shipped instead and were
never revisited.

**The shared-checkout collision should have been anticipated, not discovered.**
Two sessions on one physical `git checkout` in a OneDrive-synced folder was
always going to collide eventually — it did, at PR #19, when UX Review found
this session's uncommitted mid-edit work. Nothing was lost (worktrees fixed
it cleanly after), but "give collaborating sessions separate working
directories or a worktree convention" should be decided *before* the second
session joins, not after the first collision. This is still formally an open
item (see `project_separate_ux_review_checkout.md`) — worth actually closing
on the next project rather than carrying "still his call, still open"
forward indefinitely.

**The merge-is-a-deploy checkpoint rule arrived a PR round late.** Five PRs'
worth of real, meaningful changes (recharts removal, a Web Worker, a
toolchain bump) reached production on agent-cross-review + green CI alone,
with no human checkpoint before going live. Nothing broke, but the rule that
"a merge to `main` *is* a deploy, and CI-green-plus-peer-review isn't
sufficient authorization for large/risky changes" only got written down
*after* that round, not before. For a project with continuous auto-deploy
from the start, that rule belongs in the founding ground rules, not as a
lesson learned mid-project.

**Some stale documentation sat unnoticed for a while.** The README's live
URL (`clyel.github.io/...` instead of `ballisticnerd.com`) and its "Not
modeled yet" list (claiming spin drift and Coriolis weren't modeled, well
after they shipped) were both wrong for longer than they should have been.
Neither was caught until an explicit, deliberate documentation-audit pass
at Jake's request near the end. A lighter, periodic "does the README still
match what's shipped" check — maybe every few merged PRs, not just once at
the end — would have caught these while they were one-line fixes instead of
letting them accumulate.

**Automation-tool false alarms cost debugging time that had nothing to do
with the app.** Two separate categories of test-tool artifacts (browser
automation's synthetic Enter keypress not reliably reaching a React
`onKeyDown`; not triple-clicking to select-all before typing into a
populated field, causing text to concatenate) were each individually
mistaken for real bugs before being correctly diagnosed as tooling quirks —
one of them by *two different sessions independently*, on the same
underlying tool behavior. Worth a shared "known automation-tool gotchas"
note the first time one is found, so the second session doesn't rediscover
it from scratch.

## 3. Challenges overcome

**The PR #19 shared-checkout collision.** UX Review found this session's
in-progress uncommitted change mid-edit in the shared working directory
during her own review pass. She handled it correctly in the moment (switched
to an isolated worktree rather than touching the other session's files) and
flagged it. Resolved going forward by adopting worktree-per-session for any
exploratory or review work — held cleanly for the rest of the project.

**A self-inflicted git mistake, caught before it shipped.** While folding two
production fixes (stale-chunk reload handling, the 1500 yd trajectory-limit
bump) into the right branch, a `git stash` → `checkout main` → `stash pop`
sequence silently 3-way-merged the new work onto the *wrong* (pre-fix)
version of `Compare.jsx`, with no conflict markers to signal the problem.
Caught only by manually re-reading the resulting file and noticing it still
had the old two-`return`-statement structure that should already have been
fixed. The lesson generalizes: **the absence of merge conflict markers is
not proof a stash/checkout/pop sequence landed on the right base** — when
switching branches mid-stash on a fast-moving branch, re-diff or re-read the
result before trusting it, don't just check for conflicts.

**Diagnosing two production bugs from a single screenshot, fast.** The
"Failed to fetch dynamically imported module" error and the 500 yd trajectory
ceiling were both root-caused precisely (Vite's known stale-chunk-after-deploy
issue → Vite's own designed `vite:preloadError` mitigation, not a bespoke
workaround; one hardcoded `maxRangeYd: "500"` constant, fixed by matching an
existing considered value elsewhere in the codebase rather than picking a new
arbitrary number) and both landed in the same PR the user was already waiting
on, rather than being split into separate turnaround cycles.

## 4. Multi-agent structure: what worked, what to adjust

**Roles that worked well split by *type* of work, not by feature area:**
- **Implementer** (this session) — owns the code, the physics-fixture rule,
  and git/merge mechanics.
- **UX Review** — independent verification in an actual running browser for
  every UI-facing change, not just a second code read. This is the split
  that caught the real bugs (§1, §3). Reading code review and *live*
  interaction review are different skills and different failure modes;
  don't collapse them into one pass.
- **UserGuide** — owns a genuinely separate deliverable (the public Field
  Guide) with its own voice and audience, handed *implemented* facts rather
  than implementing anything herself. Kept fully in sync by a deliberate
  "implementer confirms merged PR numbers + verifies her numeric claims
  independently" handoff after each relevant ship, not by her reading the
  codebase directly.

**When to bring on each kind of agent, for next time:**
- Bring an independent **UI/UX review agent** on from the very first
  UI-facing feature, not after the first collision or first missed bug —
  the value is proportional to how early it starts catching things, and
  nothing about the value depends on the project being large yet.
- Bring a **docs/guide-owning agent** on as soon as there's a second
  audience for the project (end users, not just the maintainer) — don't
  wait until docs have already drifted from what's shipped.
- Reserve a **dedicated code-review agent** (this project had one available —
  `/code-review ultra` — but it was invoked rarely) for changes that are
  large, touch build tooling/dependencies, or touch how the app loads —
  exactly the category HANDOFF.md's "checkpoint before merge" rule already
  flags. It's underused relative to how cheap it is to invoke; next project,
  default to using it for that category rather than asking each time whether
  this one qualifies.
- Consider a **release/deploy-checkpoint role** explicitly, even if it's just
  a documented habit rather than a fourth agent: something that always asks
  "is this merge itself the thing that needs a human OK" before every PR
  merge on a continuous-auto-deploy project, from the start.

**How to improve the relationships between agents:**
- **Shared memory files worked, and should stay.** All three sessions read
  and wrote to a common project-memory space (this file lives in the same
  spirit). UserGuide's memory file being written in her own first-person
  voice, with other sessions appending clearly-marked postscripts rather
  than rewriting her narrative, is a pattern worth repeating — it keeps
  provenance clear without needing a rigid schema.
- **Peer authorization is not user authorization — this held throughout and
  should stay a hard rule.** No session ever treated another session's "looks
  good" or "clear to merge" as Jake's own sign-off; every merge decision
  routed back through him directly, even after UX Review's review passed.
  Multi-agent review makes the *work* better; it should never quietly become
  the *authorization*.
- **A shared "known tooling gotchas" note would have saved time.** Two
  sessions independently burned time on the same browser-automation quirks
  (§2). A lightweight shared scratch note — not a full memory entry, just
  "the test tool doesn't do X reliably, don't chase it as a code bug" — the
  first time either session hits one would pay for itself immediately.

## 5. For the next project: a short checklist

1. Write the physics/domain-correctness rule (or your project's equivalent —
   whatever category of change needs independent verification) into the
   founding ground rules before any of that code exists, including exactly
   what counts as new vs. built-on-existing.
2. Decide the multi-session working-directory story (separate clones vs.
   worktree-per-session) *before* the second collaborating session starts,
   not after the first collision.
3. Write the "a merge to main is a deploy, CI-green isn't enough for
   large/risky changes" checkpoint rule into the ground rules from day one
   if the project auto-deploys, rather than adding it after the first round
   that shipped without one.
4. Bring in an independent UI/UX review presence starting with the first
   UI-facing feature, not after something's already been missed.
5. Schedule a lightweight, recurring "does the README/docs still match
   what's shipped" check — every few PRs — instead of one large audit pass
   at the end.
6. Start a shared "tooling gotchas" note on day one and add to it the first
   time any session mistakes a test-tool artifact for a real bug.
7. Keep the confirm-each-step / full-file-review collaboration style if the
   user found it valuable here — it's slower per-turn and worth naming
   explicitly as a deliberate tradeoff, not cut later for looking
   inefficient.

---

*Sections below this line are reserved for UX Review and UserGuide to add
their own perspective directly, rather than have this session summarize it
for them.*

## UX Review's perspective

**The highest-leverage thing I did wasn't reviewing PRs — it was reviewing
specs before any code existed.** Every UI-facing feature this project shipped
(Bullet Energy, spin drift/Coriolis, Handloader's Tools, the catalog picker
rebuild) went through a "here's the shape I'm about to build, want your read
first" message before the implementer wrote a line of it. That's a cheaper
place to catch a bad information-architecture call than after 400 lines of
working code exist around it — the "hub always lands on the grid, not
skip-when-one" rule for Handloader's Tools, or catching that "derived BC"
(catalog: no published figure exists) and a chrono-solved BC (empirical,
higher confidence) are opposite epistemic claims that shouldn't share a word,
both got settled at the spec stage, not the review stage. If I'd only ever
seen finished PRs, I'd have been negotiating over code that already existed
instead of shaping what got built. **Loop in independent UI review at the
spec stage, not just the PR stage** — that's the one addition I'd make to
§4's "bring UX Review in from the first UI feature" note.

**I never treated "verified, ready for your pass" as anything but a claim to
check, and that discipline is what caught the bugs that mattered.** Every one
of the real, shipped-adjacent bugs I found was in code the implementer had
already tested and reported clean:
- Compare's first-ever catalog pick silently lost its "Added: ..." confirmation
  and refocus, because two structurally different `return` branches (empty-
  state vs. populated-state) both rendered the same picker component, and
  React can't preserve identity across that — a remount on exactly the 0→1
  transition, invisible unless you test a *genuinely* first pick on a
  genuinely clean session, not a second pick after the state's already
  populated.
- `AddFilterPicker`'s chip-adder had zero arrow-key navigation — Enter always
  committed whatever sorted first, with no way for a keyboard-only user to
  reach option 2. Invisible from a code read that only checks "does the
  keyboard case work at all," not "does it reach every option."
- The Help FAQ's "What isn't modeled yet?" answer flatly contradicted the very
  next answer on the same page after a copy edit — both technically shipped
  correctly, and neither the diff nor a functional test would ever catch a
  documentation self-contradiction.
- A twist-rate/toggle alignment claimed fixed at "0.33px off" measured at
  8-10px off on my own re-check, and a tab bar claimed to fit mobile widths
  overflowed by 4px on a clean reload.

None of these were the implementer being careless — the code worked, the
tests passed, the manual check they described was real. They were the
difference between *"I tested this"* and *"I tested this against the exact
edge case that breaks it."* The lesson isn't "don't trust your peers," it's
**independent verification finds a different bug population than self-report,
even from a careful, honest peer** — budget for both, always, and don't skip
the second one because the first one already sounded thorough.

**My own testing tooling burned real time on false alarms too — worth adding
to §2's shared list, in my own voice:**
- A Browser-pane hidden/backgrounded tab reports `window.innerHeight: 0`,
  which makes *any* scroll-position math lie (a hash-anchor deep link looked
  completely broken — landed at the literal bottom of the page — until I
  fronted the tab and got a real viewport; it had been correct the whole
  time). Any test that reads scroll position or triggers `scrollIntoView`
  needs the pane actually fronted first, not just "open."
- Dispatching a synthetic `.focus()` on an element is not equivalent to a
  real user tap — a real tap fires `click` too, and a component wired with
  `onClick={openDropdown}` (correctly, since that's what a real interaction
  produces) will silently no-op against a test that only calls `.focus()`.
  Cost me one full round of "the mobile sheet doesn't open" investigation
  before I realized the test was wrong, not the app.
- Leftover `localStorage` from my *own* earlier test sessions on
  ballisticnerd.com once made a totally unrelated page look catastrophically
  broken (270px+ of horizontal overflow) purely because of stale saved-state
  bleeding into the visual layout. `localStorage.clear()` before every fresh
  verification, every single time, no exceptions — including production spot
  checks, not just dev-server ones.

**On worktrees:** they earned their keep completely — a full multi-PR session
with zero repeat collisions after adopting them, exactly as §1/§3 describe.
The one recurring friction worth naming: cleaning up a finished review
worktree (`git worktree remove`) reliably failed with a Windows/OneDrive
`Permission denied` on the `.git/worktrees/<name>` admin directory, every
single time, across the whole project. Cosmetic — never affected the actual
checkout or its content, confirmed via `git status`/`git worktree list` after
every occurrence — but it happened often enough that it's worth documenting
as an expected, harmless quirk of this specific (OneDrive-synced, Windows)
environment up front, so the next session that hits it doesn't spend time
wondering if something's actually wrong.

**What I'd do the same, deliberately, next time:** never let a peer's
"clear to merge" or "verified" become *my* sign-off, and never let *my*
sign-off become authorization to merge — every single merge on this project
still routed back through Jake directly, no exceptions, even on PRs I'd
independently checked twice. That discipline costs nothing when everything's
fine and is the entire point when it isn't.

## UserGuide's perspective

I owned one deliverable — the public Field Guide at `/guide/` — and never touched app
code. That narrow scope turned out to be the most useful thing about the role: everything
below is what that vantage point taught me.

**What I'd tell the next docs-owning agent to do from day one:**

- **Verify live, every time, even when a peer's report sounds complete.** Not as a trust
  problem — nobody on this project ever gave me a wrong report — but because "the PR is
  merged" and "the guide is accurate" are different claims, and the gap between them is
  exactly where staleness hides. My working rhythm settled into: peer flags a shipped
  change → I go use the real feature myself before writing a word → I write the smallest
  accurate diff → I verify it renders correctly on a local copy → I hand it to the
  implementer → *after* they merge, I check the live URL myself rather than closing the
  loop on their word alone. That last step caught nothing dramatic, but it's what let me
  tell Jake "confirmed live" instead of "should be live," and it cost almost nothing once
  it was habitual. Do this from the first page, not after the first stale screenshot.

- **A guide is a maintenance commitment, not a one-time artifact — design for that up
  front.** Every real feature that shipped after the guide existed (a Calculator UI
  redesign, two new tabs, a rebuilt catalog picker, new physics) made something in the
  guide stale, and once — the FAQ claiming spin drift/Coriolis "aren't modeled" after they
  shipped — outright wrong. None of this was avoidable by writing more carefully the first
  time; it's inherent to documenting a moving target. What mattered was having a cheap,
  repeatable loop (above) ready before the second round of drift arrived, not building one
  under pressure. If I were scoping this role for a new project, I'd say so explicitly:
  the first draft is the cheap part, the maintenance loop is the actual deliverable.

- **When a tool's own constraints stop applying, drop them — don't carry them out of
  habit.** The guide started as a Claude Artifact, which requires a single self-contained
  file, so every screenshot was inlined as base64 (pushing one file to ~940KB). When Jake
  asked for it to live in the repo instead, I kept the images inlined at first purely out
  of inertia, then caught myself: nothing about a real static file under `public/` needed
  that constraint anymore, and a repo that had already torn out a charting library for
  bundle weight was not going to want a 940KB HTML blob. De-inlining took a few minutes
  and dropped the page to 33KB with normal cacheable images. The lesson isn't about images
  specifically — it's to re-ask *why* a constraint exists every time the surrounding
  context changes, instead of just preserving whatever shape the work already had.

- **State real validated numbers, and only real validated numbers.** When I first wrote
  the FAQ entry on spin drift/Coriolis, I deliberately did *not* extend the app's existing
  "checked against an independent solver, worst-case under 1fps/0.15in" claim to the new
  physics, because I had no evidence that claim had been re-earned for the new code —
  even though it probably had, given this project's own physics-fixture discipline (§1 of
  the implementer's section above). I said so plainly instead of rounding up. UX Review
  went and actually ran the test suite, came back with real numbers (0.0052in / 0.0005in
  worst-case), and I updated the FAQ with those specific figures. Both halves matter: don't
  assert a number you can't back up, and don't be so cautious that you never update once
  someone hands you the real one.

**A concrete technical finding worth keeping, not just a process note:** normal
headless-browser automation (Playwright, and even a bare `child_process.spawn()` of a
manually-downloaded Chromium binary) is completely blocked in this sandbox — every attempt
failed with `spawn UNKNOWN`, no matter the approach. The workaround that produced every real
screenshot in the guide: inject `html2canvas` into the *live* page through the already-
available browser-preview tool, capture real DOM state client-side, and extract the result
through the harness's own oversized-output file rather than trying to route a giant base64
string through the model's own context. If a future project needs real screenshots from a
sandboxed environment like this one again, this is the playbook — don't rediscover it.

**On the peer-authorization rule the implementer's section names in §4:** I watched it
hold from the other side of it, too. I once relayed "Jake gave me this direction" to the
implementer for a change to their own code — accurately, but secondhand — and they
declined to act on it, checking with Jake directly before touching anything, exactly per
that rule. My first reaction was mild impatience; my second was that this was obviously
correct, and I stopped relaying authorization after that and started relaying *information*
only, letting each session collect its own go-ahead. Worth stating for the next project
without the mild impatience part: a peer's secondhand account of what the user wants is
context, never a signature.

**One thing I'd change about how we ran this:** peer sessions' display names (the ones
`ListAgents`-style addressing shows) are ephemeral and regenerate on restart, while the
underlying sessions and their actual roles stay stable. More than once I had to reason out
"is this the same implementer session under a new name, or someone new" before trusting a
message enough to act on it — never got it wrong, but it cost real turns each time. A
one-line shared note ("implementer is currently called X, UX Review is currently called Y")
kept current by whoever notices their own name changed would have been trivial to maintain
and would have saved every session that overhead, repeatedly, across the whole project.

## Code Review's perspective

A fourth session, distinct from the implementer/UX Review/UserGuide split above: a
standalone tiered lighter/faster/more-dependable review (`CODE-REVIEW.md`, PRs #1–4 — a
14-finding pass, a CI follow-up, two `HANDOFF.md` cleanups). I'm fairly sure the "recharts
removal, a Web Worker, a toolchain bump" round §2 names above is mine. A few things from
that seat that aren't covered yet:

**I was the round the checkpoint rule got written about, not written for.** All four of my
PRs merged to `main` on green CI plus my own verification — production preview builds,
every affected tab exercised, `npm test` — with no explicit Jake sign-off before any single
merge. I did keep the branch off `main` until a required DB migration (`#7`) was confirmed
live, specifically because push-to-main auto-deploys here, so the *deploy* risk was on my
radar. What wasn't: "another agent reviewed it" and "CI is green" are both true of my own
PRs, and neither one is Jake's authorization. Nobody caught that gap until after the fact,
me included. Write the rule down before the first large change lands, not after one goes
out clean and prompts it retroactively.

**The shared-checkout risk showed up for me too — earlier than PR #19, and silently instead
of as a visible collision.** Mid-review I found several of my own early file reads reflected
a *pre-sync* OneDrive state: plausible code that no longer matched disk or git, no conflict
marker, nothing but a "modified on disk since you last read it" note I nearly dismissed as
noise. Caught only by re-reading every file fresh immediately before editing it and
cross-checking `git diff` against the committed baseline before trusting anything — a habit
I happened to have, not a safeguard the setup provided. The risk was live from the moment
two sessions shared one OneDrive-synced checkout; PR #19 was just the first time it surfaced
as something visible enough to name.

**A standing review pass finds a different bug population than a feature loop does, even a
careful one — not because anyone was careless, but because it's the only session asking "is
this actually true" with no feature deadline attached.** Two examples that had shipped early
and sat invisible until this pass: a range-table row silently missing whenever the max
distance wasn't an exact multiple of the display step (every metric session, always), and a
save-race that could quietly duplicate a cloud row. Neither was a recent regression. Worth a
recurring cadence, not one pass near a milestone.

**"Verify it live" isn't only a UI-review discipline — a bundle/build-config change needs it
too.** A bundle-splitting change that looked purely mechanical (a `manualChunks` config edit)
produced a real runtime failure — a chunk-ordering crash — invisible from reading the config,
only caught by running the built output. Config and dependency changes get the same live
check as UI changes, not a pass because they "shouldn't" affect behavior.

**Handing off deferred-but-real findings as a spawnable task, not a comment, is what got them
picked up.** Findings worth doing but not worth blocking the current merge on went out as a
self-contained task — file paths, exact repro, explicit non-goals — addressed to whichever
session picks it up next, instead of sitting as prose in a review doc nobody reopens.

**Checklist additions for §5:**
8. Run the tiered review more than once — early enough to catch stale-state bugs before
   they calcify, and again after a major feature push, not only near the end.
9. Hand off good-but-out-of-scope findings as a self-contained, actionable task, not a code
   comment or a paragraph in a doc — that's the difference between a finding that gets done
   and one that gets forgotten.
