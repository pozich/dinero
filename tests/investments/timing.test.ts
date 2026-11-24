import { describe, expect, it } from "vitest";
import { computeTimingPercent } from "../../src/investments/timing";

describe("computeTimingPercent", () => {
  it("is positive when the purchase price is above the month's average (overpaid)", () => {
    expect(computeTimingPercent(1100, 1000)).toBe(10);
  });

  it("is negative when the purchase price is below the month's average (saved)", () => {
    expect(computeTimingPercent(900, 1000)).toBe(-10);
  });

  it("returns null when there's no average to compare against", () => {
    expect(computeTimingPercent(1000, 0)).toBeNull();
  });
});
