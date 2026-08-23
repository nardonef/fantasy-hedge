import { describe, expect, it } from "vitest";
import { injuryProtectionPrices } from "./injury-protection-pricing";

describe("injuryProtectionPrices", () => {
  it("sums the three tiers' pre-vig probabilities to 1", () => {
    const prices = injuryProtectionPrices({ position: "RB", riskMultiplier: 1, vig: 0 });
    expect(prices.ZERO_GAMES + prices.ONE_TO_TWO_GAMES + prices.THREE_PLUS_GAMES).toBeCloseTo(1, 5);
  });

  it("applies vig as a uniform markup across all three tiers", () => {
    const noVig = injuryProtectionPrices({ position: "RB", riskMultiplier: 1, vig: 0 });
    const withVig = injuryProtectionPrices({ position: "RB", riskMultiplier: 1, vig: 0.1 });
    expect(withVig.ZERO_GAMES).toBeCloseTo(noVig.ZERO_GAMES * 1.1, 5);
    expect(withVig.ONE_TO_TWO_GAMES).toBeCloseTo(noVig.ONE_TO_TWO_GAMES * 1.1, 5);
    expect(withVig.THREE_PLUS_GAMES).toBeCloseTo(noVig.THREE_PLUS_GAMES * 1.1, 5);
  });

  it("raises the missed-games tiers and lowers ZERO_GAMES as risk multiplier increases", () => {
    const baseline = injuryProtectionPrices({ position: "RB", riskMultiplier: 1, vig: 0 });
    const higherRisk = injuryProtectionPrices({ position: "RB", riskMultiplier: 1.5, vig: 0 });
    expect(higherRisk.THREE_PLUS_GAMES).toBeGreaterThan(baseline.THREE_PLUS_GAMES);
    expect(higherRisk.ZERO_GAMES).toBeLessThan(baseline.ZERO_GAMES);
  });

  it.each(["QB", "RB", "WR", "TE"] as const)("prices every known position (%s)", (position) => {
    const prices = injuryProtectionPrices({ position, riskMultiplier: 1, vig: 0.05 });
    expect(prices.ZERO_GAMES).toBeGreaterThan(0);
    expect(prices.ONE_TO_TWO_GAMES).toBeGreaterThan(0);
    expect(prices.THREE_PLUS_GAMES).toBeGreaterThan(0);
  });

  it("clamps to the tradeable band for an extreme risk multiplier", () => {
    const prices = injuryProtectionPrices({ position: "RB", riskMultiplier: 10, vig: 0.05 });
    expect(prices.THREE_PLUS_GAMES).toBeLessThanOrEqual(0.98);
    expect(prices.ZERO_GAMES).toBeGreaterThanOrEqual(0.02);
  });

  it("rejects a non-positive risk multiplier", () => {
    expect(() => injuryProtectionPrices({ position: "RB", riskMultiplier: 0, vig: 0.05 })).toThrow();
    expect(() => injuryProtectionPrices({ position: "RB", riskMultiplier: -1, vig: 0.05 })).toThrow();
  });

  it("rejects a negative vig", () => {
    expect(() => injuryProtectionPrices({ position: "RB", riskMultiplier: 1, vig: -0.01 })).toThrow();
  });
});
