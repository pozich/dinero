import { describe, expect, it } from "vitest";
import {
  DEFAULT_COLUMNS,
  reorderColumns,
  resizeColumn,
  toggleColumnVisibility,
  mergeWithDefaults,
  type ColumnConfig,
} from "../../src/features/operations/tableColumns";

describe("reorderColumns", () => {
  it("moves a column to a new position", () => {
    const keys = reorderColumns(DEFAULT_COLUMNS, 0, 2).map((c) => c.key);
    expect(keys).toEqual(["amount_tiyin", "description", "occurred_at", "category_name"]);
  });

  it("is a no-op for an out-of-range index", () => {
    expect(reorderColumns(DEFAULT_COLUMNS, 0, 99)).toEqual(DEFAULT_COLUMNS);
  });
});

describe("resizeColumn", () => {
  it("sets the width of the matching column only", () => {
    const next = resizeColumn(DEFAULT_COLUMNS, "description", 500);
    expect(next.find((c) => c.key === "description")?.width).toBe(500);
    expect(next.find((c) => c.key === "amount_tiyin")?.width).toBe(120);
  });

  it("clamps to a minimum width", () => {
    const next = resizeColumn(DEFAULT_COLUMNS, "description", 10);
    expect(next.find((c) => c.key === "description")?.width).toBe(60);
  });
});

describe("toggleColumnVisibility", () => {
  it("flips just the one column's visibility", () => {
    const next = toggleColumnVisibility(DEFAULT_COLUMNS, "category_name");
    expect(next.find((c) => c.key === "category_name")?.visible).toBe(false);
    expect(next.find((c) => c.key === "description")?.visible).toBe(true);
  });
});

describe("mergeWithDefaults", () => {
  it("keeps saved widths/visibility for columns that still exist", () => {
    const saved: ColumnConfig[] = [{ key: "description", width: 777, visible: false }];
    const merged = mergeWithDefaults(saved);
    expect(merged.find((c) => c.key === "description")).toEqual({
      key: "description",
      width: 777,
      visible: false,
    });
    expect(merged.find((c) => c.key === "amount_tiyin")).toEqual(
      DEFAULT_COLUMNS.find((c) => c.key === "amount_tiyin"),
    );
  });
});
