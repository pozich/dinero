import { describe, expect, it } from "vitest";
import { detectSwipe } from "../../src/features/operations/swipeGesture";

describe("detectSwipe", () => {
  it("detects a clean leftward swipe", () => {
    expect(detectSwipe(200, 50, 100, 52)).toBe("left");
  });

  it("detects a clean rightward swipe", () => {
    expect(detectSwipe(100, 50, 200, 48)).toBe("right");
  });

  it("ignores a short movement (a tap)", () => {
    expect(detectSwipe(100, 50, 110, 50)).toBeNull();
  });

  it("ignores a mostly-vertical movement (a scroll)", () => {
    expect(detectSwipe(100, 50, 120, 300)).toBeNull();
  });
});
