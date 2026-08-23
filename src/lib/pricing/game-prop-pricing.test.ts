import { describe, expect, it } from "vitest";
import { initialGamePropPrices, repriceAfterTrade } from "./game-prop-pricing";

describe("initialGamePropPrices", () => {
  it.each([
    { initialProbability: 0.5, vig: 0.08, expected: { OVER: 0.54, UNDER: 0.54 } },
    { initialProbability: 0.75, vig: 0.08, expected: { OVER: 0.81, UNDER: 0.27 } },
    { initialProbability: 0.5, vig: 0, expected: { OVER: 0.5, UNDER: 0.5 } },
  ])(
    "prices OVER/UNDER from a $initialProbability probability and $vig vig",
    ({ initialProbability, vig, expected }) => {
      const prices = initialGamePropPrices({ initialProbability, vig });
      expect(prices.OVER).toBeCloseTo(expected.OVER, 5);
      expect(prices.UNDER).toBeCloseTo(expected.UNDER, 5);
    },
  );

  it("clamps extreme probabilities into the tradeable band", () => {
    const prices = initialGamePropPrices({ initialProbability: 0.99, vig: 0.08 });
    expect(prices.OVER).toBeLessThanOrEqual(0.98);
  });

  it.each([0, 1, -0.1, 1.1])("rejects an out-of-range probability %s", (initialProbability) => {
    expect(() => initialGamePropPrices({ initialProbability, vig: 0.08 })).toThrow();
  });

  it("rejects a negative vig", () => {
    expect(() => initialGamePropPrices({ initialProbability: 0.5, vig: -0.01 })).toThrow();
  });
});

describe("repriceAfterTrade", () => {
  const starting = { OVER: 0.5, UNDER: 0.5 };

  it("moves the bought side's price up and the other side down", () => {
    const result = repriceAfterTrade(starting, "OVER", 1);
    expect(result.OVER).toBeGreaterThan(starting.OVER);
    expect(result.UNDER).toBeLessThan(starting.UNDER);
  });

  it("scales the move with quantity", () => {
    const one = repriceAfterTrade(starting, "OVER", 1);
    const five = repriceAfterTrade(starting, "OVER", 5);
    expect(five.OVER - starting.OVER).toBeCloseTo((one.OVER - starting.OVER) * 5, 5);
  });

  it("moves UNDER up and OVER down when UNDER is bought", () => {
    const result = repriceAfterTrade(starting, "UNDER", 1);
    expect(result.UNDER).toBeGreaterThan(starting.UNDER);
    expect(result.OVER).toBeLessThan(starting.OVER);
  });

  it("clamps to the tradeable band on a large buy", () => {
    const result = repriceAfterTrade(starting, "OVER", 1000);
    expect(result.OVER).toBeLessThanOrEqual(0.98);
    expect(result.UNDER).toBeGreaterThanOrEqual(0.02);
  });

  it("rejects a non-positive quantity", () => {
    expect(() => repriceAfterTrade(starting, "OVER", 0)).toThrow();
    expect(() => repriceAfterTrade(starting, "OVER", -1)).toThrow();
  });
});
