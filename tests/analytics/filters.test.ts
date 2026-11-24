import { describe, expect, it } from "vitest";
import { applyAnalyticsFilters } from "../../src/analytics/filters";
import type { LedgerRow } from "../../src/db/ledgerQuery";

function row(partial: Partial<LedgerRow>): LedgerRow {
  return {
    splitId: 1,
    transactionId: 1,
    categoryId: 5,
    amountTiyin: -1000,
    isInvestmentIncome: false,
    excluded: false,
    reason: null,
    occurredAt: "2026-01-15T00:00:00.000Z",
    accountId: 1,
    accountName: "Kaspi Gold",
    accountKind: "kaspi_gold",
    description: "Магазин Small",
    note: null,
    ...partial,
  };
}

describe("applyAnalyticsFilters", () => {
  it("filters by account", () => {
    const rows = [row({ accountId: 1 }), row({ accountId: 2 })];
    expect(applyAnalyticsFilters(rows, { accountIds: [2] })).toHaveLength(1);
  });

  it("filters by category, excluding uncategorized when categories are picked", () => {
    const rows = [row({ categoryId: 5 }), row({ categoryId: null }), row({ categoryId: 6 })];
    expect(applyAnalyticsFilters(rows, { categoryIds: [5] })).toHaveLength(1);
  });

  it("filters by sign", () => {
    const rows = [row({ amountTiyin: 500 }), row({ amountTiyin: -500 })];
    expect(applyAnalyticsFilters(rows, { sign: "income" })).toHaveLength(1);
    expect(applyAnalyticsFilters(rows, { sign: "expense" })).toHaveLength(1);
  });

  it("filters by absolute amount range", () => {
    const rows = [row({ amountTiyin: -100 }), row({ amountTiyin: -10000 })];
    expect(applyAnalyticsFilters(rows, { minAmountTiyin: 1000 })).toHaveLength(1);
    expect(applyAnalyticsFilters(rows, { maxAmountTiyin: 1000 })).toHaveLength(1);
  });

  it("searches description and note case-insensitively", () => {
    const rows = [row({ description: "Magnum", note: null }), row({ description: "Other", note: "magnum receipt" })];
    expect(applyAnalyticsFilters(rows, { search: "MAGNUM" })).toHaveLength(2);
  });

  it("returns everything when no filters are set", () => {
    const rows = [row({}), row({})];
    expect(applyAnalyticsFilters(rows, {})).toHaveLength(2);
  });
});
