import { describe, expect, it } from "vitest";
import { estimateQuantity } from "../../src/investments/estimateQuantity";

describe("estimateQuantity", () => {
  it("divides and rounds to the nearest whole share", () => {
    expect(estimateQuantity(2178000, 1089000)).toBe(2); // 21780 / 10890 KZT
  });

  it("rounds, not truncates", () => {
    expect(estimateQuantity(2178000, 1100000)).toBe(2); // 21780/11000 = 1.98 -> rounds up
  });

  it("returns null when there's no price to divide by", () => {
    expect(estimateQuantity(2178000, 0)).toBeNull();
    expect(estimateQuantity(2178000, -100)).toBeNull();
  });

  it("returns null for a non-positive amount", () => {
    expect(estimateQuantity(0, 1000)).toBeNull();
    expect(estimateQuantity(-1000, 1000)).toBeNull();
  });
});
