import { normalizeDescription } from "./normalizeDescription";

export type MatchableRefundTransaction = {
  accountKind: string;
  occurredAt: string;
  amountTiyin: number;
  description: string;
};

export type RefundCandidate = {
  purchaseIndex: number;
  refundIndex: number;
  dateDiffDays: number;
  confidence: number;
};

function dayDiff(a: string, b: string): number {
  const ms = new Date(b).getTime() - new Date(a).getTime();
  return Math.round(ms / 86_400_000);
}

/**
 * Candidate same-account purchase↔refund pairs (SPEC-2.md 3.2): same
 * account, normalized descriptions equal, refund on or after the purchase
 * within N days, refund amount ≤ purchase amount (a partial refund still
 * counts — the leftover stays an expense, handled by the ledger module).
 * Pure suggestion-only, like findTransferCandidates — never pairs or
 * excludes anything on its own.
 */
export function findRefundCandidates(
  transactions: readonly MatchableRefundTransaction[],
  { maxDateDiffDays = 14 }: { maxDateDiffDays?: number } = {},
): RefundCandidate[] {
  const candidates: RefundCandidate[] = [];

  for (let i = 0; i < transactions.length; i++) {
    const purchase = transactions[i];
    if (purchase.amountTiyin >= 0) continue;
    const purchaseAmount = -purchase.amountTiyin;

    for (let j = 0; j < transactions.length; j++) {
      if (i === j) continue;
      const refund = transactions[j];
      if (refund.amountTiyin <= 0) continue;
      if (refund.accountKind !== purchase.accountKind) continue;
      if (refund.amountTiyin > purchaseAmount) continue;

      const dateDiffDays = dayDiff(purchase.occurredAt, refund.occurredAt);
      if (dateDiffDays < 0 || dateDiffDays > maxDateDiffDays) continue;

      if (normalizeDescription(purchase.description) !== normalizeDescription(refund.description)) {
        continue;
      }

      const isFullRefund = refund.amountTiyin === purchaseAmount;
      const confidence = Math.min(Math.max((isFullRefund ? 0.85 : 0.65) - dateDiffDays * 0.02, 0), 1);

      candidates.push({ purchaseIndex: i, refundIndex: j, dateDiffDays, confidence });
    }
  }

  return candidates.sort((a, b) => b.confidence - a.confidence);
}
