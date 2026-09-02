import React, { useEffect } from "react";
import { C } from "./components/theme.js";

// Every page routes here through App.jsx's `goToHelp(id)` rather than a
// router — this app has never used one (see App.jsx's own tab-switch
// pattern), so a plain scroll-to-id inside one "Help" tab fit the existing
// architecture instead of adding a new dependency for five anchors.

const TOC = [
  { id: "calculator", label: "Calculator" },
  { id: "compare", label: "Compare" },
  { id: "optimal-zero", label: "Optimal Zero" },
  { id: "recoil", label: "Recoil" },
  { id: "faq", label: "FAQ" },
  { id: "submit", label: "Suggest an idea" },
];

const CONTACT_EMAIL = "JakeBerryTukwila@gmail.com";
const MAILTO =
  "mailto:" + CONTACT_EMAIL +
  "?subject=" + encodeURIComponent("Bullet in Flight — feedback") +
  "&body=" + encodeURIComponent("Question, comment, bug, or an idea for a new tool — whatever's on your mind:\n\n");

// Deliberately instant, not `behavior: "smooth"` — smooth scroll's
// animation runs on rAF internally, which this project has already found
// doesn't reliably advance in an automated/backgrounded tab (see Optimal
// Zero's debounce-testing gotcha in project memory). Instant has no
// animation to silently stall, and lands correctly every time.
const scrollToId = (id) => {
  document.getElementById(id)?.scrollIntoView({ block: "start" });
};

/** scrollTarget: { id, key } from App.jsx's goToHelp — `key` changes on every click so
 *  clicking the same link twice in a row still re-scrolls (id alone wouldn't retrigger the effect). */
export default function Help({ scrollTarget }) {
  // No rAF/timeout wrapper needed: React commits the DOM (and the browser
  // computes layout for it) before this effect runs, so the target section
  // already has real coordinates. An rAF here would be pure risk for zero
  // benefit — this project has already hit rAF silently not firing on a
  // backgrounded tab once (Optimal Zero's debounce testing), not worth
  // reintroducing that failure mode for a defer that isn't required.
  useEffect(() => {
    if (!scrollTarget) return;
    scrollToId(scrollTarget.id);
  }, [scrollTarget]);

  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 18px", marginBottom: 18 }}>
        {TOC.map(({ id, label }) => (
          <a
            key={id}
            href={`#${id}`}
            onClick={(e) => { e.preventDefault(); scrollToId(id); }}
            style={{ font: "600 11px 'Oswald',sans-serif", letterSpacing: ".08em", textTransform: "uppercase",
                     color: C.steel, textDecoration: "underline", cursor: "pointer" }}
          >
            {label}
          </a>
        ))}
      </div>

      <Section id="calculator" title="Calculator">
        <P>
          The main tool: solves and charts a full trajectory for one load, zeroed at a distance you choose.
        </P>
        <Sub>The load</Sub>
        <P>
          Pick a round from the built-in catalog (855 commercial loads across Remington, Weatherby, Hornady, and
          Federal) — it fills muzzle velocity, ballistic coefficient, drag model, and bullet weight. Or type your
          own numbers directly, e.g. for a handload. Whichever drag model you pick (G1 or G7) has to match how
          your BC was published — mixing them gives wrong answers. G1 fits older flat-base bullets, G7 fits modern
          boat-tails more accurately; most manufacturers only publish G1 in bulk, which is why the catalog is G1
          almost everywhere (a load marked &ldquo;derived BC&rdquo; has no published BC at all — see the FAQ).
        </P>
        <Sub>The sights, target, shot, wind, and air</Sub>
        <P>
          Sight height is bore centerline to scope (or iron sight) centerline — typically 1.5&ndash;2.0in for a
          scope, about 0.8in for irons. Vitals radius is the half-width of the vital zone you're trying to stay
          inside (smaller for varmints, bigger for elk or moose) — it drives the Vitals Zero band on the chart and
          the vitals-window readout below it. Wind uses clock-face direction: 12 is straight into your face, 3 is
          your right cheek, 6 is at your back, 9 is your left cheek. Fill temperature and pressure directly, or
          enter altitude and hit &ldquo;Fill from standard atmosphere&rdquo; for a quick estimate.
        </P>
        <Sub>Saving, comparing, and printing</Sub>
        <P>
          Name and save the whole setup (ammo + sights + conditions) — it's kept in your browser only (nothing is
          uploaded anywhere) and feeds the Compare and Optimal Zero tabs too. The chart has toggles for the Vitals
          Zero band and an Optimal Sight-in overlay; the table has MOA/MIL toggles. &ldquo;Print dope chart
          (PDF)&rdquo; opens your browser's print dialog with a clean printable card — choose &ldquo;Save as
          PDF&rdquo; as the destination.
        </P>
      </Section>

      <Section id="compare" title="Compare">
        <P>
          Overlays two or more of your saved datasets on one chart and one table, so you can see how different
          loads or rifles actually stack up against each other. Requires at least one saved dataset from the
          Calculator tab first.
        </P>
        <P>
          Check off which saved datasets to compare. &ldquo;Compare at&rdquo; sets the single distance the table
          reads out at — it starts pointed at the shortest selected load's own charted range so nothing shows up
          blank, but you can type any distance you want. If a load's own chart doesn't reach that far, its table
          row says so instead of showing made-up numbers, and its line on the chart simply stops where its own
          data ends. The chart also draws a Vitals Zero band per distinct radius among the loads you've selected —
          comparing a deer load against a moose load shows both bands at once.
        </P>
      </Section>

      <Section id="optimal-zero" title="Optimal Zero">
        <P>
          For each round, finds the zero range that keeps your point of impact inside a vitals radius for the
          longest possible span — the classic &ldquo;how far can I hold dead-on&rdquo; question. It's built on the
          same idea as textbook Maximum Point Blank Range, but computed against this app's real point-mass
          trajectory rather than a simplified formula, and it also surfaces a practical near zero — a shorter,
          easier distance to get on paper first, before confirming at the true optimal (far) zero. That two-stage
          flow is the actual point of the tab, not just the single &ldquo;best&rdquo; number.
        </P>
        <P>
          One shared &ldquo;rig&rdquo; on the left — sight height, vitals radius, temperature, pressure, altitude —
          applies to every round you add. That's deliberate: it's the same physical setup being compared across
          rounds, not each round's own saved sight height and zero (which could be from a completely different
          session). Add rounds from your saved datasets or the catalog picker; each row shows muzzle velocity and
          energy, the near zero, the optimal zero, height at 100yd, and the full vitals window (span plus entry/exit
          distances).
        </P>
      </Section>

      <Section id="recoil" title="Recoil">
        <P>
          Compares <strong>Free Recoil Energy</strong> — not felt or perceived recoil — across different rifle and
          cartridge setups, using SAAMI's own published recoil formula (conservation of momentum and kinetic
          energy). See the FAQ below for why &ldquo;felt&rdquo; recoil specifically isn't modeled.
        </P>
        <P>
          Each setup you add carries its own rifle + optics weight (the whole assembled rig as fired — scope,
          rings, suppressor, sling, everything), bullet weight and muzzle velocity (typed in or filled from the
          catalog), and a powder charge weight. Rifle weight is deliberately per-setup rather than a shared value —
          the whole point of the tab is comparing setups that differ by weight (a featherweight mountain rifle
          against a heavy varmint rig), not just by cartridge.
        </P>
        <P>
          Powder charge isn't published for factory ammo, so picking a cartridge from the &ldquo;Cartridge (for
          charge estimate)&rdquo; list auto-fills an estimate from published case-capacity data — always marked
          &ldquo;est.&rdquo; and always overridable if you know your actual charge weight. Rifle weight stays
          filled in between adds (trying several loads through the same gun is the common case); everything else
          resets so the next setup starts clean. Results show as both a table and a bar chart, updating live as
          you add or remove setups.
        </P>
      </Section>

      <Section id="faq" title="FAQ">
        <QA q="What's a ballistic coefficient (BC), and why does the drag model (G1/G7) matter?">
          BC measures how well a bullet resists drag — higher means less velocity lost over distance. G1 and G7 are
          two different reference drag curves: G1 fits older flat-base bullet shapes, G7 fits modern boat-tail
          bullets more accurately. The BC you enter has to match whichever model is selected, or the trajectory
          comes out wrong — a G1 BC used with G7 selected (or the reverse) isn't a small error, it's the wrong
          calculation entirely.
        </QA>
        <QA q="What does 'derived BC' mean on a catalog load?">
          Some manufacturers (Hornady entirely, most of Federal's lineup) don't publish a BC at all for many loads.
          For those, this app back-solves a BC by finding the value that makes its own physics reproduce that
          manufacturer's own published downrange velocity numbers. It's grounded in real published data, not
          guessed — but it's still an approximation, not an official manufacturer figure, which is why it's always
          labeled.
        </QA>
        <QA q="Why are trajectory heights measured from the line of sight instead of the bore?">
          Because that's how you actually aim and read a scope's reticle. The bullet starts one sight-height below
          your line of sight, rises up through it at the near zero, and falls back through it at the far zero —
          matching what you'd see and use at the range, not an abstract bore-line number.
        </QA>
        <QA q="What is 'vitals window' / 'vitals radius'?">
          Vitals radius is the half-width of the vital zone you're trying to stay inside — smaller for varmints,
          bigger for elk or moose. The vitals window is the span of distances where your point of impact stays
          within that radius of your point of aim, given your current zero: how far out you can hold dead-on and
          still land in the vitals.
        </QA>
        <QA q="Is Free Recoil Energy the same as what a rifle 'feels' like to shoot?">
          No. Free Recoil Energy is exact physics — conservation of momentum and kinetic energy — straight from
          SAAMI's own published formula. What a rifle actually feels like to shoot also depends on stock geometry,
          recoil pads, muzzle devices, and the shooter, none of which reduces to a single formula, so this app
          deliberately doesn't estimate &ldquo;felt&rdquo; recoil.
        </QA>
        <QA q="Where does the estimated powder charge weight come from?">
          Manufacturers don't publish it for factory loads. When a cartridge has known case capacity, the estimate
          comes from Nosler's own published case-capacity figures at a conservative ~90% load density (the low end
          of what Nosler's own load-data sheets actually show for full loads) — always labeled as an estimate,
          always overridable if you know your real charge weight.
        </QA>
        <QA q="Does this app save my data anywhere besides my own browser?">
          No. Saved datasets live only in your browser's local storage — nothing is uploaded anywhere. Clearing
          your browser data, or switching devices or browsers, means starting over.
        </QA>
        <QA q="Does it support metric units?">
          Yes — the Imperial/Metric toggle at the top applies everywhere in the app. Everything is computed
          internally in imperial units and converted only for display and input, so switching back and forth never
          loses precision.
        </QA>
        <QA q="What isn't modeled yet?">
          Spin drift and Coriolis effect aren't in the trajectory solver yet. Everything else that's implemented —
          drag, wind deflection, atmosphere — is a full point-mass integration, not a simplified approximation.
        </QA>
      </Section>

      <Section id="submit" title="Suggest an idea">
        <P>
          Found something wrong, want a page to cover something it doesn't, or have an idea for a whole new tool?
          We like ideas — send it over.
        </P>
        <a
          href={MAILTO}
          style={{ display: "inline-block", padding: "9px 18px", background: C.ink, color: C.card,
                   textDecoration: "none", font: "600 11px 'Oswald',sans-serif", letterSpacing: ".12em",
                   textTransform: "uppercase" }}
        >
          Email your idea
        </a>
        <p style={{ marginTop: 10, font: "400 11px/1.5 'IBM Plex Sans',sans-serif", color: C.muted }}>
          Opens your email client addressed to {CONTACT_EMAIL}. If nothing opens, that address works fine
          copy-pasted directly too.
        </p>
      </Section>
    </div>
  );
}

function Section({ id, title, children }) {
  return (
    <section
      id={id}
      style={{ background: C.card, border: `1.5px solid ${C.rule}`, padding: "18px 20px",
               marginBottom: 16, scrollMarginTop: 16 }}
    >
      <h2 style={{ margin: "0 0 10px", font: "700 18px 'Oswald',sans-serif", textTransform: "uppercase",
                   letterSpacing: ".03em", color: C.ink }}>
        {title}
      </h2>
      {children}
    </section>
  );
}

function Sub({ children }) {
  return (
    <div style={{ font: "600 10px 'Oswald',sans-serif", letterSpacing: ".14em", textTransform: "uppercase",
                  color: C.muted, margin: "16px 0 6px" }}>
      {children}
    </div>
  );
}

function P({ children }) {
  return <p style={{ margin: "0 0 4px", font: "400 12.5px/1.6 'IBM Plex Sans',sans-serif", color: C.ink }}>{children}</p>;
}

function QA({ q, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ font: "600 13px 'IBM Plex Sans',sans-serif", color: C.ink, marginBottom: 4 }}>{q}</div>
      <div style={{ font: "400 12.5px/1.6 'IBM Plex Sans',sans-serif", color: C.muted }}>{children}</div>
    </div>
  );
}
