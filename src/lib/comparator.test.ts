import { describe, expect, it } from "vitest";
import { comparatorSymbol } from "./comparator";

describe("comparatorSymbol", () => {
  it("maps every comparator to its symbol", () => {
    expect(comparatorSymbol("OVER")).toBe(">");
    expect(comparatorSymbol("UNDER")).toBe("<");
    expect(comparatorSymbol("AT_LEAST")).toBe("≥");
    expect(comparatorSymbol("EXACTLY")).toBe("=");
  });
});
