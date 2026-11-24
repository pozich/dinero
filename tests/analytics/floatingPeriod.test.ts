import { describe, expect, it } from "vitest";
import { resolveFloatingPeriod, resolvePeriodSpec } from "../../src/analytics/floatingPeriod";

describe("resolveFloatingPeriod", () => {
  it("resolves thisMonth/thisQuarter/thisYear against now", () => {
    const now = new Date("2026-02-15T00:00:00.000Z");
    expect(resolveFloatingPeriod("thisMonth", now)).toEqual({
      start: "2026-02-01T00:00:00.000Z",
      end: "2026-03-01T00:00:00.000Z",
    });
    expect(resolveFloatingPeriod("thisQuarter", now)).toEqual({
      start: "2026-01-01T00:00:00.000Z",
      end: "2026-04-01T00:00:00.000Z",
    });
    expect(resolveFloatingPeriod("thisYear", now)).toEqual({
      start: "2026-01-01T00:00:00.000Z",
      end: "2027-01-01T00:00:00.000Z",
    });
  });

  it("covers exactly the last 3 whole months including the current one", () => {
    const now = new Date("2026-01-15T00:00:00.000Z");
    expect(resolveFloatingPeriod("last3Months", now)).toEqual({
      start: "2025-11-01T00:00:00.000Z",
      end: "2026-02-01T00:00:00.000Z",
    });
  });

  it("covers the last 12 months including the current one", () => {
    const now = new Date("2026-01-15T00:00:00.000Z");
    expect(resolveFloatingPeriod("last12Months", now)).toEqual({
      start: "2025-02-01T00:00:00.000Z",
      end: "2026-02-01T00:00:00.000Z",
    });
  });

  it("shifts to cover the new month once the calendar month changes", () => {
    const inJanuary = resolveFloatingPeriod("last3Months", new Date("2026-01-20T00:00:00.000Z"));
    const inFebruary = resolveFloatingPeriod("last3Months", new Date("2026-02-02T00:00:00.000Z"));
    expect(inJanuary).not.toEqual(inFebruary);
    expect(inFebruary.end).toBe("2026-03-01T00:00:00.000Z");
  });
});

describe("resolvePeriodSpec", () => {
  it("passes a fixed spec through untouched", () => {
    const spec = { kind: "fixed" as const, start: "2025-01-01T00:00:00.000Z", end: "2025-02-01T00:00:00.000Z" };
    expect(resolvePeriodSpec(spec)).toEqual({ start: spec.start, end: spec.end });
  });

  it("resolves a floating spec against now", () => {
    const now = new Date("2026-02-15T00:00:00.000Z");
    expect(resolvePeriodSpec({ kind: "floating", id: "thisMonth" }, now)).toEqual(
      resolveFloatingPeriod("thisMonth", now),
    );
  });
});
