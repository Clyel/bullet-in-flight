/** Fixed-decimal formatting with a thousands separator, e.g. -432.0 -> "-432.0", 2626 -> "2,626".
 *  A value that rounds to zero at this precision prints as plain "0.0", never "-0.0". */
export const commas = (n, digits) => {
  const value = Math.abs(n) < 0.5 * 10 ** -digits ? 0 : n;
  return value.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
};
