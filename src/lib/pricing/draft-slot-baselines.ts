export type Position = "QB" | "RB" | "WR" | "TE";

/**
 * Hand-seeded expected full-season stat total for a round-1 pick at each position — not
 * derived from real projections. Round-over-round decay approximates typical fantasy
 * production dropoff without needing a value hand-picked for every round of every position.
 */
const ROUND_ONE_BASELINE: Partial<Record<Position, Record<string, number>>> = {
  RB: { rushing_yards: 1300, receiving_yards: 400 },
  WR: { receiving_yards: 1300 },
  QB: { passing_yards: 4200 },
  TE: { receiving_yards: 900 },
};

const ROUND_DECAY = 0.88;
const MAX_ROUND = 16;

/** The expected full-season stat total for a player drafted at this round and position. */
export function draftSlotBaseline(position: Position, statCategory: string, draftRound: number): number {
  if (!Number.isInteger(draftRound) || draftRound < 1 || draftRound > MAX_ROUND) {
    throw new Error(`draftRound must be an integer in [1, ${MAX_ROUND}], got ${draftRound}`);
  }

  const roundOne = ROUND_ONE_BASELINE[position]?.[statCategory];
  if (roundOne == null) {
    throw new Error(`No draft-slot baseline for ${position} / ${statCategory}`);
  }

  return roundOne * ROUND_DECAY ** (draftRound - 1);
}
