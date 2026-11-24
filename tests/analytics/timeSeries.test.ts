import { describe, expect, it } from "vitest";
import { bucketLedgerRows, chooseBucketGranularity, cumulativeNet } from "../../src/analytics/timeSeries";
import type { LedgerRow } from "../../src/db/ledgerQuery";
import type { Period } from "../../src/analytics/period";

function row(partial: Partial<LedgerRow>): LedgerRow {
  return {
    splitId: 1,
    transactionId: 1,
    categoryId: null,
    amountTiyin: -1000,
    isInvestmentIncome: false,
    excluded: false,
    reason: null,
    occurredAt: "2026-01-15T00:00:00.000Z",
    accountId: 1,
    accountName: "Kaspi Gold",
    accountKind: "kaspi_gold",
    description: "Магазин",
    note: null,
    ...partial,
  };
}

describe("chooseBucketGranularity", () => {
  it("buckets a month by day", () => {
    const period: Period = { start: "2026-01-01T00:00:00.000Z", end: "2026-02-01T00:00:00.000Z" };
    expect(chooseBucketGranularity(period)).toBe("day");
  });

  it("buckets a year by month", () => {
    const period: Period = { start: "2026-01-01T00:00:00.000Z", end: "2027-01-01T00:00:00.000Z" };
    expect(chooseBucketGranularity(period)).toBe("month");
  });
});

describe("bucketLedgerRows", () => {
  it("sums income and expense into the right day bucket", () => {
    const period: Period = { start: "2026-01-01T00:00:00.000Z", end: "2026-01-04T00:00:00.000Z" };
    const rows = [
      row({ transactionId: 1, amountTiyin: -500, occurredAt: "2026-01-01T10:00:00.000Z" }),
      row({ transactionId: 2, amountTiyin: 100000, occurredAt: "2026-01-01T12:00:00.000Z" }),
      row({ transactionId: 3, amountTiyin: -200, occurredAt: "2026-01-03T00:00:00.000Z" }),
    ];
    const buckets = bucketLedgerRows(rows, period, "day");
    expect(buckets).toHaveLength(3);
    expect(buckets[0]).toMatchObject({ incomeTiyin: 100000, expenseTiyin: -500, netTiyin: 99500 });
    expect(buckets[1]).toMatchObject({ incomeTiyin: 0, expenseTiyin: 0, netTiyin: 0 });
    expect(buckets[2]).toMatchObject({ incomeTiyin: 0, expenseTiyin: -200, netTiyin: -200 });
  });

  it("ignores excluded rows", () => {
    const period: Period = { start: "2026-01-01T00:00:00.000Z", end: "2026-01-02T00:00:00.000Z" };
    const rows = [row({ amountTiyin: -99999, excluded: true })];
    expect(bucketLedgerRows(rows, period, "day")[0].netTiyin).toBe(0);
  });

  it("drops a row that falls outside every bucket", () => {
    const period: Period = { start: "2026-01-01T00:00:00.000Z", end: "2026-01-02T00:00:00.000Z" };
    const rows = [row({ occurredAt: "2026-03-01T00:00:00.000Z" })];
    expect(bucketLedgerRows(rows, period, "day")[0].netTiyin).toBe(0);
  });

  it("buckets a year-long period by calendar month", () => {
    const period: Period = { start: "2026-01-01T00:00:00.000Z", end: "2026-04-01T00:00:00.000Z" };
    const rows = [
      row({ occurredAt: "2026-01-15T00:00:00.000Z", amountTiyin: -100 }),
      row({ occurredAt: "2026-03-31T23:00:00.000Z", amountTiyin: -200 }),
    ];
    const buckets = bucketLedgerRows(rows, period, "month");
    expect(buckets).toHaveLength(3);
    expect(buckets.map((b) => b.label)).toEqual(["01.2026", "02.2026", "03.2026"]);
    expect(buckets[0].netTiyin).toBe(-100);
    expect(buckets[2].netTiyin).toBe(-200);
  });
});

describe("cumulativeNet", () => {
  it("runs a cumulative sum across buckets", () => {
    const period: Period = { start: "2026-01-01T00:00:00.000Z", end: "2026-01-04T00:00:00.000Z" };
    const rows = [
      row({ occurredAt: "2026-01-01T00:00:00.000Z", amountTiyin: 100 }),
      row({ occurredAt: "2026-01-02T00:00:00.000Z", amountTiyin: -40 }),
      row({ occurredAt: "2026-01-03T00:00:00.000Z", amountTiyin: 10 }),
    ];
    const buckets = bucketLedgerRows(rows, period, "day");
    expect(cumulativeNet(buckets)).toEqual([100, 60, 70]);
  });
});
