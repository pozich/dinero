import type { DbClient } from "./types";
import { computeAccountBalances, type AccountBalanceResult } from "../ledger/accountBalance";
import { findCoverageGaps, monthlyCoverage, type DateRange } from "../ledger/coverage";

export type AccountOverview = AccountBalanceResult & {
  accountName: string;
  accountKind: string;
  gaps: DateRange[];
  monthly: { month: string; hasGap: boolean }[];
};

/** SPEC-2.md 6.1: balance + discrepancy + coverage timeline, per account.
 * An account with no statements at all (the virtual "Наличные"/"Kaspi
 * Deposit" accounts, always) gets no gaps reported — there's nothing to
 * measure coverage against, so "one giant gap since account creation"
 * would just be noise, not a real warning. */
export async function queryAccountOverview(db: DbClient): Promise<AccountOverview[]> {
  const accounts = await db.select<{ id: number; name: string; kind: string }[]>(
    "SELECT id, name, kind FROM accounts",
  );
  const transactions = await db.select<
    { account_id: number; occurred_at: string; amount_tiyin: number }[]
  >("SELECT account_id, occurred_at, amount_tiyin FROM transactions");
  const statements = await db.select<
    {
      account_id: number;
      period_start: string;
      period_end: string;
      closing_balance_tiyin: number | null;
    }[]
  >("SELECT account_id, period_start, period_end, closing_balance_tiyin FROM statements");

  const balances = computeAccountBalances(
    transactions.map((t) => ({
      accountId: t.account_id,
      occurredAt: t.occurred_at,
      amountTiyin: t.amount_tiyin,
    })),
    statements.map((s) => ({
      accountId: s.account_id,
      periodEnd: s.period_end,
      closingBalanceTiyin: s.closing_balance_tiyin,
    })),
  );
  const balanceById = new Map(balances.map((b) => [b.accountId, b]));
  const now = new Date().toISOString();

  return accounts.map((a) => {
    const accountStatements = statements.filter((s) => s.account_id === a.id);
    const balance =
      balanceById.get(a.id) ??
      ({ accountId: a.id, currentBalanceTiyin: 0, discrepancyTiyin: null, asOfStatementPeriodEnd: null } as AccountBalanceResult);

    if (accountStatements.length === 0) {
      return { ...balance, accountName: a.name, accountKind: a.kind, gaps: [], monthly: [] };
    }

    const rangeStart = accountStatements.reduce(
      (min, s) => (s.period_start < min ? s.period_start : min),
      accountStatements[0].period_start,
    );
    const gaps = findCoverageGaps(
      accountStatements.map((s) => ({ periodStart: s.period_start, periodEnd: s.period_end })),
      rangeStart,
      now,
    );
    const monthly = monthlyCoverage(gaps, rangeStart, now);

    return { ...balance, accountName: a.name, accountKind: a.kind, gaps, monthly };
  });
}
