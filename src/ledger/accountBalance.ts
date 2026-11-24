export type AccountTransactionLite = { accountId: number; occurredAt: string; amountTiyin: number };
export type StatementLite = { accountId: number; periodEnd: string; closingBalanceTiyin: number | null };

export type AccountBalanceResult = {
  accountId: number;
  currentBalanceTiyin: number;
  /** null when there's no statement with a recorded closing balance yet
   * (nothing imported, or it predates the closing_balance_tiyin column). */
  discrepancyTiyin: number | null;
  asOfStatementPeriodEnd: string | null;
};

/**
 * Account balance is the sum of *every* transaction on it — transfers,
 * investments, "не учитывать" included, since this is the real money in
 * the account, not the ledger's income/expense view (SPEC-2.md 6.1).
 *
 * The discrepancy check compares the balance *as of the last statement's
 * period end* against that statement's own closing balance — not against
 * "today" — so a manual entry dated after the last import doesn't get
 * wrongly flagged as a mismatch against a statement that never claimed to
 * cover that date.
 */
export function computeAccountBalances(
  transactions: readonly AccountTransactionLite[],
  statements: readonly StatementLite[],
): AccountBalanceResult[] {
  const accountIds = new Set<number>([
    ...transactions.map((t) => t.accountId),
    ...statements.map((s) => s.accountId),
  ]);

  const results: AccountBalanceResult[] = [];
  for (const accountId of accountIds) {
    const accountTx = transactions.filter((t) => t.accountId === accountId);
    const currentBalanceTiyin = accountTx.reduce((sum, t) => sum + t.amountTiyin, 0);

    const withClosing = statements.filter(
      (s) => s.accountId === accountId && s.closingBalanceTiyin !== null,
    );
    const latest = [...withClosing].sort((a, b) => b.periodEnd.localeCompare(a.periodEnd))[0];

    let discrepancyTiyin: number | null = null;
    let asOfStatementPeriodEnd: string | null = null;
    if (latest) {
      const balanceAsOf = accountTx
        .filter((t) => t.occurredAt <= latest.periodEnd)
        .reduce((sum, t) => sum + t.amountTiyin, 0);
      discrepancyTiyin = balanceAsOf - latest.closingBalanceTiyin!;
      asOfStatementPeriodEnd = latest.periodEnd;
    }

    results.push({ accountId, currentBalanceTiyin, discrepancyTiyin, asOfStatementPeriodEnd });
  }
  return results;
}
