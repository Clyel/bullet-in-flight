// The plain-English reading of one range-table row: "lands 14.8 in (4.7 MOA)
// below where you aimed" and, when there is any sideways push, "It also lands
// 6.3 in (2.0 MOA) to the left of where you aimed." Display-only -- reads a
// row the solver already produced (height/windage are inches from the line of
// sight, windage negative = left), never re-solves anything.
import { toDisplay, unitSuffix } from "./units.js";
import { inchesToMOA, inchesToMIL } from "./ballistics/angular.js";

// Below this (in the displayed length unit) a value prints as 0.0 anyway.
const LEVEL = 0.05;

/** The rows a shooter can ask about: no muzzle row, and a step row that lands within
 *  0.05 yd of the next one (rounding in a unit switch) is dropped in favour of the later row. */
export function answerChoices(rows) {
  const out = rows.filter((r) => r.range > 0);
  return out.filter((r, i) => i === out.length - 1 || out[i + 1].range - r.range >= 0.05);
}

/** The row the answer line and the first three tiles report: the picked distance, else the farthest. */
export function pickAnswerRow(choices, pickedRange) {
  return choices.find((r) => r.range === pickedRange) ?? choices[choices.length - 1];
}

const fixed1 = (n) => n.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** `angle` is "MOA" or "MIL" -- whichever the user has switched on in the table. */
export function describeShot(row, { system, angle = "MOA" }) {
  const lSuf = unitSuffix("length", system);
  const toAngle = angle === "MIL" ? inchesToMIL : inchesToMOA;
  const amount = (inches) => {
    const shown = fixed1(Math.abs(toDisplay(inches, "length", system)));
    const a = toAngle(Math.abs(inches), row.range);
    return a == null ? `${shown} ${lSuf}` : `${shown} ${lSuf} (${fixed1(a)} ${angle})`;
  };

  const h = toDisplay(row.height, "length", system);
  const height = Math.abs(h) < LEVEL
    ? "your bullet lands level with your aim point."
    : `your bullet lands ${amount(row.height)} ${h < 0 ? "below" : "above"} where you aimed.`;

  const w = toDisplay(row.windage ?? 0, "length", system);
  const wind = Math.abs(w) < LEVEL
    ? null
    : `It also lands ${amount(row.windage)} to the ${w < 0 ? "left" : "right"} of where you aimed.`;

  // The same miss turned into an instruction: the bullet lands low, so hold
  // high; it lands left, so hold right. "Hold", not "dial" -- we don't know
  // whether the shooter's turrets are set up for this zero.
  const holdPart = (inches, towardIfNegative, towardIfPositive) => {
    const a = toAngle(Math.abs(inches), row.range);
    if (a == null || fixed1(a) === "0.0") return null;
    return `${inches < 0 ? towardIfNegative : towardIfPositive} ${fixed1(a)} ${angle}`;
  };
  const holdParts = [holdPart(row.height, "up", "down"), holdPart(row.windage ?? 0, "right", "left")].filter(Boolean);
  const hold = holdParts.length ? `To hit your aim point, hold ${holdParts.join(" and ")}.` : null;

  return { height, wind, hold };
}
