export type FifoTrade = {
  id: number;
  side: "buy" | "sell";
  date: string;
  quantity: number;
  amountTiyin: number; // the trade's own cash value, always positive
  commissionTiyin: number;
};

export type FifoLot = { quantity: number; unitCostTiyin: number; date: string };

export type FifoSellResult = {
  tradeId: number;
  quantitySold: number;
  proceedsTiyin: number;
  costBasisTiyin: number;
  realizedPnlTiyin: number;
};

export type FifoResult = {
  openLots: FifoLot[];
  sells: FifoSellResult[];
  remainingQuantity: number;
  averageCostTiyin: number;
  totalInvestedTiyin: number;
};

/**
 * SPEC-2.md 9.3's "реализованный результат (FIFO) по проданным" — the
 * oldest open lot is sold first. Commission is folded into a buy's unit
 * cost and subtracted from a sell's proceeds, since "сколько реально
 * стоила/принесла эта сделка" is what средняя цена/прибыль are meant to
 * answer, not the pre-fee amount. A trade with `quantity <= 0` (no price
 * was available to estimate it yet) is skipped entirely rather than
 * corrupting the lot queue with a zero-share entry.
 */
export function computeFifo(trades: readonly FifoTrade[]): FifoResult {
  const sorted = [...trades].filter((t) => t.quantity > 0).sort((a, b) => a.date.localeCompare(b.date));
  const lots: FifoLot[] = [];
  const sells: FifoSellResult[] = [];

  for (const trade of sorted) {
    if (trade.side === "buy") {
      const unitCostTiyin = Math.round((trade.amountTiyin + trade.commissionTiyin) / trade.quantity);
      lots.push({ quantity: trade.quantity, unitCostTiyin, date: trade.date });
      continue;
    }

    let remaining = trade.quantity;
    let costBasisTiyin = 0;
    let quantitySold = 0;
    while (remaining > 0 && lots.length > 0) {
      const lot = lots[0];
      const taken = Math.min(lot.quantity, remaining);
      costBasisTiyin += taken * lot.unitCostTiyin;
      quantitySold += taken;
      lot.quantity -= taken;
      remaining -= taken;
      if (lot.quantity === 0) lots.shift();
    }
    const proceedsTiyin = trade.amountTiyin - trade.commissionTiyin;
    sells.push({
      tradeId: trade.id,
      quantitySold,
      proceedsTiyin,
      costBasisTiyin,
      realizedPnlTiyin: proceedsTiyin - costBasisTiyin,
    });
  }

  const remainingQuantity = lots.reduce((sum, l) => sum + l.quantity, 0);
  const totalInvestedTiyin = lots.reduce((sum, l) => sum + l.quantity * l.unitCostTiyin, 0);
  const averageCostTiyin = remainingQuantity > 0 ? Math.round(totalInvestedTiyin / remainingQuantity) : 0;

  return { openLots: lots, sells, remainingQuantity, averageCostTiyin, totalInvestedTiyin };
}
