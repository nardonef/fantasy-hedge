export type GamePropSide = "OVER" | "UNDER";
export type GamePropPrices = Record<GamePropSide, number>;

export type GamePropPricingParams = {
  /** House estimate that the OVER side hits, before vig — 0..1, exclusive. */
  initialProbability: number;
  /** Total overround applied across both sides, e.g. 0.08 for a -110/-110-equivalent line. */
  vig: number;
};

const MIN_PRICE = 0.02;
const MAX_PRICE = 0.98;
/** Price movement per share of trade-volume imbalance — fixed-odds, not a liquidity curve. */
const REPRICE_STEP = 0.01;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** The house-quoted opening prices for a market's OVER and UNDER contracts. */
export function initialGamePropPrices(params: GamePropPricingParams): GamePropPrices {
  const { initialProbability, vig } = params;
  if (!(initialProbability > 0 && initialProbability < 1)) {
    throw new Error(`initialProbability must be in (0,1), got ${initialProbability}`);
  }
  if (vig < 0) throw new Error(`vig must be >= 0, got ${vig}`);

  return {
    OVER: clamp(initialProbability * (1 + vig), MIN_PRICE, MAX_PRICE),
    UNDER: clamp((1 - initialProbability) * (1 + vig), MIN_PRICE, MAX_PRICE),
  };
}

/**
 * Nudges both contract prices after a trade — buying a side moves its price up and the other
 * side's price down, by a fixed step per share. There's no real cross-user liquidity at MVP to
 * justify a continuous bonding curve; this is the simplest thing that makes the line move.
 */
export function repriceAfterTrade(
  prices: GamePropPrices,
  side: GamePropSide,
  quantity: number,
): GamePropPrices {
  if (quantity <= 0) throw new Error(`quantity must be positive, got ${quantity}`);

  const delta = REPRICE_STEP * quantity;
  const sign = side === "OVER" ? 1 : -1;
  return {
    OVER: clamp(prices.OVER + sign * delta, MIN_PRICE, MAX_PRICE),
    UNDER: clamp(prices.UNDER - sign * delta, MIN_PRICE, MAX_PRICE),
  };
}
