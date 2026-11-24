import { describe, expect, it } from "vitest";
import { computePosition, fillPortfolioShares } from "../../src/investments/computePositions";
import type { FifoResult } from "../../src/investments/fifo";

const SECURITY = { isin: "X", ticker: "TST", name: "Test Co", industry: "Прочее" };

function fifo(partial: Partial<FifoResult>): FifoResult {
  return { openLots: [], sells: [], remainingQuantity: 10, averageCostTiyin: 1000, totalInvestedTiyin: 10000, ...partial };
}

describe("computePosition", () => {
  it("computes current value, PnL tiyin and percent from a price", () => {
    const position = computePosition(fifo({}), 1200, 500, 0, SECURITY);
    expect(position.currentValueTiyin).toBe(12000); // 10 * 1200
    expect(position.pnlTiyin).toBe(2000); // 12000 - 10000
    expect(position.pnlPercent).toBe(20);
  });

  it("returns null for every price-dependent field when there's no cached price", () => {
    const position = computePosition(fifo({}), null, 0, 0, SECURITY);
    expect(position.currentValueTiyin).toBeNull();
    expect(position.pnlTiyin).toBeNull();
    expect(position.pnlPercent).toBeNull();
  });

  it("carries through commission and dividends untouched", () => {
    const position = computePosition(fifo({}), 1000, 777, 4200, SECURITY);
    expect(position.commissionPaidTiyin).toBe(777);
    expect(position.dividendsReceivedTiyin).toBe(4200);
  });

  it("doesn't divide by zero when nothing is invested", () => {
    const position = computePosition(fifo({ remainingQuantity: 0, totalInvestedTiyin: 0 }), 1000, 0, 0, SECURITY);
    expect(position.pnlPercent).toBeNull();
  });
});

describe("fillPortfolioShares", () => {
  it("splits portfolio share proportionally to current value", () => {
    const a = computePosition(fifo({ remainingQuantity: 1, totalInvestedTiyin: 1000 }), 3000, 0, 0, { ...SECURITY, isin: "A" });
    const b = computePosition(fifo({ remainingQuantity: 1, totalInvestedTiyin: 1000 }), 1000, 0, 0, { ...SECURITY, isin: "B" });
    const [filledA, filledB] = fillPortfolioShares([a, b]);
    expect(filledA.portfolioSharePercent).toBe(75);
    expect(filledB.portfolioSharePercent).toBe(25);
  });

  it("leaves a position's share null when it has no current value", () => {
    const a = computePosition(fifo({}), null, 0, 0, SECURITY);
    expect(fillPortfolioShares([a])[0].portfolioSharePercent).toBeNull();
  });
});
