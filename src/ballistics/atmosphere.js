// Atmosphere model. All inputs imperial; all outputs in slug/ft^3 and ft/s.

export const GRAVITY = 32.174; // ft/s^2

/**
 * Air density and speed of sound from station (absolute) pressure and temperature.
 * @param {number} tempF        temperature, degrees F
 * @param {number} pressInHg    STATION pressure at the muzzle, inches of mercury.
 *                              This is absolute, not sea-level-corrected. Do not
 *                              apply an altitude correction on top of it.
 */
export function airState(tempF, pressInHg) {
  const rankine = tempF + 459.67;
  const densityLbFt3 = (1.32506 * pressInHg) / rankine;
  return {
    density: densityLbFt3 / GRAVITY, // slug/ft^3
    speedOfSound: 49.0223 * Math.sqrt(rankine), // ft/s
  };
}

/**
 * ICAO standard atmosphere at a given altitude. Used only to prefill the
 * temperature and pressure fields — never applied on top of user-entered pressure.
 * @param {number} altitudeFt
 * @returns {{ tempF: number, pressInHg: number }}
 */
export function standardAtmosphere(altitudeFt) {
  return {
    pressInHg: 29.92 * Math.pow(1 - 6.87535e-6 * altitudeFt, 5.2559),
    tempF: 59 - 0.00356 * altitudeFt,
  };
}
