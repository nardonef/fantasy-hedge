import { describe, expect, it } from "vitest";
import { settleGameProp } from "./game-prop-settlement";
import { settleSeasonProduction } from "./season-production-settlement";

describe("settleSeasonProduction", () => {
  it("is the same over/under/push function as settleGameProp — the math doesn't change", () => {
    expect(settleSeasonProduction).toBe(settleGameProp);
  });

  it("settles a season total against a threshold", () => {
    expect(settleSeasonProduction(1360, 1000)).toEqual({ outcome: "SETTLED", payouts: { OVER: 1, UNDER: 0 } });
    expect(settleSeasonProduction(1000, 1000)).toEqual({ outcome: "PUSH" });
  });
});
