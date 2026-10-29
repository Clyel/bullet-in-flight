/**
 * The column set shared by the live range table and the printable dope card
 * (never time/mach as columns on the card -- mach still drives its transonic
 * footnote). Height and windage lead because they're the answer; velocity and
 * energy follow, so on a narrow screen the horizontal scroll hides the least
 * important numbers instead of the most important ones.
 */
export function dopeColumnKeys({ showWindage, showMOA, showMIL }) {
  return [
    "range",
    "height",
    ...(showMOA ? ["heightMOA"] : []),
    ...(showMIL ? ["heightMIL"] : []),
    ...(showWindage ? ["windage"] : []),
    ...(showWindage && showMOA ? ["windageMOA"] : []),
    ...(showWindage && showMIL ? ["windageMIL"] : []),
    "velocity", "energy",
  ];
}
