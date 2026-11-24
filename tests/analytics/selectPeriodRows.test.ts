import { describe, expect, it } from "vitest";
import { selectPeriodRows } from "../../src/analytics/selectPeriodRows";
import type { LedgerRow } from "../../src/db/ledgerQuery";
import type { Period } from "../../src/analytics/period";

function row(partial: Partial<LedgerRow>): LedgerRow {
  return {
    splitId: 1,
    transactionId: 1,
    categoryId: 1,
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

describe("selectPeriodRows", () => {
  const period: Period = { start: "2026-01-01T00:00:00.000Z", end: "2026-02-01T00:00:00.000Z" };

  it("keeps only rows inside the period", () => {
    const rows = [
      row({ transactionId: 1, occurredAt: "2025-12-31T23:00:00.000Z" }),
      row({ transactionId: 2, occurredAt: "2026-01-15T00:00:00.000Z" }),
      row({ transactionId: 3, occurredAt: "2026-02-01T00:00:00.000Z" }),
    ];
    expect(selectPeriodRows(rows, period, {}).map((r) => r.transactionId)).toEqual([2]);
  });

  it("also applies the filter row on top of the period narrowing", () => {
    const rows = [row({ accountId: 1 }), row({ accountId: 2 })];
    expect(selectPeriodRows(rows, period, { accountIds: [2] })).toHaveLength(1);
  });
});
