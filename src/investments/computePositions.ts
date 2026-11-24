import type { FifoResult } from "./fifo";

export type Position = {
  isin: string;
  ticker: string;
  name: string;
  industry: string | null;
  quantity: number;
  averageCostTiyin: number;
  investedTiyin: number;
  currentPriceTiyin: number | null;
  currentValueTiyin: number | null;
  pnlTiyin: number | null;
  pnlPercent: number | null;
  commissionPaidTiyin: number;
  dividendsReceivedTiyin: number;
  portfolioSharePercent: number | null;
};

/** SPEC-2.md 9.3's "Позиции" row: тикер, количество, средняя цена покупки,
 * вложено, текущая стоимость, прибыль/убыток ₸ и %, комиссии, дивиденды.
 * `currentPriceTiyin` is null when no price has been downloaded yet for
 * this security — everything price-dependent then comes back null too,
 * rather than silently showing a stale/zero value. */
export function computePosition(
  fifo: FifoResult,
  currentPriceTiyin: number | null,
  commissionPaidTiyin: number,
  dividendsReceivedTiyin: number,
  security: { isin: string; ticker: string; name: string; industry: string | null },
): Position {
  const investedTiyin = fifo.totalInvestedTiyin;
  const currentValueTiyin = currentPriceTiyin !== null ? fifo.remainingQuantity * currentPriceTiyin : null;
  const pnlTiyin = currentValueTiyin !== null ? currentValueTiyin - investedTiyin : null;
  const pnlPercent = pnlTiyin !== null && investedTiyin > 0 ? (pnlTiyin / investedTiyin) * 100 : null;

  return {
    isin: security.isin,
    ticker: security.ticker,
    name: security.name,
    industry: security.industry,
    quantity: fifo.remainingQuantity,
    averageCostTiyin: fifo.averageCostTiyin,
    investedTiyin,
    currentPriceTiyin,
    currentValueTiyin,
    pnlTiyin,
    pnlPercent,
    commissionPaidTiyin,
    dividendsReceivedTiyin,
    portfolioSharePercent: null,
  };
}

/** "Доля в портфеле" (9.3) needs every position's value at once — filled
 * in as a second pass rather than threaded through computePosition. */
export function fillPortfolioShares(positions: readonly Position[]): Position[] {
  const totalValueTiyin = positions.reduce((sum, p) => sum + (p.currentValueTiyin ?? 0), 0);
  return positions.map((p) => ({
    ...p,
    portfolioSharePercent:
      totalValueTiyin > 0 && p.currentValueTiyin !== null ? (p.currentValueTiyin / totalValueTiyin) * 100 : null,
  }));
}
