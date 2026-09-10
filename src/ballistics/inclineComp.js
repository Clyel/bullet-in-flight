// Rifleman's rule for uphill / downhill shots.
//
// Gravity only acts over the *horizontal* component of an inclined shot, so
// a bullet fired up or down a slope drops about as much as it would on a
// flat shot of `slant range x cos(angle)` — the rangefinder reads the slant
// distance, but you hold as if the target were that bit closer. This is the
// classic first-order approximation ("Rifleman's Rule"): exact for a drag-
// free trajectory, and within roughly 1 MOA of a full inclined integration
// for the angles and ranges a hunter actually shoots. It is a display-layer
// hold aid, not trajectory physics — the solver is never told about the
// angle, it just gets asked for the trajectory at the equivalent range.
export function inclinedEquivalentRange(slantRangeYd, angleDeg) {
  if (!Number.isFinite(slantRangeYd) || !Number.isFinite(angleDeg)) return NaN;
  return slantRangeYd * Math.cos((angleDeg * Math.PI) / 180);
}
