import type { DbClient } from "./types";
import { insertTransferLink, type TransferLinkKind, type TransferLinkStatus } from "./transactions";

export type TransferLink = {
  id: number;
  from_transaction_id: number;
  to_transaction_id: number;
  status: TransferLinkStatus;
  kind: TransferLinkKind;
};

/** Order-independent key for a pair of transaction ids — a rejected pair is
 * remembered by this key, not by which side was "from" (SPEC-2.md 3.1). */
export function pairKey(a: number, b: number): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

export function confirmTransferLink(
  db: DbClient,
  fromTransactionId: number,
  toTransactionId: number,
  kind: TransferLinkKind,
): Promise<number> {
  return insertTransferLink(db, fromTransactionId, toTransactionId, { status: "confirmed", kind });
}

export function rejectTransferLink(
  db: DbClient,
  fromTransactionId: number,
  toTransactionId: number,
  kind: TransferLinkKind,
): Promise<number> {
  return insertTransferLink(db, fromTransactionId, toTransactionId, { status: "rejected", kind });
}

export async function unlinkTransferLink(db: DbClient, id: number): Promise<void> {
  await db.execute("DELETE FROM transfer_links WHERE id = $1", [id]);
}

export function listConfirmedLinksForTransaction(
  db: DbClient,
  transactionId: number,
): Promise<TransferLink[]> {
  // Two independent placeholders, not one reused — sqlx binds each `$N`
  // occurrence positionally, not by index, so reusing $1 twice needs two
  // values, not one (see the same fix elsewhere: transactionsQuery.ts,
  // statements.ts's deleteStatement).
  return db.select<TransferLink[]>(
    `SELECT * FROM transfer_links
     WHERE status = 'confirmed' AND (from_transaction_id = $1 OR to_transaction_id = $2)`,
    [transactionId, transactionId],
  );
}

/** Transactions already on either side of a *confirmed* link — excluded
 * from the candidate pool entirely, since they're already resolved. A
 * rejected link does NOT exclude its transactions this way: rejecting
 * "A↔B" only rules out that specific pair, A can still be suggested
 * against some other transaction C. */
export async function listConfirmedTransactionIds(db: DbClient): Promise<Set<number>> {
  const rows = await db.select<{ from_transaction_id: number; to_transaction_id: number }[]>(
    "SELECT from_transaction_id, to_transaction_id FROM transfer_links WHERE status = 'confirmed'",
  );
  const ids = new Set<number>();
  for (const row of rows) {
    ids.add(row.from_transaction_id);
    ids.add(row.to_transaction_id);
  }
  return ids;
}

/** Specific pairs the user already said "no" to — filtered out of future
 * candidate lists by exact pair, not by transaction id (see above). */
export async function listRejectedPairs(db: DbClient): Promise<Set<string>> {
  const rows = await db.select<{ from_transaction_id: number; to_transaction_id: number }[]>(
    "SELECT from_transaction_id, to_transaction_id FROM transfer_links WHERE status = 'rejected'",
  );
  return new Set(rows.map((r) => pairKey(r.from_transaction_id, r.to_transaction_id)));
}
