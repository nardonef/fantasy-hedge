import type { GamePropSide } from "@/lib/pricing/game-prop-pricing";

export type GamePropSettlementResult =
  | { outcome: "SETTLED"; payouts: Record<GamePropSide, number> }
  | { outcome: "PUSH" };

/**
 * Resolves a single-game player prop: which side wins, or a push when the stat lands exactly
 * on the threshold. A push doesn't fit the flat payoutRatio-per-share model (holders may have
 * paid different entry prices after repricing) — callers should void the market and refund
 * each position's own stake instead of writing a settlements row for a push.
 */
export function settleGameProp(
  actualValue: number,
  thresholdValue: number,
): GamePropSettlementResult {
  if (actualValue === thresholdValue) return { outcome: "PUSH" };
  return actualValue > thresholdValue
    ? { outcome: "SETTLED", payouts: { OVER: 1, UNDER: 0 } }
    : { outcome: "SETTLED", payouts: { OVER: 0, UNDER: 1 } };
}
