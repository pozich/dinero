import type { DbClient } from "./types";
import type { ParsedSnapshot } from "../parsers/halykSnapshot";

export type SnapshotRow = { isin: string; date: string; quantity: number };

export async function listSnapshots(db: DbClient, isin?: string): Promise<SnapshotRow[]> {
  const rows = isin
    ? await db.select<{ security_isin: string; snapshot_date: string; quantity: number }[]>(
        "SELECT security_isin, snapshot_date, quantity FROM security_snapshots WHERE security_isin = $1 ORDER BY snapshot_date",
        [isin],
      )
    : await db.select<{ security_isin: string; snapshot_date: string; quantity: number }[]>(
        "SELECT security_isin, snapshot_date, quantity FROM security_snapshots ORDER BY snapshot_date",
      );
  return rows.map((r) => ({ isin: r.security_isin, date: r.snapshot_date, quantity: r.quantity }));
}

async function upsertSnapshot(db: DbClient, isin: string, date: string, quantity: number): Promise<void> {
  await db.execute(
    `INSERT INTO security_snapshots (security_isin, snapshot_date, quantity) VALUES ($1, $2, $3)
     ON CONFLICT (security_isin, snapshot_date) DO UPDATE SET quantity = excluded.quantity`,
    [isin, date, quantity],
  );
}

/** Idempotent — importing the same snapshot file twice just overwrites
 * the same (isin, date) rows rather than duplicating them. */
export async function importSnapshot(db: DbClient, parsed: ParsedSnapshot): Promise<void> {
  for (const holding of parsed.holdings) {
    await upsertSnapshot(db, holding.isin, parsed.snapshotDate, holding.quantity);
  }
}
