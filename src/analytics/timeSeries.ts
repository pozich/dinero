import type { LedgerRow } from "../db/ledgerQuery";
import type { Period } from "./period";

export type TimeBucket = {
  start: string;
  end: string;
  label: string;
  incomeTiyin: number;
  expenseTiyin: number;
  netTiyin: number;
  transactionIds: number[];
};

export type BucketGranularity = "day" | "month";

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

/** More than ~2 months of daily bars is unreadable, so anything quarter-or-
 * longer buckets by month instead (SPEC-2.md 6.4 "столбцы по периодам"). */
export function chooseBucketGranularity(period: Period): BucketGranularity {
  const days = (new Date(period.end).getTime() - new Date(period.start).getTime()) / 86_400_000;
  return days > 62 ? "month" : "day";
}

/**
 * Splits `period` into equal calendar buckets (days or months) and sums the
 * ledger rows falling into each — the data a time-series bar/line/heatmap
 * chart draws from. Bucket index is computed directly from the date instead
 * of scanning every bucket per row, so this stays O(rows + buckets) even at
 * 20 000+ operations (SPEC-2.md 6.5's done-criterion).
 */
export function bucketLedgerRows(
  rows: readonly LedgerRow[],
  period: Period,
  granularity: BucketGranularity,
): TimeBucket[] {
  const start = new Date(period.start);
  const end = new Date(period.end);
  const buckets: TimeBucket[] = [];

  let cursor = start;
  while (cursor < end) {
    const next: Date =
      granularity === "day"
        ? new Date(cursor.getTime() + 86_400_000)
        : new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1));
    const label =
      granularity === "day"
        ? `${pad(cursor.getUTCDate())}.${pad(cursor.getUTCMonth() + 1)}`
        : `${pad(cursor.getUTCMonth() + 1)}.${cursor.getUTCFullYear()}`;
    buckets.push({
      start: cursor.toISOString(),
      end: next.toISOString(),
      label,
      incomeTiyin: 0,
      expenseTiyin: 0,
      netTiyin: 0,
      transactionIds: [],
    });
    cursor = next;
  }

  function indexFor(occurredAt: string): number {
    const d = new Date(occurredAt);
    if (granularity === "day") {
      return Math.floor((d.getTime() - start.getTime()) / 86_400_000);
    }
    return (d.getUTCFullYear() - start.getUTCFullYear()) * 12 + (d.getUTCMonth() - start.getUTCMonth());
  }

  for (const row of rows) {
    if (row.excluded) continue;
    const bucket = buckets[indexFor(row.occurredAt)];
    if (!bucket) continue;
    if (row.amountTiyin >= 0) bucket.incomeTiyin += row.amountTiyin;
    else bucket.expenseTiyin += row.amountTiyin;
    bucket.netTiyin += row.amountTiyin;
    bucket.transactionIds.push(row.transactionId);
  }

  return buckets;
}

/** Cumulative running net across buckets, for the "накопительный остаток"
 * line (SPEC-2.md 6.4) — a running sum of the ledger's own net, not the
 * account's real balance (which includes transfers/ignored rows too). */
export function cumulativeNet(buckets: readonly TimeBucket[]): number[] {
  let running = 0;
  return buckets.map((b) => {
    running += b.netTiyin;
    return running;
  });
}
