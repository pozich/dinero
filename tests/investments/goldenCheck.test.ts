import { describe, expect, it } from "vitest";
import { checkGolden } from "../../src/investments/goldenCheck";

describe("checkGolden", () => {
  it("matches exactly when cumulative trades agree with the snapshot", () => {
    const trades = [
      { isin: "X", side: "buy" as const, date: "2026-01-01", quantity: 5 },
      { isin: "X", side: "buy" as const, date: "2026-02-01", quantity: 3 },
      { isin: "X", side: "sell" as const, date: "2026-03-01", quantity: 2 },
    ];
    const snapshots = [{ isin: "X", date: "2026-03-15", quantity: 6 }];
    const [row] = checkGolden(trades, snapshots);
    expect(row).toEqual({ isin: "X", snapshotDate: "2026-03-15", estimatedQuantity: 6, snapshotQuantity: 6, discrepancy: 0 });
  });

  it("only counts trades up to and including the snapshot date", () => {
    const trades = [
      { isin: "X", side: "buy" as const, date: "2026-01-01", quantity: 5 },
      { isin: "X", side: "buy" as const, date: "2026-04-01", quantity: 10 }, // after the snapshot
    ];
    const snapshots = [{ isin: "X", date: "2026-02-01", quantity: 5 }];
    expect(checkGolden(trades, snapshots)[0].estimatedQuantity).toBe(5);
  });

  it("reports a nonzero discrepancy when they disagree", () => {
    const trades = [{ isin: "X", side: "buy" as const, date: "2026-01-01", quantity: 5 }];
    const snapshots = [{ isin: "X", date: "2026-02-01", quantity: 7 }];
    expect(checkGolden(trades, snapshots)[0].discrepancy).toBe(-2);
  });

  it("keeps different securities' trades separate", () => {
    const trades = [
      { isin: "X", side: "buy" as const, date: "2026-01-01", quantity: 5 },
      { isin: "Y", side: "buy" as const, date: "2026-01-01", quantity: 100 },
    ];
    const snapshots = [{ isin: "X", date: "2026-02-01", quantity: 5 }];
    expect(checkGolden(trades, snapshots)[0].estimatedQuantity).toBe(5);
  });

  it("checks one row per snapshot, independently", () => {
    const trades = [{ isin: "X", side: "buy" as const, date: "2026-01-01", quantity: 5 }];
    const snapshots = [
      { isin: "X", date: "2026-02-01", quantity: 5 },
      { isin: "X", date: "2026-03-01", quantity: 5 },
    ];
    expect(checkGolden(trades, snapshots)).toHaveLength(2);
  });
});
