import { describe, expect, it } from "vitest";
import { formatTransactionDate, spansMultipleYears } from "../../src/features/operations/dateFormat";
import { formatTiyin, parseTiyinInput } from "../../src/features/operations/money";
import { toggleSort, addSecondarySort } from "../../src/features/operations/sorting";

describe("formatTransactionDate", () => {
  it("omits the year by default", () => {
    expect(formatTransactionDate("2026-10-25T00:00:00.000Z", false)).toBe("Oct 25");
  });

  it("includes the year when asked to", () => {
    expect(formatTransactionDate("2026-10-25T00:00:00.000Z", true)).toBe("Oct 25, 2026");
  });
});

describe("spansMultipleYears", () => {
  it("is false for a single year", () => {
    expect(
      spansMultipleYears(["2026-01-01T00:00:00.000Z", "2026-12-31T00:00:00.000Z"]),
    ).toBe(false);
  });

  it("is true once a second year appears", () => {
    expect(
      spansMultipleYears(["2025-12-31T00:00:00.000Z", "2026-01-01T00:00:00.000Z"]),
    ).toBe(true);
  });
});

describe("formatTiyin / parseTiyinInput", () => {
  it("formats signed tiyin as KZT with 2 decimals", () => {
    expect(formatTiyin(-1063117)).toBe("- 10 631,17 ₸");
    expect(formatTiyin(505000)).toBe("+ 5 050,00 ₸");
  });

  it("round-trips through parseTiyinInput", () => {
    expect(parseTiyinInput("10631.17")).toBe(1063117);
    expect(parseTiyinInput("10 631,17")).toBe(1063117);
    expect(parseTiyinInput("-500")).toBe(-50000);
  });

  it("rejects garbage input", () => {
    expect(parseTiyinInput("abc")).toBeNull();
    expect(parseTiyinInput("")).toBeNull();
  });
});

describe("toggleSort", () => {
  it("adds a new column as top priority, ascending", () => {
    expect(toggleSort([], "occurred_at")).toEqual([{ column: "occurred_at", direction: "asc" }]);
  });

  it("cycles an existing top column asc -> desc -> removed", () => {
    const asc = [{ column: "occurred_at", direction: "asc" }] as const;
    const desc = toggleSort([...asc], "occurred_at");
    expect(desc).toEqual([{ column: "occurred_at", direction: "desc" }]);
    expect(toggleSort(desc, "occurred_at")).toEqual([]);
  });

  it("promotes a newly clicked column ahead of an existing one", () => {
    const state = [{ column: "occurred_at", direction: "asc" }] as const;
    expect(toggleSort([...state], "amount_tiyin")).toEqual([
      { column: "amount_tiyin", direction: "asc" },
      { column: "occurred_at", direction: "asc" },
    ]);
  });
});

describe("addSecondarySort (Shift+click)", () => {
  it("appends a new column at the end, ascending — doesn't disturb priority", () => {
    const state = [{ column: "occurred_at", direction: "asc" }] as const;
    expect(addSecondarySort([...state], "amount_tiyin")).toEqual([
      { column: "occurred_at", direction: "asc" },
      { column: "amount_tiyin", direction: "asc" },
    ]);
  });

  it("cycles an existing secondary column in place: asc -> desc -> removed", () => {
    const state = [
      { column: "occurred_at", direction: "asc" },
      { column: "amount_tiyin", direction: "asc" },
    ] as const;
    const desc = addSecondarySort([...state], "amount_tiyin");
    expect(desc).toEqual([
      { column: "occurred_at", direction: "asc" },
      { column: "amount_tiyin", direction: "desc" },
    ]);
    expect(addSecondarySort(desc, "amount_tiyin")).toEqual([
      { column: "occurred_at", direction: "asc" },
    ]);
  });
});
