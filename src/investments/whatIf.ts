export type CashFlow = { date: string; amountTiyin: number };

/**
 * SPEC-2.md 9.3's "а если бы... на депозит под заданный %" — each cash
 * flow compounds daily-equivalent from its own date to `asOfDate`, not a
 * single lump-sum rate applied to the total (money invested later had
 * less time to grow).
 */
export function simulateDeposit(cashFlows: readonly CashFlow[], annualRatePercent: number, asOfDate: string): number {
  const asOf = new Date(asOfDate).getTime();
  const total = cashFlows.reduce((sum, cf) => {
    const days = (asOf - new Date(cf.date).getTime()) / 86_400_000;
    if (days <= 0) return sum + cf.amountTiyin;
    const growth = Math.pow(1 + annualRatePercent / 100, days / 365);
    return sum + cf.amountTiyin * growth;
  }, 0);
  return Math.round(total);
}

/**
 * "...и в индекс KASE" — each cash flow grows by the ratio of the index's
 * price on `asOfDate` vs. on the flow's own date, via whatever price
 * lookup the caller provides (so this stays independent of PriceSource/db
 * access). Returns null only when the end-date price itself is missing —
 * a flow whose own start price is missing is just skipped, not fatal to
 * the whole simulation.
 */
export function simulateIndex(
  cashFlows: readonly CashFlow[],
  priceOnOrBefore: (date: string) => number | null,
  asOfDate: string,
): number | null {
  const endPrice = priceOnOrBefore(asOfDate);
  if (endPrice === null) return null;

  let total = 0;
  for (const cf of cashFlows) {
    const startPrice = priceOnOrBefore(cf.date);
    if (startPrice === null || startPrice <= 0) continue;
    total += cf.amountTiyin * (endPrice / startPrice);
  }
  return Math.round(total);
}
