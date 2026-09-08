// Raw scrape of Hornady's own published BC data, https://www.hornady.com/bc
// (the ?age=confirmed query param bypasses their age gate for scripted
// fetches -- no login/session needed). Captured 2026-09-08 by reading the
// live DOM's `.table-row` elements directly (the page renders no <table>
// tags at all, just styled divs) rather than trusting any AI summary of
// the page, given the scale of data involved -- see applyHornadyBC.mjs
// for how this gets matched against the catalog and applied.
//
// Hornady publishes THREE BC values per bullet, at three velocity tiers
// (their own page's wording): Mach 2.25 (2512 fps) is "used when comparing
// to other published BC values within the industry" -- i.e. the
// apples-to-apples figure against every other manufacturer's single
// published BC in this catalog, which is why applyHornadyBC.mjs only ever
// uses this tier. Mach 2.0 (2233 fps) and Mach 1.75 (1954 fps) are kept
// here for completeness/future use but currently unused.
//
// twistNote: present only where Hornady lists two BC values for the same
// bullet+weight depending on barrel twist rate (faster twist -> slightly
// higher BC). This catalog has no twist-rate field at all, so
// applyHornadyBC.mjs always takes the slower/more common twist variant
// (e.g. 1-in-10" over 1-in-7" for .30 cal) as the more broadly
// representative figure -- not a technically "correct" choice, just the
// most defensible single pick given the data this app actually tracks.

export const HORNADY_BC_RAW = [
  // ── ELD Match ──
  { line: "ELD Match", caliber: "22 Cal", grains: 73, mach225: { g1: 0.398, g7: 0.200 }, mach200: { g1: 0.389, g7: 0.195 }, mach175: { g1: 0.382, g7: 0.192 } },
  { line: "ELD Match", caliber: "22 Cal", grains: 75, mach225: { g1: 0.467, g7: 0.235 }, mach200: { g1: 0.459, g7: 0.230 }, mach175: { g1: 0.441, g7: 0.222 } },
  { line: "ELD Match", caliber: "22 Cal", grains: 80, mach225: { g1: 0.485, g7: 0.244 }, mach200: { g1: 0.477, g7: 0.239 }, mach175: { g1: 0.462, g7: 0.232 } },
  { line: "ELD Match", caliber: "22 Cal", grains: 88, mach225: { g1: 0.545, g7: 0.274 }, mach200: { g1: 0.534, g7: 0.268 }, mach175: { g1: 0.528, g7: 0.266 } },
  { line: "ELD Match", caliber: "6mm", grains: 108, mach225: { g1: 0.536, g7: 0.270 }, mach200: { g1: 0.526, g7: 0.264 }, mach175: { g1: 0.520, g7: 0.261 } },
  { line: "ELD Match", caliber: "6.5mm", grains: 100, mach225: { g1: 0.385, g7: 0.194 }, mach200: { g1: 0.377, g7: 0.189 }, mach175: { g1: 0.369, g7: 0.186 } },
  { line: "ELD Match", caliber: "6.5mm", grains: 120, mach225: { g1: 0.486, g7: 0.245 }, mach200: { g1: 0.465, g7: 0.233 }, mach175: { g1: 0.450, g7: 0.227 } },
  { line: "ELD Match", caliber: "6.5mm", grains: 123, mach225: { g1: 0.506, g7: 0.255 }, mach200: { g1: 0.493, g7: 0.247 }, mach175: { g1: 0.481, g7: 0.242 } },
  { line: "ELD Match", caliber: "6.5mm", grains: 130, mach225: { g1: 0.554, g7: 0.279 }, mach200: { g1: 0.542, g7: 0.272 }, mach175: { g1: 0.535, g7: 0.269 } },
  { line: "ELD Match", caliber: "6.5mm", grains: 140, mach225: { g1: 0.646, g7: 0.326 }, mach200: { g1: 0.637, g7: 0.320 }, mach175: { g1: 0.616, g7: 0.310 } },
  { line: "ELD Match", caliber: "6.5mm", grains: 147, mach225: { g1: 0.697, g7: 0.351 }, mach200: { g1: 0.662, g7: 0.332 }, mach175: { g1: 0.637, g7: 0.321 } },
  { line: "ELD Match", caliber: "7mm", grains: 162, mach225: { g1: 0.670, g7: 0.338 }, mach200: { g1: 0.655, g7: 0.329 }, mach175: { g1: 0.637, g7: 0.320 } },
  { line: "ELD Match", caliber: "7mm", grains: 180, twistNote: "1 in 8.75\" Twist", mach225: { g1: 0.777, g7: 0.391 }, mach200: { g1: 0.748, g7: 0.376 }, mach175: { g1: 0.731, g7: 0.368 } },
  { line: "ELD Match", caliber: "7mm", grains: 180, twistNote: "1 in 7.5\" Twist", mach225: { g1: 0.816, g7: 0.411 }, mach200: { g1: 0.812, g7: 0.408 }, mach175: { g1: 0.782, g7: 0.394 } },
  { line: "ELD Match", caliber: "30 Cal", grains: 155, mach225: { g1: 0.461, g7: 0.232 }, mach200: { g1: 0.451, g7: 0.227 }, mach175: { g1: 0.439, g7: 0.221 } },
  { line: "ELD Match", caliber: "30 Cal", grains: 168, mach225: { g1: 0.523, g7: 0.263 }, mach200: { g1: 0.516, g7: 0.259 }, mach175: { g1: 0.498, g7: 0.251 } },
  { line: "ELD Match", caliber: "30 Cal", grains: 178, mach225: { g1: 0.547, g7: 0.275 }, mach200: { g1: 0.527, g7: 0.265 }, mach175: { g1: 0.506, g7: 0.254 } },
  { line: "ELD Match", caliber: "30 Cal", grains: 195, mach225: { g1: 0.584, g7: 0.294 }, mach200: { g1: 0.573, g7: 0.288 }, mach175: { g1: 0.566, g7: 0.285 } },
  { line: "ELD Match", caliber: "30 Cal", grains: 208, mach225: { g1: 0.690, g7: 0.348 }, mach200: { g1: 0.683, g7: 0.343 }, mach175: { g1: 0.669, g7: 0.337 } },
  { line: "ELD Match", caliber: "30 Cal", grains: 225, twistNote: "1 in 10\" Twist", mach225: { g1: 0.777, g7: 0.391 }, mach200: { g1: 0.752, g7: 0.378 }, mach175: { g1: 0.719, g7: 0.362 } },
  { line: "ELD Match", caliber: "30 Cal", grains: 225, twistNote: "1 in 7\" Twist", mach225: { g1: 0.798, g7: 0.402 }, mach200: { g1: 0.782, g7: 0.393 }, mach175: { g1: 0.749, g7: 0.377 } },
  { line: "ELD Match", caliber: "338 Cal", grains: 285, mach225: { g1: 0.829, g7: 0.417 }, mach200: { g1: 0.814, g7: 0.409 }, mach175: { g1: 0.796, g7: 0.400 } },
  { line: "ELD Match", caliber: "25 Cal", grains: 134, mach225: { g1: 0.645, g7: 0.325 }, mach200: { g1: 0.638, g7: 0.320 }, mach175: { g1: 0.632, g7: 0.318 } },

  // ── ELD-X ──
  { line: "ELD-X", caliber: "6mm", grains: 90, mach225: { g1: 0.410, g7: 0.206 }, mach200: { g1: 0.402, g7: 0.202 }, mach175: { g1: 0.399, g7: 0.201 } },
  { line: "ELD-X", caliber: "6mm", grains: 103, mach225: { g1: 0.512, g7: 0.258 }, mach200: { g1: 0.505, g7: 0.253 }, mach175: { g1: 0.498, g7: 0.251 } },
  { line: "ELD-X", caliber: "25 Cal", grains: 110, mach225: { g1: 0.465, g7: 0.234 }, mach200: { g1: 0.457, g7: 0.229 }, mach175: { g1: 0.451, g7: 0.227 } },
  { line: "ELD-X", caliber: "6.5mm", grains: 143, mach225: { g1: 0.623, g7: 0.314 }, mach200: { g1: 0.604, g7: 0.303 }, mach175: { g1: 0.584, g7: 0.294 } },
  { line: "ELD-X", caliber: "270 Cal", grains: 145, mach225: { g1: 0.536, g7: 0.270 }, mach200: { g1: 0.521, g7: 0.262 }, mach175: { g1: 0.512, g7: 0.257 } },
  { line: "ELD-X", caliber: "7mm", grains: 150, mach225: { g1: 0.574, g7: 0.289 }, mach200: { g1: 0.563, g7: 0.283 }, mach175: { g1: 0.558, g7: 0.281 } },
  { line: "ELD-X", caliber: "7mm", grains: 162, mach225: { g1: 0.631, g7: 0.318 }, mach200: { g1: 0.626, g7: 0.314 }, mach175: { g1: 0.615, g7: 0.308 } },
  { line: "ELD-X", caliber: "7mm", grains: 175, mach225: { g1: 0.689, g7: 0.347 }, mach200: { g1: 0.683, g7: 0.343 }, mach175: { g1: 0.678, g7: 0.341 } },
  { line: "ELD-X", caliber: "30 Cal", grains: 178, mach225: { g1: 0.552, g7: 0.278 }, mach200: { g1: 0.543, g7: 0.273 }, mach175: { g1: 0.538, g7: 0.271 } },
  { line: "ELD-X", caliber: "30 Cal", grains: 200, mach225: { g1: 0.597, g7: 0.301 }, mach200: { g1: 0.588, g7: 0.295 }, mach175: { g1: 0.578, g7: 0.291 } },
  { line: "ELD-X", caliber: "30 Cal", grains: 212, twistNote: "1 in 10\" Twist", mach225: { g1: 0.663, g7: 0.334 }, mach200: { g1: 0.649, g7: 0.326 }, mach175: { g1: 0.643, g7: 0.324 } },
  { line: "ELD-X", caliber: "30 Cal", grains: 212, twistNote: "1 in 7\" Twist", mach225: { g1: 0.702, g7: 0.354 }, mach200: { g1: 0.686, g7: 0.345 }, mach175: { g1: 0.677, g7: 0.341 } },
  { line: "ELD-X", caliber: "30 Cal", grains: 220, mach225: { g1: 0.654, g7: 0.329 }, mach200: { g1: 0.643, g7: 0.323 }, mach175: { g1: 0.643, g7: 0.323 } },
  { line: "ELD-X", caliber: "338 Cal", grains: 230, mach225: { g1: 0.616, g7: 0.310 }, mach200: { g1: 0.616, g7: 0.309 }, mach175: { g1: 0.608, g7: 0.306 } },
  { line: "ELD-X", caliber: "338 Cal", grains: 270, mach225: { g1: 0.757, g7: 0.381 }, mach200: { g1: 0.745, g7: 0.374 }, mach175: { g1: 0.739, g7: 0.372 } },

  // ── A-Tip Match (no catalog entries use this bullet today, kept for completeness) ──
  { line: "A-Tip Match", caliber: "22 cal", grains: 76, mach225: { g1: 0.413, g7: 0.208 }, mach200: { g1: 0.405, g7: 0.203 }, mach175: { g1: 0.395, g7: 0.199 } },
  { line: "A-Tip Match", caliber: "22 cal", grains: 90, mach225: { g1: 0.585, g7: 0.295 }, mach200: { g1: 0.575, g7: 0.289 }, mach175: { g1: 0.556, g7: 0.280 } },
  { line: "A-Tip Match", caliber: "6 mm", grains: 110, mach225: { g1: 0.604, g7: 0.304 }, mach200: { g1: 0.595, g7: 0.299 }, mach175: { g1: 0.584, g7: 0.294 } },
  { line: "A-Tip Match", caliber: "6 mm", grains: 120, mach225: { g1: 0.675, g7: 0.340 }, mach200: { g1: 0.664, g7: 0.333 }, mach175: { g1: 0.651, g7: 0.328 } },
  { line: "A-Tip Match", caliber: "6.5 mm", grains: 135, mach225: { g1: 0.637, g7: 0.321 }, mach200: { g1: 0.626, g7: 0.314 }, mach175: { g1: 0.613, g7: 0.309 } },
  { line: "A-Tip Match", caliber: "6.5 mm", grains: 153, mach225: { g1: 0.704, g7: 0.355 }, mach200: { g1: 0.698, g7: 0.351 }, mach175: { g1: 0.687, g7: 0.346 } },
  { line: "A-Tip Match", caliber: "7 mm", grains: 166, mach225: { g1: 0.664, g7: 0.332 }, mach200: { g1: 0.653, g7: 0.326 }, mach175: { g1: 0.650, g7: 0.325 } },
  { line: "A-Tip Match", caliber: "7 mm", grains: 190, mach225: { g1: 0.838, g7: 0.422 }, mach200: { g1: 0.830, g7: 0.417 }, mach175: { g1: 0.823, g7: 0.414 } },
  { line: "A-Tip Match", caliber: "30 Cal", grains: 176, mach225: { g1: 0.564, g7: 0.284 }, mach200: { g1: 0.552, g7: 0.277 }, mach175: { g1: 0.540, g7: 0.272 } },
  { line: "A-Tip Match", caliber: "30 Cal", grains: 177, mach225: { g1: 0.565, g7: 0.285 }, mach200: { g1: 0.556, g7: 0.279 }, mach175: { g1: 0.548, g7: 0.276 } },
  { line: "A-Tip Match", caliber: "30 Cal", grains: 230, mach225: { g1: 0.823, g7: 0.414 }, mach200: { g1: 0.813, g7: 0.408 }, mach175: { g1: 0.811, g7: 0.408 } },
  { line: "A-Tip Match", caliber: "30 Cal", grains: 250, mach225: { g1: 0.878, g7: 0.442 }, mach200: { g1: 0.877, g7: 0.440 }, mach175: { g1: 0.872, g7: 0.439 } },
  { line: "A-Tip Match", caliber: "338 cal", grains: 300, mach225: { g1: 0.863, g7: 0.435 }, mach200: { g1: 0.860, g7: 0.432 }, mach175: { g1: 0.850, g7: 0.428 } },
  { line: "A-Tip Match", caliber: "375 cal", grains: 390, mach225: { g1: 0.987, g7: 0.497 }, mach200: { g1: 0.974, g7: 0.489 }, mach175: { g1: 0.971, g7: 0.488 } },
  { line: "A-Tip Match", caliber: "416 cal", grains: 500, mach225: { g1: 0.976, g7: 0.493 }, mach200: { g1: 0.964, g7: 0.484 }, mach175: { g1: 0.946, g7: 0.476 } },

  // ── ELD-VT (no catalog entries use this bullet today, kept for completeness) ──
  { line: "ELD-VT", caliber: "22 cal", grains: 62, mach225: { g1: 0.395, g7: 0.199 }, mach200: { g1: 0.389, g7: 0.195 }, mach175: { g1: 0.385, g7: 0.194 } },
  { line: "ELD-VT", caliber: "6mm", grains: 80, mach225: { g1: 0.410, g7: 0.206 }, mach200: { g1: 0.406, g7: 0.204 }, mach175: { g1: 0.403, g7: 0.203 } },
  { line: "ELD-VT", caliber: "6.5mm", grains: 100, mach225: { g1: 0.448, g7: 0.226 }, mach200: { g1: 0.441, g7: 0.222 }, mach175: { g1: 0.434, g7: 0.218 } },
  { line: "ELD-VT", caliber: "30 cal", grains: 174, mach225: { g1: 0.573, g7: 0.289 }, mach200: { g1: 0.564, g7: 0.283 }, mach175: { g1: 0.563, g7: 0.283 } },
];
