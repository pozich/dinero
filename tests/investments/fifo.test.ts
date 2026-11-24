import { describe, expect, it } from "vitest";
import { computeFifo, type FifoTrade } from "../../src/investments/fifo";

describe("computeFifo", () => {
  // Real KCEL trade dates/amounts from the halyk_invest_oct.pdf sample
  // (SPEC-2.md 9's own done-criterion: "FIFO-результат по KCEL совпадает
  // с ручным расчётом"). Quantities are hand-assigned here (as if already
  // estimated from a price), not fetched live, so the test stays
  // deterministic — this checks the FIFO algorithm itself, not KASE.
  const kcelTrades: FifoTrade[] = [
    { id: 1, side: "buy", date: "2025-07-30", quantity: 2, amountTiyin: 2067900, commissionTiyin: 0 },
    { id: 2, side: "buy", date: "2025-08-22", quantity: 1, amountTiyin: 1014000, commissionTiyin: 0 },
    { id: 3, side: "buy", date: "2026-05-26", quantity: 1, amountTiyin: 1289600, commissionTiyin: 0 },
    { id: 4, side: "sell", date: "2026-09-15", quantity: 3, amountTiyin: 4131400, commissionTiyin: 0 },
  ];

  it("matches a hand computation for KCEL: sells the two oldest lots first, leaves the newest open", () => {
    const result = computeFifo(kcelTrades);

    // Hand calc: sell of 3 consumes lot1 (2 @ 1,033,950) + lot2 (1 @
    // 1,014,000) = cost basis 3,081,900; proceeds 4,131,400 -> PnL 1,049,500.
    expect(result.sells).toEqual([
      { tradeId: 4, quantitySold: 3, proceedsTiyin: 4131400, costBasisTiyin: 3081900, realizedPnlTiyin: 1049500 },
    ]);

    // Lot3 (1 @ 1,289,600) is all that's left.
    expect(result.remainingQuantity).toBe(1);
    expect(result.totalInvestedTiyin).toBe(1289600);
    expect(result.averageCostTiyin).toBe(1289600);
  });

  it("folds commission into a buy's unit cost and out of a sell's proceeds", () => {
    const trades: FifoTrade[] = [
      { id: 1, side: "buy", date: "2026-01-01", quantity: 10, amountTiyin: 100000, commissionTiyin: 1000 },
      { id: 2, side: "sell", date: "2026-02-01", quantity: 10, amountTiyin: 120000, commissionTiyin: 500 },
    ];
    const result = computeFifo(trades);
    // unit cost = (100000+1000)/10 = 10100; cost basis = 10*10100 = 101000
    // proceeds = 120000-500 = 119500; PnL = 119500-101000 = 18500
    expect(result.sells[0]).toMatchObject({ costBasisTiyin: 101000, proceedsTiyin: 119500, realizedPnlTiyin: 18500 });
  });

  it("splits a sell across more than one lot when the oldest doesn't cover it", () => {
    const trades: FifoTrade[] = [
      { id: 1, side: "buy", date: "2026-01-01", quantity: 2, amountTiyin: 20000, commissionTiyin: 0 },
      { id: 2, side: "buy", date: "2026-01-05", quantity: 5, amountTiyin: 60000, commissionTiyin: 0 },
      { id: 3, side: "sell", date: "2026-02-01", quantity: 4, amountTiyin: 50000, commissionTiyin: 0 },
    ];
    const result = computeFifo(trades);
    // lot1 fully consumed (2 @ 10000 = 20000) + 2 from lot2 (2 @ 12000 = 24000) = 44000
    expect(result.sells[0].costBasisTiyin).toBe(44000);
    expect(result.remainingQuantity).toBe(3); // 3 left in lot2
  });

  it("skips a trade whose quantity couldn't be estimated (<=0) instead of corrupting the lot queue", () => {
    const trades: FifoTrade[] = [
      { id: 1, side: "buy", date: "2026-01-01", quantity: 0, amountTiyin: 20000, commissionTiyin: 0 },
      { id: 2, side: "buy", date: "2026-01-05", quantity: 5, amountTiyin: 60000, commissionTiyin: 0 },
    ];
    const result = computeFifo(trades);
    expect(result.remainingQuantity).toBe(5);
  });

  it("processes trades in date order regardless of input order", () => {
    const trades: FifoTrade[] = [
      { id: 2, side: "sell", date: "2026-02-01", quantity: 1, amountTiyin: 15000, commissionTiyin: 0 },
      { id: 1, side: "buy", date: "2026-01-01", quantity: 1, amountTiyin: 10000, commissionTiyin: 0 },
    ];
    const result = computeFifo(trades);
    expect(result.sells[0].costBasisTiyin).toBe(10000);
  });
});
