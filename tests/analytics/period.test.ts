import { describe, expect, it } from "vitest";
import {
  currentPeriod,
  shiftPeriod,
  comparisonPeriod,
  formatPeriodLabel,
  periodDelta,
} from "../../src/analytics/period";

const NOW = new Date("2026-10-25T12:00:00.000Z");

describe("currentPeriod", () => {
  it("month: the whole calendar month, not a rolling 30 days", () => {
    expect(currentPeriod("month", NOW)).toEqual({
      start: "2026-10-01T00:00:00.000Z",
      end: "2026-11-01T00:00:00.000Z",
    });
  });

  it("quarter: Q4 for an October date", () => {
    expect(currentPeriod("quarter", NOW)).toEqual({
      start: "2026-10-01T00:00:00.000Z",
      end: "2027-01-01T00:00:00.000Z",
    });
  });

  it("year: the whole calendar year", () => {
    expect(currentPeriod("year", NOW)).toEqual({
      start: "2026-01-01T00:00:00.000Z",
      end: "2027-01-01T00:00:00.000Z",
    });
  });
});

describe("shiftPeriod", () => {
  it("month: moves to the previous/next whole month", () => {
    const month = currentPeriod("month", NOW);
    expect(shiftPeriod(month, "month", -1)).toEqual({
      start: "2026-09-01T00:00:00.000Z",
      end: "2026-10-01T00:00:00.000Z",
    });
    expect(shiftPeriod(month, "month", 1)).toEqual({
      start: "2026-11-01T00:00:00.000Z",
      end: "2026-12-01T00:00:00.000Z",
    });
  });

  it("year: moves a whole year, crossing Dec->Jan correctly via quarter too", () => {
    const quarter = currentPeriod("quarter", NOW); // Q4 2026
    expect(shiftPeriod(quarter, "quarter", 1)).toEqual({
      start: "2027-01-01T00:00:00.000Z",
      end: "2027-04-01T00:00:00.000Z",
    });
  });

  it("custom: shifts by its own exact length", () => {
    const custom = { start: "2026-01-01T00:00:00.000Z", end: "2026-01-11T00:00:00.000Z" }; // 10 days
    expect(shiftPeriod(custom, "custom", 1)).toEqual({
      start: "2026-01-11T00:00:00.000Z",
      end: "2026-01-21T00:00:00.000Z",
    });
  });
});

describe("comparisonPeriod", () => {
  it("previous: the immediately preceding calendar month, not 31 days earlier", () => {
    const month = currentPeriod("month", NOW); // Oct 2026 (31 days)
    expect(comparisonPeriod(month, "month", "previous")).toEqual({
      start: "2026-09-01T00:00:00.000Z",
      end: "2026-10-01T00:00:00.000Z",
    });
  });

  it("yearAgo: the same dates, one year earlier", () => {
    const month = currentPeriod("month", NOW);
    expect(comparisonPeriod(month, "month", "yearAgo")).toEqual({
      start: "2025-10-01T00:00:00.000Z",
      end: "2025-11-01T00:00:00.000Z",
    });
  });

  it("previous: a whole year goes back exactly one calendar year, leap year included", () => {
    const year = currentPeriod("year", new Date("2024-06-01T00:00:00.000Z")); // 2024 is a leap year
    expect(comparisonPeriod(year, "year", "previous")).toEqual({
      start: "2023-01-01T00:00:00.000Z",
      end: "2024-01-01T00:00:00.000Z",
    });
  });

  it("previous: a non-whole-month custom range still shifts by its own exact length", () => {
    const custom = { start: "2026-01-01T00:00:00.000Z", end: "2026-01-11T00:00:00.000Z" };
    expect(comparisonPeriod(custom, "custom", "previous")).toEqual({
      start: "2025-12-22T00:00:00.000Z",
      end: "2026-01-01T00:00:00.000Z",
    });
  });
});

describe("formatPeriodLabel", () => {
  it("formats a month as MM.YYYY", () => {
    expect(formatPeriodLabel(currentPeriod("month", NOW), "month")).toBe("10.2026");
  });

  it("formats a year as YYYY", () => {
    expect(formatPeriodLabel(currentPeriod("year", NOW), "year")).toBe("2026");
  });

  it("formats a quarter as Qn YYYY", () => {
    expect(formatPeriodLabel(currentPeriod("quarter", NOW), "quarter")).toBe("Q4 2026");
  });
});

describe("periodDelta", () => {
  it("computes both tiyin and percent deltas", () => {
    expect(periodDelta(1200, 1000)).toEqual({ deltaTiyin: 200, deltaPercent: 20 });
  });

  it("returns null percent when the comparison total was zero", () => {
    expect(periodDelta(500, 0)).toEqual({ deltaTiyin: 500, deltaPercent: null });
  });
});
