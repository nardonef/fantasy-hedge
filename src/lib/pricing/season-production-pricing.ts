export type SeasonProductionSide = "OVER" | "UNDER";
export type SeasonProductionPrices = Record<SeasonProductionSide, number>;

const MIN_PRICE = 0.02;
const MAX_PRICE = 0.98;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Projects a player's full-season stat total from their pace-to-date, blended against their
 * draft-slot baseline in proportion to games remaining — week 1's small sample doesn't wildly
 * overreact, and by season's end the projection is entirely the actual pace.
 */
export function projectedSeasonTotal(params: {
  gamesPlayed: number;
  totalGames: number;
  statToDate: number;
  baseline: number;
}): number {
  const { gamesPlayed, totalGames, statToDate, baseline } = params;
  if (totalGames <= 0) throw new Error(`totalGames must be > 0, got ${totalGames}`);
  if (gamesPlayed < 0 || gamesPlayed > totalGames) {
    throw new Error(`gamesPlayed must be in [0, ${totalGames}], got ${gamesPlayed}`);
  }
  if (gamesPlayed === 0) return baseline;

  const paceTotal = (statToDate / gamesPlayed) * totalGames;
  const seasonFraction = gamesPlayed / totalGames;
  return baseline * (1 - seasonFraction) + paceTotal * seasonFraction;
}

export type SeasonProductionPricingParams = {
  projectedTotal: number;
  thresholdValue: number;
  /** Stat units spanning a full swing from ~1% to ~99% OVER probability — e.g. baseline * 0.6. */
  sensitivity: number;
  /** Total overround applied across both sides, same convention as game-prop pricing. */
  vig: number;
};

/** Prices a season-long OVER/UNDER from how far the projected total sits from the threshold. */
export function seasonProductionPrices(params: SeasonProductionPricingParams): SeasonProductionPrices {
  const { projectedTotal, thresholdValue, sensitivity, vig } = params;
  if (sensitivity <= 0) throw new Error(`sensitivity must be > 0, got ${sensitivity}`);
  if (vig < 0) throw new Error(`vig must be >= 0, got ${vig}`);

  const overProbability = clamp(0.5 + (projectedTotal - thresholdValue) / sensitivity, 0.01, 0.99);

  return {
    OVER: clamp(overProbability * (1 + vig), MIN_PRICE, MAX_PRICE),
    UNDER: clamp((1 - overProbability) * (1 + vig), MIN_PRICE, MAX_PRICE),
  };
}
