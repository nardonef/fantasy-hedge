import { describe, expect, it } from "vitest";
import { projectedSeasonTotal, seasonProductionPrices } from "./season-production-pricing";

describe("projectedSeasonTotal", () => {
  it("returns the baseline unchanged before any games are played", () => {
    expect(projectedSeasonTotal({ gamesPlayed: 0, totalGames: 17, statToDate: 0, baseline: 1000 })).toBe(1000);
  });

  it("returns the actual pace once the season is fully played", () => {
    const result = projectedSeasonTotal({ gamesPlayed: 17, totalGames: 17, statToDate: 1360, baseline: 1000 });
    expect(result).toBeCloseTo(1360, 5);
  });

  it("blends baseline and pace proportionally to games played", () => {
    // Halfway through, pacing well above baseline — projection should sit between the two.
    const result = projectedSeasonTotal({ gamesPlayed: 8, totalGames: 16, statToDate: 640, baseline: 1000 });
    // paceTotal = 640/8*16 = 1280; blend at 50% => (1000+1280)/2 = 1140
    expect(result).toBeCloseTo(1140, 5);
  });

  it("rejects gamesPlayed outside [0, totalGames]", () => {
    expect(() => projectedSeasonTotal({ gamesPlayed: -1, totalGames: 17, statToDate: 0, baseline: 1000 })).toThrow();
    expect(() => projectedSeasonTotal({ gamesPlayed: 18, totalGames: 17, statToDate: 0, baseline: 1000 })).toThrow();
  });

  it("rejects a non-positive totalGames", () => {
    expect(() => projectedSeasonTotal({ gamesPlayed: 0, totalGames: 0, statToDate: 0, baseline: 1000 })).toThrow();
  });
});

describe("seasonProductionPrices", () => {
  it("prices near 50/50 when the projection sits right on the threshold", () => {
    const prices = seasonProductionPrices({ projectedTotal: 1000, thresholdValue: 1000, sensitivity: 400, vig: 0.08 });
    expect(prices.OVER).toBeCloseTo(0.54, 2);
    expect(prices.UNDER).toBeCloseTo(0.54, 2);
  });

  it("favors OVER when the projection sits well above the threshold", () => {
    const prices = seasonProductionPrices({ projectedTotal: 1400, thresholdValue: 1000, sensitivity: 400, vig: 0.08 });
    expect(prices.OVER).toBeGreaterThan(prices.UNDER);
  });

  it("favors UNDER when the projection sits well below the threshold", () => {
    const prices = seasonProductionPrices({ projectedTotal: 600, thresholdValue: 1000, sensitivity: 400, vig: 0.08 });
    expect(prices.UNDER).toBeGreaterThan(prices.OVER);
  });

  it("clamps to the tradeable band for an extreme projection gap", () => {
    const prices = seasonProductionPrices({ projectedTotal: 5000, thresholdValue: 1000, sensitivity: 400, vig: 0.08 });
    expect(prices.OVER).toBeLessThanOrEqual(0.98);
    expect(prices.UNDER).toBeGreaterThanOrEqual(0.02);
  });

  it("rejects a non-positive sensitivity", () => {
    expect(() =>
      seasonProductionPrices({ projectedTotal: 1000, thresholdValue: 1000, sensitivity: 0, vig: 0.08 }),
    ).toThrow();
  });

  it("rejects a negative vig", () => {
    expect(() =>
      seasonProductionPrices({ projectedTotal: 1000, thresholdValue: 1000, sensitivity: 400, vig: -0.01 }),
    ).toThrow();
  });
});
