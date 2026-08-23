import { type InjuryTierLabel, type Position, injuryTierBaseProbabilities } from "./injury-risk-tables";

export type InjuryProtectionPrices = Record<InjuryTierLabel, number>;

export type InjuryProtectionPricingParams = {
  position: Position;
  /** Multiplies the base games-missed risk — >1 for an injury history or age flag, hand-set at MVP. */
  riskMultiplier: number;
  /** Total overround applied across all tiers, same convention as the other pricing modules. */
  vig: number;
};

const MIN_PRICE = 0.02;
const MAX_PRICE = 0.98;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Scales a position's base games-missed distribution by a per-player risk multiplier — the
 * missed-games tiers grow with risk, ZERO_GAMES shrinks correspondingly so the three tiers
 * still sum to 1 before vig.
 */
export function injuryProtectionPrices(params: InjuryProtectionPricingParams): InjuryProtectionPrices {
  const { position, riskMultiplier, vig } = params;
  if (riskMultiplier <= 0) throw new Error(`riskMultiplier must be > 0, got ${riskMultiplier}`);
  if (vig < 0) throw new Error(`vig must be >= 0, got ${vig}`);

  const base = injuryTierBaseProbabilities(position);
  const oneToTwo = clamp(base.ONE_TO_TWO_GAMES * riskMultiplier, 0, 1);
  const threePlus = clamp(base.THREE_PLUS_GAMES * riskMultiplier, 0, 1);
  const zero = Math.max(0, 1 - oneToTwo - threePlus);

  const total = zero + oneToTwo + threePlus;

  return {
    ZERO_GAMES: clamp((zero / total) * (1 + vig), MIN_PRICE, MAX_PRICE),
    ONE_TO_TWO_GAMES: clamp((oneToTwo / total) * (1 + vig), MIN_PRICE, MAX_PRICE),
    THREE_PLUS_GAMES: clamp((threePlus / total) * (1 + vig), MIN_PRICE, MAX_PRICE),
  };
}
