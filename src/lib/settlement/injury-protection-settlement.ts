import type { InjuryTierLabel } from "@/lib/pricing/injury-risk-tables";

export type InjuryProtectionSettlementResult = { outcome: "SETTLED"; payouts: Record<InjuryTierLabel, number> };

/**
 * Resolves an injury-protection market from a games-missed count. Unlike the OVER/UNDER
 * markets, there's no push case — games missed is a discrete non-negative integer that always
 * lands cleanly in exactly one of the three tiers.
 */
export function settleInjuryProtection(gamesMissed: number): InjuryProtectionSettlementResult {
  if (!Number.isInteger(gamesMissed) || gamesMissed < 0) {
    throw new Error(`gamesMissed must be a non-negative integer, got ${gamesMissed}`);
  }

  const winningTier: InjuryTierLabel =
    gamesMissed === 0 ? "ZERO_GAMES" : gamesMissed <= 2 ? "ONE_TO_TWO_GAMES" : "THREE_PLUS_GAMES";

  return {
    outcome: "SETTLED",
    payouts: {
      ZERO_GAMES: winningTier === "ZERO_GAMES" ? 1 : 0,
      ONE_TO_TWO_GAMES: winningTier === "ONE_TO_TWO_GAMES" ? 1 : 0,
      THREE_PLUS_GAMES: winningTier === "THREE_PLUS_GAMES" ? 1 : 0,
    },
  };
}
