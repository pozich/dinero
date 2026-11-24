import { describe, expect, it } from "vitest";
import { selectSingle, toggleSelection, selectRange, selectAll } from "../../src/features/operations/selection";

const rows = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }];

describe("selectSingle", () => {
  it("replaces the selection with just that id", () => {
    expect(selectSingle(3)).toEqual(new Set([3]));
  });
});

describe("toggleSelection", () => {
  it("adds an id that wasn't selected", () => {
    expect(toggleSelection(new Set([1]), 2)).toEqual(new Set([1, 2]));
  });

  it("removes an id that was already selected", () => {
    expect(toggleSelection(new Set([1, 2]), 2)).toEqual(new Set([1]));
  });
});

describe("selectRange", () => {
  it("selects everything between anchor and clicked, inclusive, either direction", () => {
    expect(selectRange(rows, 2, 4)).toEqual(new Set([2, 3, 4]));
    expect(selectRange(rows, 4, 2)).toEqual(new Set([2, 3, 4]));
  });

  it("falls back to just the clicked id if the anchor no longer exists", () => {
    expect(selectRange(rows, 999, 3)).toEqual(new Set([3]));
  });
});

describe("selectAll", () => {
  it("selects every row given", () => {
    expect(selectAll(rows)).toEqual(new Set([1, 2, 3, 4, 5]));
  });
});
