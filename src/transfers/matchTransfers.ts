export type MatchableTransaction = {
  accountKind: string;
  occurredAt: string;
  amountTiyin: number;
  description: string;
};

export type TransferCandidate = {
  fromIndex: number;
  toIndex: number;
  dateDiffDays: number;
  confidence: number;
};

// A hint on the OUTGOING or INCOMING side's description that names the
// counterpart's bank — see SPEC.md 4.3 ("Kaspi Bank", "Halyk Bank*4787", ...).
const BANK_HINTS: Record<string, RegExp> = {
  kaspi_gold: /Kaspi Bank|At Kaspi ATM/i,
  kaspi_deposit: /Kaspi Deposit/i,
  halyk_salary: /Halyk Bank/i,
  halyk_standard: /Halyk Bank/i,
  eurasian: /Eurasian Bank/i,
  bcc: /CenterCredit/i,
};

const TRANSFER_WORD_RE = /Перевод|Transfer/i;

function dayDiff(a: string, b: string): number {
  const ms = Math.abs(new Date(a).getTime() - new Date(b).getTime());
  return Math.round(ms / 86_400_000);
}

/**
 * Candidate own-account transfers: opposite sign, equal amount, different
 * accounts, date within N days either way (SPEC.md 6.3, N=3). Returns
 * ranked suggestions for the user to confirm — it never pairs or excludes
 * anything on its own.
 */
export function findTransferCandidates(
  transactions: readonly MatchableTransaction[],
  { maxDateDiffDays = 3 }: { maxDateDiffDays?: number } = {},
): TransferCandidate[] {
  const buckets = new Map<number, number[]>();
  transactions.forEach((t, i) => {
    const key = Math.abs(t.amountTiyin);
    const arr = buckets.get(key) ?? [];
    arr.push(i);
    buckets.set(key, arr);
  });

  const candidates: TransferCandidate[] = [];

  for (const indices of buckets.values()) {
    for (const i of indices) {
      const from = transactions[i];
      if (from.amountTiyin >= 0) continue;

      for (const j of indices) {
        if (i === j) continue;
        const to = transactions[j];
        if (to.amountTiyin <= 0) continue;
        if (from.accountKind === to.accountKind) continue;

        const dateDiffDays = dayDiff(from.occurredAt, to.occurredAt);
        if (dateDiffDays > maxDateDiffDays) continue;

        let confidence = 0.6 - dateDiffDays * 0.1;
        if (BANK_HINTS[to.accountKind]?.test(from.description)) confidence += 0.3;
        if (BANK_HINTS[from.accountKind]?.test(to.description)) confidence += 0.3;
        if (TRANSFER_WORD_RE.test(from.description) || TRANSFER_WORD_RE.test(to.description)) {
          confidence += 0.05;
        }

        candidates.push({
          fromIndex: i,
          toIndex: j,
          dateDiffDays,
          confidence: Math.min(confidence, 1),
        });
      }
    }
  }

  return candidates.sort((a, b) => b.confidence - a.confidence);
}
