import { extractPersonName } from "./extractPersonName";

export type MatchableDebtTransaction = {
  id: number;
  occurredAt: string;
  amountTiyin: number;
  description: string;
};

export type DebtForMatching = {
  id: number;
  direction: "lent" | "borrowed";
  /** Every known alias for this debt's person — an exact match against
   * `extractPersonName`'s output, not a fuzzy one (SPEC-2.md 8: "по
   * имени, детерминированно"). */
  personAliases: readonly string[];
  /** What's still owed — a candidate repaying more than this is not a
   * candidate for this debt at all (mirrors findRefundCandidates'
   * "refund ≤ purchase" rule). */
  remainingTiyin: number;
  occurredAt: string;
};

export type DebtRepaymentCandidate = {
  debtId: number;
  transactionId: number;
  dateDiffDays: number;
  confidence: number;
};

function dayDiff(a: string, b: string): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000);
}

/**
 * Suggests which of a pool of transactions might be a repayment of which
 * open debt: opposite sign from the debt's own direction (I lent → a
 * repayment comes IN; I borrowed → a repayment goes OUT), same person by
 * name, on or after the debt started, amount not exceeding what's left.
 * Pure suggestion-only — never links or excludes anything on its own,
 * same as findTransferCandidates/findRefundCandidates.
 */
export function findRepaymentCandidates(
  debts: readonly DebtForMatching[],
  transactions: readonly MatchableDebtTransaction[],
): DebtRepaymentCandidate[] {
  const candidates: DebtRepaymentCandidate[] = [];

  for (const debt of debts) {
    if (debt.remainingTiyin <= 0) continue;
    const expectedSign = debt.direction === "lent" ? 1 : -1;

    for (const tx of transactions) {
      if (Math.sign(tx.amountTiyin) !== expectedSign) continue;
      if (tx.occurredAt < debt.occurredAt) continue;
      if (Math.abs(tx.amountTiyin) > debt.remainingTiyin) continue;

      const name = extractPersonName(tx.description);
      if (!name || !debt.personAliases.includes(name)) continue;

      const dateDiffDays = dayDiff(debt.occurredAt, tx.occurredAt);
      const isFullRepayment = Math.abs(tx.amountTiyin) === debt.remainingTiyin;
      const confidence = Math.min(Math.max((isFullRepayment ? 0.85 : 0.7) - dateDiffDays * 0.005, 0), 1);

      candidates.push({ debtId: debt.id, transactionId: tx.id, dateDiffDays, confidence });
    }
  }

  return candidates.sort((a, b) => b.confidence - a.confidence);
}
