export type Position = "QB" | "RB" | "WR" | "TE";
export type InjuryTierLabel = "ZERO_GAMES" | "ONE_TO_TWO_GAMES" | "THREE_PLUS_GAMES";

/**
 * Hand-seeded historical games-missed distribution by position — not derived from real injury
 * data. RBs take the most contact and have the shortest injury-protected careers, hence the
 * higher miss rate; QBs the least.
 */
const BASE_DISTRIBUTION: Record<Position, Record<InjuryTierLabel, number>> = {
  RB: { ZERO_GAMES: 0.45, ONE_TO_TWO_GAMES: 0.3, THREE_PLUS_GAMES: 0.25 },
  WR: { ZERO_GAMES: 0.55, ONE_TO_TWO_GAMES: 0.28, THREE_PLUS_GAMES: 0.17 },
  TE: { ZERO_GAMES: 0.55, ONE_TO_TWO_GAMES: 0.28, THREE_PLUS_GAMES: 0.17 },
  QB: { ZERO_GAMES: 0.65, ONE_TO_TWO_GAMES: 0.22, THREE_PLUS_GAMES: 0.13 },
};

/** The base (pre-risk-multiplier) probability of landing in each games-missed tier. */
export function injuryTierBaseProbabilities(position: Position): Record<InjuryTierLabel, number> {
  return BASE_DISTRIBUTION[position];
}
