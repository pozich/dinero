import type { ParsedStatement } from "./types";

export type GoldenResult = {
  ok: boolean;
  expectedDelta: number;
  summaryDelta: number;
  transactionsDelta: number;
};

export function checkGolden(statement: ParsedStatement): GoldenResult {
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
