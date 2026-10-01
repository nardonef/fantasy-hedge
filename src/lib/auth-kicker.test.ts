import { describe, expect, it } from "vitest";
import { signInKicker } from "./auth-kicker";

describe("signInKicker", () => {
  it("shows week and open-market count", () => {
    expect(signInKicker({ week: 4, openCount: 37 })).toBe("WEEK 4 · 37 MARKETS OPEN");
  });

  it("falls back when there is no current week", () => {
    expect(signInKicker({ week: null, openCount: 12 })).toBe("VIRTUAL COINS · REAL ANXIETY");
  });

  it("falls back when no markets are open", () => {
    expect(signInKicker({ week: 4, openCount: 0 })).toBe("VIRTUAL COINS · REAL ANXIETY");
  });

  it("falls back when the summary is unavailable", () => {
    expect(signInKicker(null)).toBe("VIRTUAL COINS · REAL ANXIETY");
  });
});
