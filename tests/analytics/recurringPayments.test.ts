import { describe, expect, it } from "vitest";
import { findRecurringSeries } from "../../src/analytics/recurringPayments";
import type { LedgerRow } from "../../src/db/ledgerQuery";

function row(partial: Partial<LedgerRow>): LedgerRow {
  return {
    splitId: 1,
    transactionId: 1,
    categoryId: null,
    amountTiyin: -290000,
    isInvestmentIncome: false,
    excluded: false,
    reason: null,
    occurredAt: "2026-01-01T00:00:00.000Z",
    accountId: 1,
    accountName: "Kaspi Gold",
    accountKind: "kaspi_gold",
    description: "ANTHROPIC* CLAUDE SUB",
    note: null,
    ...partial,
  };
}

function monthly(count: number, amount = -290000, startMonth = 1): LedgerRow[] {
  return Array.from({ length: count }, (_, i) =>
    row({
      transactionId: i + 1,
      amountTiyin: amount,
      occurredAt: `2026-${String(startMonth + i).padStart(2, "0")}-01T00:00:00.000Z`,
    }),
  );
}

describe("findRecurringSeries", () => {
  it("detects a monthly subscription with 3+ occurrences of a similar amount", () => {
    const series = findRecurringSeries(monthly(4), { now: new Date("2026-05-01T00:00:00.000Z") });
    expect(series).toHaveLength(1);
    expect(series[0].interval).toBe("month");
    expect(series[0].occurrences).toHaveLength(4);
  });

  it("requires at least 3 occurrences", () => {
    expect(findRecurringSeries(monthly(2))).toHaveLength(0);
  });

  it("rejects a series whose amounts vary too much to be the same subscription", () => {
    const rows = [
      row({ transactionId: 1, amountTiyin: -1000, occurredAt: "2026-01-01T00:00:00.000Z" }),
      row({ transactionId: 2, amountTiyin: -5000, occurredAt: "2026-02-01T00:00:00.000Z" }),
      row({ transactionId: 3, amountTiyin: -1000, occurredAt: "2026-03-01T00:00:00.000Z" }),
    ];
    expect(findRecurringSeries(rows)).toHaveLength(0);
  });

  it("rejects a series whose gaps aren't a consistent interval", () => {
    const rows = [
      row({ transactionId: 1, occurredAt: "2026-01-01T00:00:00.000Z" }),
      row({ transactionId: 2, occurredAt: "2026-01-08T00:00:00.000Z" }), // a week later
      row({ transactionId: 3, occurredAt: "2026-04-01T00:00:00.000Z" }), // then months later
    ];
    expect(findRecurringSeries(rows)).toHaveLength(0);
  });

  it("detects a weekly series", () => {
    const rows = [
      row({ transactionId: 1, occurredAt: "2026-01-01T00:00:00.000Z" }),
      row({ transactionId: 2, occurredAt: "2026-01-08T00:00:00.000Z" }),
      row({ transactionId: 3, occurredAt: "2026-01-15T00:00:00.000Z" }),
      row({ transactionId: 4, occurredAt: "2026-01-22T00:00:00.000Z" }),
    ];
    const series = findRecurringSeries(rows, { now: new Date("2026-01-25T00:00:00.000Z") });
    expect(series[0].interval).toBe("week");
  });

  it("flags a price increase between the last two occurrences", () => {
    const rows = [
      ...monthly(3, -290000),
      row({ transactionId: 99, amountTiyin: -319000, occurredAt: "2026-04-01T00:00:00.000Z" }), // +10%
    ];
    const series = findRecurringSeries(rows, { now: new Date("2026-04-10T00:00:00.000Z") });
    expect(series[0].priceChangePercent).toBeCloseTo(10, 1);
  });

  it("flags a series as missed once well past its next expected date", () => {
    const series = findRecurringSeries(monthly(3), { now: new Date("2026-05-01T00:00:00.000Z") });
    expect(series[0].missed).toBe(true);
  });

  it("doesn't flag a series as missed when its next payment isn't due yet", () => {
    const series = findRecurringSeries(monthly(3), { now: new Date("2026-03-05T00:00:00.000Z") });
    expect(series[0].missed).toBe(false);
  });

  it("ignores rows the ledger already excluded", () => {
    const rows = monthly(3).map((r) => ({ ...r, excluded: true }));
    expect(findRecurringSeries(rows)).toHaveLength(0);
  });

  it("never groups expenses and income together even with the same description", () => {
    const rows = [
      row({ transactionId: 1, amountTiyin: -1000, occurredAt: "2026-01-01T00:00:00.000Z" }),
      row({ transactionId: 2, amountTiyin: 1000, occurredAt: "2026-02-01T00:00:00.000Z" }),
      row({ transactionId: 3, amountTiyin: -1000, occurredAt: "2026-03-01T00:00:00.000Z" }),
    ];
    expect(findRecurringSeries(rows)).toHaveLength(0);
  });
});
