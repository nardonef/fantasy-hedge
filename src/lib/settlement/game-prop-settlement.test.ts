import { describe, expect, it } from "vitest";
import { settleGameProp } from "./game-prop-settlement";

describe("settleGameProp", () => {
  it.each([
    { actualValue: 80, thresholdValue: 74.5, expected: { OVER: 1, UNDER: 0 } },
    { actualValue: 60, thresholdValue: 74.5, expected: { OVER: 0, UNDER: 1 } },
    { actualValue: 74.6, thresholdValue: 74.5, expected: { OVER: 1, UNDER: 0 } },
    { actualValue: 74.4, thresholdValue: 74.5, expected: { OVER: 0, UNDER: 1 } },
    { actualValue: 0, thresholdValue: 0.5, expected: { OVER: 0, UNDER: 1 } },
  ])(
    "settles $actualValue vs threshold $thresholdValue",
    ({ actualValue, thresholdValue, expected }) => {
      const result = settleGameProp(actualValue, thresholdValue);
      expect(result).toEqual({ outcome: "SETTLED", payouts: expected });
    },
  );

  it.each([
    { actualValue: 74.5, thresholdValue: 74.5 },
    { actualValue: 0, thresholdValue: 0 },
    { actualValue: 100, thresholdValue: 100 },
  ])("pushes when the value lands exactly on the threshold ($actualValue)", ({ actualValue, thresholdValue }) => {
    expect(settleGameProp(actualValue, thresholdValue)).toEqual({ outcome: "PUSH" });
  });
});
