import { describe, expect, it } from "vitest";
import { computeAccountBalances } from "../../src/ledger/accountBalance";

describe("computeAccountBalances", () => {
  it("sums every transaction regardless of category/transfer/ignored status", () => {
    const results = computeAccountBalances(
      [
        { accountId: 1, occurredAt: "2026-01-01T00:00:00.000Z", amountTiyin: -10000 },
        { accountId: 1, occurredAt: "2026-01-02T00:00:00.000Z", amountTiyin: 5000 },
      ],
      [],
    );
    expect(results).toEqual([
      { accountId: 1, currentBalanceTiyin: -5000, discrepancyTiyin: null, asOfStatementPeriodEnd: null },
    ]);
  });

  it("has no discrepancy when the balance as of the statement matches its closing balance", () => {
    const results = computeAccountBalances(
      [
        { accountId: 1, occurredAt: "2026-01-15T00:00:00.000Z", amountTiyin: -10000 },
        { accountId: 1, occurredAt: "2026-01-20T00:00:00.000Z", amountTiyin: 5000 },
      ],
      [{ accountId: 1, periodEnd: "2026-01-31T00:00:00.000Z", closingBalanceTiyin: -5000 }],
    );
    expect(results[0].discrepancyTiyin).toBe(0);
  });

  it("flags a non-zero discrepancy", () => {
    const results = computeAccountBalances(
      [{ accountId: 1, occurredAt: "2026-01-15T00:00:00.000Z", amountTiyin: -10000 }],
      [{ accountId: 1, periodEnd: "2026-01-31T00:00:00.000Z", closingBalanceTiyin: -8000 }],
    );
    expect(results[0].discrepancyTiyin).toBe(-2000);
  });

  it("ignores a manual entry dated after the last statement's period end when computing the discrepancy", () => {
    const results = computeAccountBalances(
      [
        { accountId: 1, occurredAt: "2026-01-15T00:00:00.000Z", amountTiyin: -10000 },
        { accountId: 1, occurredAt: "2026-02-05T00:00:00.000Z", amountTiyin: -3000 }, // after the statement
      ],
      [{ accountId: 1, periodEnd: "2026-01-31T00:00:00.000Z", closingBalanceTiyin: -10000 }],
    );
    expect(results[0].discrepancyTiyin).toBe(0);
    expect(results[0].currentBalanceTiyin).toBe(-13000);
  });

  it("uses the statement with the latest period end when there are several", () => {
    const results = computeAccountBalances(
      [{ accountId: 1, occurredAt: "2026-01-15T00:00:00.000Z", amountTiyin: -1000 }],
      [
        { accountId: 1, periodEnd: "2025-12-31T00:00:00.000Z", closingBalanceTiyin: -500 },
        { accountId: 1, periodEnd: "2026-01-31T00:00:00.000Z", closingBalanceTiyin: -1000 },
      ],
    );
    expect(results[0].asOfStatementPeriodEnd).toBe("2026-01-31T00:00:00.000Z");
    expect(results[0].discrepancyTiyin).toBe(0);
  });
});
