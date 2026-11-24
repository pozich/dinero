import { describe, expect, it } from "vitest";
import { computeMetrics, computeCategoryChanges } from "../../src/analytics/metrics";
import type { LedgerRow } from "../../src/db/ledgerQuery";

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

describe("computeMetrics", () => {
  it("sums income and expense separately, and computes сальдо/savings rate", () => {
    const rows = [
      row({ transactionId: 1, amountTiyin: 100000 }),
      row({ transactionId: 2, amountTiyin: -60000 }),
    ];
    const metrics = computeMetrics(rows, { periodDays: 30, includeDividends: true });
    expect(metrics.incomeTiyin).toBe(100000);
    expect(metrics.expenseTiyin).toBe(-60000);
    expect(metrics.netTiyin).toBe(40000);
    expect(metrics.savingsRatePercent).toBe(40);
  });

  it("ignores rows the ledger already excluded", () => {
    const rows = [row({ excluded: true, amountTiyin: -999999 }), row({ amountTiyin: -1000 })];
    const metrics = computeMetrics(rows, { periodDays: 1, includeDividends: true });
    expect(metrics.expenseTiyin).toBe(-1000);
  });

  it("excludes dividend income when includeDividends is false, counts it when true", () => {
    const rows = [row({ amountTiyin: 50000, isInvestmentIncome: true })];
    expect(
      computeMetrics(rows, { periodDays: 30, includeDividends: false }).incomeTiyin,
    ).toBe(0);
    expect(
      computeMetrics(rows, { periodDays: 30, includeDividends: true }).incomeTiyin,
    ).toBe(50000);
  });

  it("returns null savings rate when there's no income to divide by", () => {
    const rows = [row({ amountTiyin: -1000 })];
    expect(computeMetrics(rows, { periodDays: 1, includeDividends: true }).savingsRatePercent).toBeNull();
  });

  it("lists the biggest individual spends, most negative first", () => {
    const rows = [
      row({ transactionId: 1, amountTiyin: -500 }),
      row({ transactionId: 2, amountTiyin: -5000 }),
      row({ transactionId: 3, amountTiyin: -1000 }),
    ];
    const metrics = computeMetrics(rows, { periodDays: 1, includeDividends: true });
    expect(metrics.topSpends.map((s) => s.transactionId)).toEqual([2, 3, 1]);
  });

  it("averages the expense per day and derives a per-month figure from it", () => {
    const rows = [row({ amountTiyin: -30000 })];
    const metrics = computeMetrics(rows, { periodDays: 30, includeDividends: true });
    expect(metrics.avgPerDayTiyin).toBe(-1000);
    expect(metrics.avgPerMonthTiyin).toBe(-30000);
  });
});

describe("computeCategoryChanges", () => {
  it("computes the delta for a category present in both periods", () => {
    const current = [row({ categoryId: 1, amountTiyin: -1200 })];
    const previous = [row({ categoryId: 1, amountTiyin: -1000 })];
    const [change] = computeCategoryChanges(current, previous, []);
    expect(change).toMatchObject({ currentTiyin: -1200, previousTiyin: -1000, deltaTiyin: -200 });
  });

  it("treats a category missing from one period as zero there, instead of dropping it", () => {
    const current = [row({ categoryId: 1, amountTiyin: -500 })];
    const previous: LedgerRow[] = [];
    const [change] = computeCategoryChanges(current, previous, []);
    expect(change).toMatchObject({ currentTiyin: -500, previousTiyin: 0 });
  });

  it("sorts by the biggest absolute change first", () => {
    const current = [
      row({ categoryId: 1, amountTiyin: -1100 }),
      row({ categoryId: 2, amountTiyin: -2000 }),
    ];
    const previous = [
      row({ categoryId: 1, amountTiyin: -1000 }), // delta -100
      row({ categoryId: 2, amountTiyin: -500 }), // delta -1500
    ];
    const changes = computeCategoryChanges(current, previous, []);
    expect(changes[0].categoryKey).toBe("2");
  });
});
