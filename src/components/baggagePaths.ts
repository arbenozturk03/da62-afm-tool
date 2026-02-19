/**
 * Closed path `d` strings for the front (nose) baggage compartments.
 *
 * Coordinates are in the ORIGINAL un-rotated SVG space (viewBox 0 0 3406.606 581.918).
 * Nose is on the RIGHT (high x), tail on the LEFT.
 * LH = top (low y), RH = bottom (high y).
 *
 * Derived from the dashed structural lines in cabin.svg:
 *   Line 50  → vertical left wall at x ≈ 2544  (y 46 → 540)
 *   Line 51  → upper compartment inner boundary:
 *               left  x ≈ 2584  (y 49 → 267)
 *               bottom y ≈ 279  (x 2606 → 3207)
 *               right  x ≈ 3215 (y 269 → 149)
 *   Line 52  → lower compartment inner boundary:
 *               left  x ≈ 2855  (y 507 → 335)
 *               top    y ≈ 320  (x 2878 → 3194)
 *               right  x ≈ 3202 (y 332 → 452)
 *
 * The fourth side of each compartment follows the fuselage skin, which tapers
 * toward the nose. Approximated here with cubic béziers.
 */

// Upper compartment (LH nose baggage)
// top-left → down left wall → across bottom divider → up right wall → curve along skin back
export const NOSE_BAG_LH = [
  "M 2544 48",
  "L 2544 268",
  "Q 2544 279, 2570 279",
  "L 3198 279",
  "Q 3215 279, 3215 264",
  "L 3215 150",
  "C 3160 90, 2880 48, 2544 48",
  "Z",
].join(" ");

// Lower compartment (RH nose baggage)
// Uses the INNER dashed vertical (x≈2855) instead of the common left wall (x≈2544)
// so it only covers the right-hand bay shown in the SVG.
export const NOSE_BAG_RH = [
  "M 2878 320",
  "Q 2855 320, 2855 335",
  "L 2855 450",
  "C 3000 450, 3220 440, 3202 430",
  "L 3202 336",
  "Q 3202 320, 3185 320",
  "L 2878 320",
  "Z",
].join(" ");
