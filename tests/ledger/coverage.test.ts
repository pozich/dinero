import { describe, expect, it } from "vitest";
import { findCoverageGaps, monthlyCoverage } from "../../src/ledger/coverage";

describe("findCoverageGaps", () => {
  it("finds the exact gap between two non-adjacent statements (SPEC-2.md 6.1's own example shape)", () => {
    const gaps = findCoverageGaps(
      [
        { periodStart: "2026-02-01T00:00:00.000Z", periodEnd: "2026-02-28T00:00:00.000Z" },
        { periodStart: "2026-03-16T00:00:00.000Z", periodEnd: "2026-03-31T00:00:00.000Z" },
      ],
      "2026-02-01T00:00:00.000Z",
      "2026-03-31T00:00:00.000Z",
    );
    expect(gaps).toEqual([{ start: "2026-02-28T00:00:00.000Z", end: "2026-03-16T00:00:00.000Z" }]);
  });

  it("merges overlapping periods before looking for gaps", () => {
    const gaps = findCoverageGaps(
      [
        { periodStart: "2026-01-01T00:00:00.000Z", periodEnd: "2026-02-15T00:00:00.000Z" },
        { periodStart: "2026-02-01T00:00:00.000Z", periodEnd: "2026-03-01T00:00:00.000Z" },
      ],
      "2026-01-01T00:00:00.000Z",
      "2026-03-01T00:00:00.000Z",
    );
    expect(gaps).toEqual([]);
  });

  it("reports a gap before the first statement and after the last one", () => {
    const gaps = findCoverageGaps(
      [{ periodStart: "2026-02-01T00:00:00.000Z", periodEnd: "2026-02-28T00:00:00.000Z" }],
      "2026-01-01T00:00:00.000Z",
      "2026-03-31T00:00:00.000Z",
    );
    expect(gaps).toEqual([
      { start: "2026-01-01T00:00:00.000Z", end: "2026-02-01T00:00:00.000Z" },
      { start: "2026-02-28T00:00:00.000Z", end: "2026-03-31T00:00:00.000Z" },
    ]);
  });

  it("reports the whole range as a gap when there are no statements at all", () => {
    const gaps = findCoverageGaps([], "2026-01-01T00:00:00.000Z", "2026-01-31T00:00:00.000Z");
    expect(gaps).toEqual([{ start: "2026-01-01T00:00:00.000Z", end: "2026-01-31T00:00:00.000Z" }]);
  });
});

describe("monthlyCoverage", () => {
  it("flags only the months a gap actually overlaps", () => {
    const gaps = [{ start: "2026-02-28T00:00:00.000Z", end: "2026-03-16T00:00:00.000Z" }];
    const months = monthlyCoverage(gaps, "2026-01-01T00:00:00.000Z", "2026-04-01T00:00:00.000Z");
    const byMonth = Object.fromEntries(months.map((m) => [m.month, m.hasGap]));
    expect(byMonth["2026-01"]).toBe(false);
    expect(byMonth["2026-02"]).toBe(true);
    expect(byMonth["2026-03"]).toBe(true);
    expect(byMonth["2026-04"]).toBe(false);
  });
});
