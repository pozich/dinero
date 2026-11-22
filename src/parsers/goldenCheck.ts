import type { ParsedTransaction, TransactionSummary } from "./types";

export type GoldenResult = {
  ok: boolean;
  expectedDelta: number;
  summaryDelta: number;
  transactionsDelta: number;
};

export type GoldenInput = {
  summary: TransactionSummary;
  transactions: ParsedTransaction[];
};

/** opening + Σ(categories) == closing, and that must equal the sum of every
 * parsed transaction (plus any fees the caller folds in) — see SPEC.md 4.2. */
export function checkGolden(statement: GoldenInput): GoldenResult {
  const { summary, transactions } = statement;
  const summaryDelta = Object.values(summary.categories).reduce((a, b) => a + b, 0);
  const expectedDelta = summary.closing - summary.opening;
  const transactionsDelta = transactions.reduce((a, t) => a + t.amountTiyin, 0);

  return {
    ok: summaryDelta === expectedDelta && transactionsDelta === expectedDelta,
    expectedDelta,
    summaryDelta,
    transactionsDelta,
  };
}
