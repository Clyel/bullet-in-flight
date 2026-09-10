import { useMemo } from "react";
import { useUnits } from "./UnitsContext.jsx";
import { toDisplay, unitSuffix } from "./units.js";

/**
 * The canonical→display value formatters and unit suffixes for the current
 * unit system, in one place. Every table, chart and summary strip was
 * re-declaring the same six-line block —
 * `const dist = (yd) => toDisplay(yd, "distance", system)`, `dSuf`, `len`,
 * `vel`, … — which is exactly where a "this column never got converted"
 * bug hides. Memoised on `system` so the returned object is stable between
 * unit switches. `system` itself is passed through for the rare spot that
 * needs to branch on it directly.
 */
export function useUnitFormatters() {
  const { system } = useUnits();
  return useMemo(
    () => ({
      system,
      dist: (yd) => toDisplay(yd, "distance", system),
      len: (inches) => toDisplay(inches, "length", system),
      vel: (fps) => toDisplay(fps, "velocity", system),
      energy: (ftLb) => toDisplay(ftLb, "energy", system),
      weight: (lb) => toDisplay(lb, "weight", system),
      dSuf: unitSuffix("distance", system),
      lSuf: unitSuffix("length", system),
      vSuf: unitSuffix("velocity", system),
      eSuf: unitSuffix("energy", system),
      wSuf: unitSuffix("weight", system),
    }),
    [system]
  );
}
