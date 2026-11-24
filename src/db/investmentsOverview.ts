import type { DbClient } from "./types";
import { listSecurities, type Security } from "./securities";
import { listTrades, setEstimatedQuantity, type TradeRow } from "./trades";
import { listDividends, type DividendRow } from "./dividends";
import { listSnapshots, type SnapshotRow } from "./securitySnapshots";
import { getPriceOnOrBefore } from "./securityPrices";
import { estimateQuantity } from "../investments/estimateQuantity";
import { computeFifo, type FifoTrade } from "../investments/fifo";
import { computePosition, fillPortfolioShares, type Position } from "../investments/computePositions";
import { checkGolden, type GoldenCheckRow } from "../investments/goldenCheck";

export type InvestmentsOverview = {
  securities: Security[];
  positions: Position[];
  trades: TradeRow[];
  dividends: DividendRow[];
  snapshots: SnapshotRow[];
  goldenCheck: GoldenCheckRow[];
};

/**
 * The one place that assembles everything the Инвестиции screen needs.
 * Also does the one piece of "catch-up" work a pure function can't: a
 * trade imported before any price existed has `estimatedQuantity: null`
 * (SPEC-2.md 9.1) — every time this runs, it tries again against
 * whatever's cached now and persists the result, so quantities fill in
 * on their own the next time prices get downloaded, without a separate
 * "recompute" step the user has to remember to run.
 */
export async function queryInvestmentsOverview(db: DbClient, now: Date = new Date()): Promise<InvestmentsOverview> {
  const securities = await listSecurities(db);
  const trades = await listTrades(db);
  const dividends = await listDividends(db);
  const snapshots = await listSnapshots(db);

  for (const trade of trades) {
    if (trade.estimatedQuantity !== null) continue;
    const price = await getPriceOnOrBefore(db, trade.isin, trade.occurredAt);
    if (price === null) continue;
    const quantity = estimateQuantity(trade.amountTiyin, price);
    if (quantity === null) continue;
    await setEstimatedQuantity(db, trade.id, quantity);
    trade.estimatedQuantity = quantity;
  }

  const nowIso = now.toISOString();
  const positions: Position[] = [];
  for (const security of securities) {
    const securityTrades = trades.filter((t) => t.isin === security.isin);
    if (securityTrades.length === 0) continue;

    const fifoTrades: FifoTrade[] = securityTrades
      .filter((t): t is TradeRow & { estimatedQuantity: number } => t.estimatedQuantity !== null)
      .map((t) => ({
        id: t.id,
        side: t.side,
        date: t.occurredAt,
        quantity: t.estimatedQuantity,
        amountTiyin: t.amountTiyin,
        commissionTiyin: t.commissionTiyin,
      }));
    const fifo = computeFifo(fifoTrades);

    const currentPrice = await getPriceOnOrBefore(db, security.isin, nowIso);
    const commissionPaidTiyin = securityTrades.reduce((sum, t) => sum + t.commissionTiyin, 0);
    const dividendsReceivedTiyin = dividends
      .filter((d) => d.isin === security.isin)
      .reduce((sum, d) => sum + d.amountTiyin, 0);

    positions.push(computePosition(fifo, currentPrice, commissionPaidTiyin, dividendsReceivedTiyin, security));
  }

  const goldenTrades = trades
    .filter((t): t is TradeRow & { estimatedQuantity: number } => t.estimatedQuantity !== null)
    .map((t) => ({ isin: t.isin, side: t.side, date: t.occurredAt.slice(0, 10), quantity: t.estimatedQuantity }));
  const goldenSnapshots = snapshots.map((s) => ({ isin: s.isin, date: s.date.slice(0, 10), quantity: s.quantity }));

  return {
    securities,
    positions: fillPortfolioShares(positions),
    trades,
    dividends,
    snapshots,
    goldenCheck: checkGolden(goldenTrades, goldenSnapshots),
  };
}
