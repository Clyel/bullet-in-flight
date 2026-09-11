// The one-line "<weight>gr @ <mv> <unit>, <dragModel> <bc>" ammo
// description -- unit-aware via the same formatDisplay/unitSuffix pattern
// UnitField already uses (this used to be hardcoded to literal "fps"
// regardless of Metric mode; fixed when this was pulled out). Shared by
// three call sites that each want this exact velocity-formatting logic and
// used to carry their own copy: LoadIdentity's "Custom load" subtitle
// (Calculator.jsx), InputPanel's locked-load summary line (its own
// middot-separated variant, with the bcSource note appended by the
// caller), and the suggested "Name this load" value for a hand-typed load.
//
// `separator` defaults to LoadIdentity's original ", " -- InputPanel's
// locked-load line passes " · " to match its own established look.
import { formatDisplay, unitSuffix } from "./units.js";

export function describeLoad(v, system, { separator = ", " } = {}) {
  const mv = formatDisplay(parseFloat(v.muzzleVelocity), "velocity", system);
  const suf = unitSuffix("velocity", system);
  return `${v.grains}gr @ ${mv} ${suf}${separator}${v.dragModel} ${v.ballisticCoefficient}`;
}
