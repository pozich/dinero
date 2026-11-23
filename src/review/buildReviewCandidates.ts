import type { DbClient } from "../db/types";
import { listConfirmedTransactionIds, listRejectedPairs, pairKey } from "../db/transferLinks";
import { findTransferCandidates } from "../transfers/matchTransfers";
import { findRefundCandidates } from "../transfers/refundMatch";

export type ReviewTransaction = {
  id: number;
  account_kind: string;
  account_name: string;
  occurred_at: string;
  amount_tiyin: number;
  description: string;
};

export type ReviewCandidate =
  | {
      kind: "transfer";
      from: ReviewTransaction;
      to: ReviewTransaction;
      dateDiffDays: number;
      confidence: number;
    }
  | {
      kind: "refund";
      from: ReviewTransaction;
      to: ReviewTransaction;
      dateDiffDays: number;
      confidence: number;
    };

/** All transactions not already on a *confirmed* link — the pool both
 * matchers search over (SPEC-2.md 3.1/3.2). */
export async function listCandidatePool(db: DbClient): Promise<ReviewTransaction[]> {
  const confirmed = await listConfirmedTransactionIds(db);
  const rows = await db.select<ReviewTransaction[]>(
    `SELECT t.id, a.kind AS account_kind, a.name AS account_name,
            t.occurred_at, t.amount_tiyin, t.description
     FROM transactions t
     JOIN accounts a ON a.id = t.account_id`,
  );
  return rows.filter((r) => !confirmed.has(r.id));
}

/**
 * Combines transfer and refund candidates into one list for the "Проверить"
 * panel, already filtered against pairs the user previously rejected.
 * Re-run this after every confirm/reject — it always reflects current DB
 * state rather than tracking anything itself.
 */
export async function buildReviewCandidates(db: DbClient): Promise<ReviewCandidate[]> {
  const pool = await listCandidatePool(db);
  const rejected = await listRejectedPairs(db);

  const matchable = pool.map((t) => ({
    accountKind: t.account_kind,
    occurredAt: t.occurred_at,
    amountTiyin: t.amount_tiyin,
    description: t.description,
  }));

  const transfers: ReviewCandidate[] = findTransferCandidates(matchable)
    .map((c) => ({
      kind: "transfer" as const,
      from: pool[c.fromIndex],
      to: pool[c.toIndex],
      dateDiffDays: c.dateDiffDays,
      confidence: c.confidence,
    }))
    .filter((c) => !rejected.has(pairKey(c.from.id, c.to.id)));

  const refunds: ReviewCandidate[] = findRefundCandidates(matchable)
    .map((c) => ({
      kind: "refund" as const,
      from: pool[c.purchaseIndex],
      to: pool[c.refundIndex],
      dateDiffDays: c.dateDiffDays,
      confidence: c.confidence,
    }))
    .filter((c) => !rejected.has(pairKey(c.from.id, c.to.id)));

  return [...transfers, ...refunds].sort((a, b) => b.confidence - a.confidence);
}
