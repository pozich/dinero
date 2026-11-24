import { describe, expect, it } from "vitest";
import {
  buildAccuracyWarning,
  formatAccuracyWarning,
  isAccuracyWarningEmpty,
} from "../../src/analytics/accuracyWarning";
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

const PERIOD: Period = { start: "2026-01-01T00:00:00.000Z", end: "2026-02-01T00:00:00.000Z" };

describe("buildAccuracyWarning", () => {
  it("counts uncategorized, non-excluded rows", () => {
    const rows = [row({ categoryId: null }), row({ categoryId: 1 }), row({ categoryId: null, excluded: true })];
    const warning = buildAccuracyWarning(rows, 0, [], PERIOD);
    expect(warning.uncategorizedCount).toBe(1);
  });

  it("passes through the unconfirmed links count untouched", () => {
    expect(buildAccuracyWarning([], 2, [], PERIOD).unconfirmedLinksCount).toBe(2);
  });

  it("reports only gaps overlapping the period, formatted per account", () => {
    const warning = buildAccuracyWarning(
      [],
      0,
      [
        { accountName: "Halyk", gaps: [{ start: "2026-01-01T00:00:00.000Z", end: "2026-01-15T00:00:00.000Z" }] },
        { accountName: "Kaspi", gaps: [{ start: "2025-06-01T00:00:00.000Z", end: "2025-06-15T00:00:00.000Z" }] },
      ],
      PERIOD,
    );
    expect(warning.gapDescriptions).toEqual(["Halyk: нет данных 01.01–15.01"]);
  });

  it("is empty when there's nothing to flag", () => {
    expect(isAccuracyWarningEmpty(buildAccuracyWarning([], 0, [], PERIOD))).toBe(true);
  });
});

describe("formatAccuracyWarning", () => {
  it("joins every part with a comma", () => {
    const warning = buildAccuracyWarning(
      [row({ categoryId: null })],
      2,
      [{ accountName: "Halyk", gaps: [{ start: "2026-01-01T00:00:00.000Z", end: "2026-01-15T00:00:00.000Z" }] }],
      PERIOD,
    );
    expect(formatAccuracyWarning(warning)).toBe(
      "1 операций без категории, 2 непроверенных переводов/возвратов, Halyk: нет данных 01.01–15.01",
    );
  });
});
