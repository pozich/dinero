/**
 * SPEC-2.md 9.1's central gap: a Halyk trade description gives the cash
 * amount, never a share count or price. The only way to get a quantity is
 * to divide the cash amount by the market price on that date — this is
 * necessarily an estimate (the real execution price can differ from the
 * day's close), which is exactly why the snapshot golden-check
 * (src/investments/goldenCheck.ts) exists: it validates that this
 * estimate's cumulative error against the real snapshot quantities stays
 * small, not that it's exact.
 */
export function estimateQuantity(amountTiyin: number, closeTiyin: number): number | null {
  if (closeTiyin <= 0 || amountTiyin <= 0) return null;
  return Math.round(amountTiyin / closeTiyin);
}
