import { describe, expect, it } from "vitest";
import { settleInjuryProtection } from "./injury-protection-settlement";

describe("settleInjuryProtection", () => {
  it.each([
    { gamesMissed: 0, expected: { ZERO_GAMES: 1, ONE_TO_TWO_GAMES: 0, THREE_PLUS_GAMES: 0 } },
    { gamesMissed: 1, expected: { ZERO_GAMES: 0, ONE_TO_TWO_GAMES: 1, THREE_PLUS_GAMES: 0 } },
    { gamesMissed: 2, expected: { ZERO_GAMES: 0, ONE_TO_TWO_GAMES: 1, THREE_PLUS_GAMES: 0 } },
    { gamesMissed: 3, expected: { ZERO_GAMES: 0, ONE_TO_TWO_GAMES: 0, THREE_PLUS_GAMES: 1 } },
    { gamesMissed: 17, expected: { ZERO_GAMES: 0, ONE_TO_TWO_GAMES: 0, THREE_PLUS_GAMES: 1 } },
  ])("settles $gamesMissed games missed into the correct tier", ({ gamesMissed, expected }) => {
    expect(settleInjuryProtection(gamesMissed)).toEqual({ outcome: "SETTLED", payouts: expected });
  });

  it.each([-1, 1.5, Number.NaN])("rejects an invalid games-missed value (%s)", (gamesMissed) => {
    expect(() => settleInjuryProtection(gamesMissed)).toThrow();
  });
});
