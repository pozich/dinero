/**
 * SPEC-2.md 9.3's "тайминг: цена покупки vs средняя цена за тот месяц —
 * «переплатил/сэкономил N%»". Positive means the purchase price was above
 * that month's average (overpaid); negative means below (saved).
 */
export function computeTimingPercent(purchasePriceTiyin: number, monthAveragePriceTiyin: number): number | null {
  if (monthAveragePriceTiyin <= 0) return null;
  return ((purchasePriceTiyin - monthAveragePriceTiyin) / monthAveragePriceTiyin) * 100;
}
