import type { LedgerRow } from "../db/ledgerQuery";
import type { Period } from "./period";
import { applyAnalyticsFilters, type AnalyticsFilters } from "./filters";

/**
 * The one line every analytics consumer (the Аналитика tab, every
 * dashboard widget) needs: take the whole unfiltered ledger, narrow it to
 * one period, then apply the rest of the filter row. Pulled out on its own
 * so the two call sites can't drift apart from each other.
 */
export function selectPeriodRows(
  allRows: readonly LedgerRow[],
  period: Period,
  filters: AnalyticsFilters,
): LedgerRow[] {
  return applyAnalyticsFilters(
    allRows.filter((r) => r.occurredAt >= period.start && r.occurredAt < period.end),
    filters,
  );
}
