/** Virtual-currency minor units granted to every new wallet. */
export const SIGNUP_GRANT_AMOUNT = 100_000;

/** Whole coins, for display (minor units are hundredths). */
export const formatCoins = (minorUnits: number): string =>
  (minorUnits / 100).toLocaleString("en-US", { maximumFractionDigits: 0 });
