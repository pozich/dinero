import type { LedgerRow } from "../db/ledgerQuery";

export type AnalyticsFilters = {
  accountIds?: number[];
  categoryIds?: number[];
  sign?: "income" | "expense";
  minAmountTiyin?: number;
  maxAmountTiyin?: number;
  search?: string;
};

/** SPEC-2.md 6.3's filter row — счета/категории/приход-расход/сумма/поиск.
 * Pure over whatever rows the caller already pulled for the period. */
export function applyAnalyticsFilters(
  rows: readonly LedgerRow[],
  filters: AnalyticsFilters,
): LedgerRow[] {
  return rows.filter((r) => {
    if (filters.accountIds && filters.accountIds.length > 0 && !filters.accountIds.includes(r.accountId)) {
      return false;
    }
    if (
      filters.categoryIds &&
      filters.categoryIds.length > 0 &&
      (r.categoryId === null || !filters.categoryIds.includes(r.categoryId))
    ) {
      return false;
    }
    if (filters.sign === "income" && r.amountTiyin < 0) return false;
    if (filters.sign === "expense" && r.amountTiyin >= 0) return false;
    if (filters.minAmountTiyin !== undefined && Math.abs(r.amountTiyin) < filters.minAmountTiyin) return false;
    if (filters.maxAmountTiyin !== undefined && Math.abs(r.amountTiyin) > filters.maxAmountTiyin) return false;
    if (filters.search) {
      const q = filters.search.toLowerCase();
      if (!r.description.toLowerCase().includes(q) && !(r.note ?? "").toLowerCase().includes(q)) return false;
    }
    return true;
  });
}
