export type MatchableTransaction = {
  id: number;
  accountKind: string;
  occurredAt: string;
  amountTiyin: number;
};

export type MergeCandidate = {
  manualId: number;
  importedId: number;
  dateDiffDays: number;
};

function dayDiff(a: string, b: string): number {
  return Math.abs(new Date(a).getTime() - new Date(b).getTime()) / 86_400_000;
}

/**
 * SPEC-2.md 4.1: if a later import brings in a statement row that looks
 * like something already entered by hand (same account, exact same
 * amount, date within a day), offer "это та же операция?" rather than
 * leaving both. Pure suggestion — never merges anything on its own.
 */
export function findMergeCandidates(
  manualTransactions: readonly MatchableTransaction[],
  importedTransactions: readonly MatchableTransaction[],
  { maxDateDiffDays = 1 }: { maxDateDiffDays?: number } = {},
): MergeCandidate[] {
  const candidates: MergeCandidate[] = [];

  for (const manual of manualTransactions) {
    for (const imported of importedTransactions) {
      if (manual.accountKind !== imported.accountKind) continue;
      if (manual.amountTiyin !== imported.amountTiyin) continue;

      const diff = dayDiff(manual.occurredAt, imported.occurredAt);
      if (diff > maxDateDiffDays) continue;

      candidates.push({ manualId: manual.id, importedId: imported.id, dateDiffDays: Math.round(diff) });
    }
  }

  return candidates.sort((a, b) => a.dateDiffDays - b.dateDiffDays);
}
