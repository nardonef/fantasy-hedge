import { describe, expect, it } from "vitest";
import { formatCoins } from "./wallet-constants";

describe("formatCoins", () => {
  it("formats minor units as whole coins with separators", () => {
    expect(formatCoins(100_000)).toBe("1,000");
    expect(formatCoins(0)).toBe("0");
  });
});
