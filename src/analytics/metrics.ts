import type { LedgerRow } from "../db/ledgerQuery";
import type { Category } from "../db/categories";
import { groupLedgerRows } from "./grouping";
import { periodDelta } from "./period";

export type Metrics = {
  incomeTiyin: number;
  expenseTiyin: number; // negative — a sum of expense rows, kept signed
  netTiyin: number;
  savingsRatePercent: number | null;
  avgPerDayTiyin: number;
  avgPerMonthTiyin: number;
  topSpends: { transactionId: number; description: string; amountTiyin: number; occurredAt: string }[];
  topCounterparties: { label: string; amountTiyin: number }[];
};

/**
 * SPEC-2.md 6.5. `includeDividends` is the "дивиденды в доходах" toggle —
 * dividends are never excluded by the ledger itself (they're real income),
 * this just decides whether they're folded into the headline numbers here.
 */
export function computeMetrics(
  rows: readonly LedgerRow[],
  options: { periodDays: number; includeDividends: boolean },
): Metrics {
  const relevant = rows.filter((r) => !r.excluded && (options.includeDividends || !r.isInvestmentIncome));

  let incomeTiyin = 0;
  let expenseTiyin = 0;
  for (const r of relevant) {
    if (r.amountTiyin >= 0) incomeTiyin += r.amountTiyin;
    else expenseTiyin += r.amountTiyin;
  }
  const netTiyin = incomeTiyin + expenseTiyin;
  const savingsRatePercent = incomeTiyin !== 0 ? (netTiyin / incomeTiyin) * 100 : null;
  const avgPerDayTiyin = options.periodDays > 0 ? Math.round(expenseTiyin / options.periodDays) : 0;
  const avgPerMonthTiyin = Math.round(avgPerDayTiyin * 30);

  const topSpends = [...relevant]
    .filter((r) => r.amountTiyin < 0)
    .sort((a, b) => a.amountTiyin - b.amountTiyin)
    .slice(0, 10)
    .map((r) => ({
      transactionId: r.transactionId,
      description: r.description,
      amountTiyin: r.amountTiyin,
      occurredAt: r.occurredAt,
    }));

  const topCounterparties = groupLedgerRows(relevant, "counterparty", [])
    .filter((b) => b.amountTiyin < 0)
    .sort((a, b) => a.amountTiyin - b.amountTiyin)
    .slice(0, 10)
    .map((b) => ({ label: b.label, amountTiyin: b.amountTiyin }));

  return {
    incomeTiyin,
    expenseTiyin,
    netTiyin,
    savingsRatePercent,
    avgPerDayTiyin,
    avgPerMonthTiyin,
    topSpends,
    topCounterparties,
  };
}

export type CategoryChange = {
  categoryKey: string;
  label: string;
  currentTiyin: number;
  previousTiyin: number;
  deltaTiyin: number;
  deltaPercent: number | null;
};

/** "Рост/падение категорий к прошлому периоду" — biggest absolute change
 * first, a category present in only one of the two periods just has a
 * zero on the other side rather than being dropped. */
export function computeCategoryChanges(
  currentRows: readonly LedgerRow[],
  previousRows: readonly LedgerRow[],
  categories: readonly Category[],
): CategoryChange[] {
  const current = groupLedgerRows(currentRows, "category", categories);
  const previous = groupLedgerRows(previousRows, "category", categories);
  const currentByKey = new Map(current.map((b) => [b.key, b]));
  const previousByKey = new Map(previous.map((b) => [b.key, b]));
  const allKeys = new Set([...currentByKey.keys(), ...previousByKey.keys()]);

  const results: CategoryChange[] = [];
  for (const key of allKeys) {
    const currentBucket = currentByKey.get(key);
    const previousBucket = previousByKey.get(key);
    const currentTiyin = currentBucket?.amountTiyin ?? 0;
    const previousTiyin = previousBucket?.amountTiyin ?? 0;
    const { deltaTiyin, deltaPercent } = periodDelta(currentTiyin, previousTiyin);
    results.push({
      categoryKey: key,
      label: currentBucket?.label ?? previousBucket?.label ?? key,
      currentTiyin,
      previousTiyin,
      deltaTiyin,
      deltaPercent,
    });
  }

  return results.sort((a, b) => Math.abs(b.deltaTiyin) - Math.abs(a.deltaTiyin));
}
