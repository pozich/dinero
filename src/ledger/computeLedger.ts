import type { Category } from "../db/categories";
import { isInvestmentCategory } from "./isInvestmentCategory";

export type LedgerTransaction = {
  id: number;
  accountKind: string;
  accountIsTransit: boolean;
  amountTiyin: number;
  isIgnored: boolean;
  isInvestmentIncome: boolean;
};

export type LedgerSplit = {
  id: number;
  transactionId: number;
  categoryId: number | null;
  amountTiyin: number;
};

/** Only *confirmed* links matter here — pending/rejected candidates are a
 * review-screen concern, not a ledger one. `fromTransactionId` is always
 * the negative (outgoing/purchase) side, `toTransactionId` the positive
 * (incoming/refund) side — matches how transfer_links is already written
 * everywhere else in the app. */
export type LedgerLink = {
  kind: "transfer" | "refund";
  fromTransactionId: number;
  toTransactionId: number;
};

export type ExclusionReason = "transit" | "ignored" | "transfer" | "refund" | "investment" | "debt";

export type LedgerEntry = {
  splitId: number;
  transactionId: number;
  categoryId: number | null;
  /** The countable amount — 0 when excluded, reduced from the split's raw
   * amount when it's the purchase side of a partial refund. */
  amountTiyin: number;
  isInvestmentIncome: boolean;
  excluded: boolean;
  reason: ExclusionReason | null;
};

/**
 * The one place that decides what counts as income/expense (SPEC-2.md
 * раздел 1) — every chart, metric and balance-vs-ledger comparison in
 * Ф5+ must go through this, never a bare SQL sum. Pure function: no db
 * access, no knowledge of how its inputs were fetched.
 *
 * A confirmed *transfer* excludes both sides entirely. A confirmed
 * *refund* excludes the refund side entirely, and reduces the purchase
 * side to just the uncovered difference — split proportionally across
 * that transaction's splits if it was itself divided into several
 * categories (SPEC-2.md раздел 1's own done-criterion calls this out
 * explicitly as a combination to cover). A category inside "Инвестиции"
 * is excluded unless the transaction is flagged `isInvestmentIncome`
 * (dividends) — counted, and reported back with that flag set so
 * analytics can show/hide it on its own toggle.
 *
 * Debts (SPEC-2.md 8) exclude their own transaction entirely — "Долги не
 * являются доходом/расходом" — whether that's the original lending/
 * borrowing transaction or one of its repayments; `debtTransactionIds` is
 * the union of both, computed by the caller (`src/db/ledgerQuery.ts`) from
 * the `debts`/`debt_repayments` tables. A debt tracked purely in cash (no
 * `transaction_id`) never reaches this set at all, since there's no real
 * transaction to exclude. Savings-goal links aren't modelled yet (no such
 * table exists until Ф9) — nothing here excludes them, by design, not by
 * oversight.
 */
export function computeLedger(
  transactions: readonly LedgerTransaction[],
  splits: readonly LedgerSplit[],
  links: readonly LedgerLink[],
  categories: readonly Category[],
  debtTransactionIds: ReadonlySet<number> = new Set(),
): LedgerEntry[] {
  const txById = new Map(transactions.map((t) => [t.id, t]));

  const transferIds = new Set<number>();
  const refundExcludedIds = new Set<number>();
  // purchase transaction id -> net factor (0..1) to scale its splits by
  const refundFactor = new Map<number, number>();

  for (const link of links) {
    if (link.kind === "transfer") {
      transferIds.add(link.fromTransactionId);
      transferIds.add(link.toTransactionId);
      continue;
    }
    const purchase = txById.get(link.fromTransactionId);
    const refund = txById.get(link.toTransactionId);
    if (!purchase || !refund) continue;

    refundExcludedIds.add(refund.id);
    const netAmount = purchase.amountTiyin + refund.amountTiyin; // e.g. -1000 + 300 = -700
    const factor = purchase.amountTiyin !== 0 ? netAmount / purchase.amountTiyin : 0;
    refundFactor.set(purchase.id, factor);
  }

  return splits.map((split) => {
    const tx = txById.get(split.transactionId);
    const base = {
      splitId: split.id,
      transactionId: split.transactionId,
      categoryId: split.categoryId,
      isInvestmentIncome: false,
    };

    if (!tx) {
      // Shouldn't happen with real data (every split has a transaction),
      // but a split pointing nowhere certainly isn't countable.
      return { ...base, amountTiyin: 0, excluded: true, reason: null };
    }

    if (tx.accountIsTransit) {
      return { ...base, amountTiyin: 0, excluded: true, reason: "transit" };
    }
    if (tx.isIgnored) {
      return { ...base, amountTiyin: 0, excluded: true, reason: "ignored" };
    }
    if (transferIds.has(tx.id)) {
      return { ...base, amountTiyin: 0, excluded: true, reason: "transfer" };
    }
    if (refundExcludedIds.has(tx.id)) {
      return { ...base, amountTiyin: 0, excluded: true, reason: "refund" };
    }
    if (debtTransactionIds.has(tx.id)) {
      return { ...base, amountTiyin: 0, excluded: true, reason: "debt" };
    }

    const isInvestment = isInvestmentCategory(split.categoryId, categories);
    if (isInvestment && !tx.isInvestmentIncome) {
      return { ...base, amountTiyin: 0, excluded: true, reason: "investment" };
    }

    const factor = refundFactor.get(tx.id);
    if (factor !== undefined) {
      const amountTiyin = Math.round(split.amountTiyin * factor);
      if (amountTiyin === 0) {
        return { ...base, amountTiyin: 0, excluded: true, reason: "refund" };
      }
      return { ...base, amountTiyin, excluded: false, reason: null, isInvestmentIncome: isInvestment };
    }

    return {
      ...base,
      amountTiyin: split.amountTiyin,
      excluded: false,
      reason: null,
      isInvestmentIncome: isInvestment,
    };
  });
}
