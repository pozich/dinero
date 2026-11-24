export type TradeForGolden = { isin: string; side: "buy" | "sell"; date: string; quantity: number };
export type SnapshotForGolden = { isin: string; date: string; quantity: number };

export type GoldenCheckRow = {
  isin: string;
  snapshotDate: string;
  estimatedQuantity: number;
  snapshotQuantity: number;
  discrepancy: number;
};

/**
 * SPEC-2.md 9.1's sverka: for every real snapshot, sum every trade up to
 * that date (buys add, sells subtract) and compare against what the
 * snapshot actually says was held. A trade whose quantity couldn't be
 * estimated (<=0, see estimateQuantity.ts) still counts as 0 here rather
 * than being dropped, since "missing" should show up as a discrepancy,
 * not silently vanish from the comparison.
 */
export function checkGolden(trades: readonly TradeForGolden[], snapshots: readonly SnapshotForGolden[]): GoldenCheckRow[] {
  return snapshots.map((snapshot) => {
    const estimatedQuantity = trades
      .filter((t) => t.isin === snapshot.isin && t.date <= snapshot.date)
      .reduce((sum, t) => sum + (t.side === "buy" ? t.quantity : -t.quantity), 0);
    return {
      isin: snapshot.isin,
      snapshotDate: snapshot.date,
      estimatedQuantity,
      snapshotQuantity: snapshot.quantity,
      discrepancy: estimatedQuantity - snapshot.quantity,
    };
  });
}
