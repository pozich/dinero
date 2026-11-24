import { describe, expect, it } from "vitest";
import { normalizeRect, rectsIntersect } from "../../src/features/operations/marquee";

describe("normalizeRect", () => {
  it("normalizes regardless of drag direction", () => {
    expect(normalizeRect(10, 10, 50, 50)).toEqual({ left: 10, top: 10, right: 50, bottom: 50 });
    expect(normalizeRect(50, 50, 10, 10)).toEqual({ left: 10, top: 10, right: 50, bottom: 50 });
    expect(normalizeRect(50, 10, 10, 50)).toEqual({ left: 10, top: 10, right: 50, bottom: 50 });
  });
});

describe("rectsIntersect", () => {
  const marquee = normalizeRect(0, 0, 100, 100);

  it("is true for a rect fully inside", () => {
    expect(rectsIntersect(marquee, { left: 10, top: 10, right: 20, bottom: 20 })).toBe(true);
  });

  it("is true for a rect only partially overlapping", () => {
    expect(rectsIntersect(marquee, { left: 90, top: 90, right: 200, bottom: 200 })).toBe(true);
  });

  it("is false for a rect entirely outside", () => {
    expect(rectsIntersect(marquee, { left: 200, top: 200, right: 300, bottom: 300 })).toBe(false);
  });

  it("is false for rects that only touch at an edge", () => {
    expect(rectsIntersect(marquee, { left: 100, top: 0, right: 150, bottom: 50 })).toBe(false);
  });
});
