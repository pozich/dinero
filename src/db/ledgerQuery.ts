import type { DbClient } from "./types";
import { listCategories } from "./categories";
import {
  computeLedger,
  type ExclusionReason,
  type LedgerLink,
  type LedgerSplit,
  type LedgerTransaction,
} from "../ledger/computeLedger";

export type LedgerRow = {
  splitId: number;
  transactionId: number;
  categoryId: number | null;
  amountTiyin: number;
  isInvestmentIncome: boolean;
  excluded: boolean;
  reason: ExclusionReason | null;
  occurredAt: string;
  accountId: number;
  accountName: string;
  accountKind: string;
  description: string;
  note: string | null;
};

export type LedgerFilters = {
  periodStart?: string;
  periodEnd?: string;
  accountId?: number;
};

/**
 * Runs computeLedger over *every* transaction (never just the visible
 * period) and only filters the result afterward — a refund pair that
 * straddles two periods (bought in August, refunded in September) still
 * needs both sides to compute the right residual even when the caller
 * only wants August's numbers. Re-computing over the whole dataset is
 * cheap in JS for the volumes this app deals with; it's correctness that
 * mattered here, not micro-optimizing a loop.
 */
export async function queryLedger(db: DbClient, filters: LedgerFilters = {}): Promise<LedgerRow[]> {
  const rawTx = await db.select<
    {
      id: number;
      account_id: number;
      account_name: string;
      account_kind: string;
      account_is_transit: number;
      occurred_at: string;
      amount_tiyin: number;
      description: string;
      note: string | null;
      is_ignored: number;
      is_investment_income: number;
    }[]
  >(
    `SELECT t.id, t.account_id, a.name AS account_name, a.kind AS account_kind,
            a.is_transit AS account_is_transit, t.occurred_at, t.amount_tiyin,
            t.description, t.note, t.is_ignored, t.is_investment_income
     FROM transactions t
     JOIN accounts a ON a.id = t.account_id`,
  );

  const rawSplits = await db.select<
    { id: number; transaction_id: number; category_id: number | null; amount_tiyin: number }[]
  >(`SELECT id, transaction_id, category_id, amount_tiyin FROM splits`);

  // An uncategorized transaction has no splits at all — without a stand-in,
  // it would simply vanish from every total instead of counting as "без
  // категории" (and SPEC-2.md 6.2's accuracy warning exists precisely
  // because such operations still need to count, just with a flag that
  // the breakdown by category is incomplete).
  const transactionIdsWithSplits = new Set(rawSplits.map((s) => s.transaction_id));
  for (const t of rawTx) {
    if (!transactionIdsWithSplits.has(t.id)) {
      rawSplits.push({
        id: -t.id, // never collides with a real (positive, autoincrement) split id
        transaction_id: t.id,
        category_id: null,
        amount_tiyin: t.amount_tiyin,
      });
    }
  }

  const rawLinks = await db.select<
    { kind: "transfer" | "refund"; from_transaction_id: number; to_transaction_id: number }[]
  >(`SELECT kind, from_transaction_id, to_transaction_id FROM transfer_links WHERE status = 'confirmed'`);

  const categories = await listCategories(db);

  const txById = new Map(rawTx.map((t) => [t.id, t]));

  const transactions: LedgerTransaction[] = rawTx.map((t) => ({
    id: t.id,
    accountKind: t.account_kind,
    accountIsTransit: !!t.account_is_transit,
    amountTiyin: t.amount_tiyin,
    isIgnored: !!t.is_ignored,
    isInvestmentIncome: !!t.is_investment_income,
  }));

  const splits: LedgerSplit[] = rawSplits.map((s) => ({
    id: s.id,
    transactionId: s.transaction_id,
    categoryId: s.category_id,
    amountTiyin: s.amount_tiyin,
  }));

  const links: LedgerLink[] = rawLinks.map((l) => ({
    kind: l.kind,
    fromTransactionId: l.from_transaction_id,
    toTransactionId: l.to_transaction_id,
  }));

  const entries = computeLedger(transactions, splits, links, categories);

  const rows: LedgerRow[] = entries
    .map((e) => {
      const t = txById.get(e.transactionId);
      if (!t) return null;
      return {
        ...e,
        occurredAt: t.occurred_at,
        accountId: t.account_id,
        accountName: t.account_name,
        accountKind: t.account_kind,
        description: t.description,
        note: t.note,
      };
    })
    .filter((r): r is LedgerRow => r !== null);

  return rows.filter((r) => {
    if (filters.periodStart && r.occurredAt < filters.periodStart) return false;
    if (filters.periodEnd && r.occurredAt > filters.periodEnd) return false;
    if (filters.accountId !== undefined && r.accountId !== filters.accountId) return false;
    return true;
  });
}
