// A hand-edited load keeps whatever BC the picked load had until the shooter
// changes it. That is right for a handloader who only changes muzzle velocity
// (the BC belongs to the bullet), and wrong for someone who typed a different
// bullet weight or drag model over a catalog load and never touched the BC --
// the result looks fine and is for the wrong bullet. `origin` is the load the
// BC came from, captured when the catalog identity was first cleared:
// { bullet, grains, bc, dragModel }, all strings, so it can be stored as-is.
export function staleBcOrigin(v, origin) {
  if (!origin || v.cartridge.trim()) return null;
  if (v.ballisticCoefficient !== origin.bc) return null;
  return v.grains !== origin.grains || v.dragModel !== origin.dragModel ? origin : null;
}
