import { describe, expect, it } from "vitest";
import { createTestDb } from "../testDb";
import { getAccountIdByKind } from "../../src/db/accounts";
import { insertTransaction } from "../../src/db/transactions";
import { insertTrade } from "../../src/db/trades";
import { insertDividend } from "../../src/db/dividends";
import { importSnapshot } from "../../src/db/securitySnapshots";
import { upsertPrices } from "../../src/db/securityPrices";
import { queryInvestmentsOverview } from "../../src/db/investmentsOverview";

async function seedTx(db: ReturnType<typeof createTestDb>, dedupKey: string, amountTiyin: number, occurredAt: string) {
  const accountId = await getAccountIdByKind(db, "halyk_standard");
  return insertTransaction(db, {
    accountId,
    statementId: null,
    occurredAt,
    amountTiyin,
    description: "x",
    rawType: "x",
    dedupKey,
  });
}

const KSPI_ISIN = "KZ1C00001536";

describe("queryInvestmentsOverview", () => {
  it("fills in a missing estimated quantity once a price exists, and persists it", async () => {
    const db = createTestDb();
    const txId = await seedTx(db, "t1", -100000, "2026-01-05T00:00:00.000Z");
    const tradeId = await insertTrade(db, {
      transactionId: txId,
      isin: KSPI_ISIN,
      side: "buy",
      amountTiyin: 100000,
      orderNumber: null,
      commissionTiyin: 0,
    });
    await upsertPrices(db, KSPI_ISIN, [{ date: "2026-01-01", closeTiyin: 50000 }]);

    const overview = await queryInvestmentsOverview(db);
    const trade = overview.trades.find((t) => t.id === tradeId);
    expect(trade?.estimatedQuantity).toBe(2); // 100000 / 50000

    // persisted: a second call doesn't need the price lookup to see it again
    const second = await queryInvestmentsOverview(db);
    expect(second.trades.find((t) => t.id === tradeId)?.estimatedQuantity).toBe(2);
  });

  it("builds a position with current value/PnL once a current price exists", async () => {
    const db = createTestDb();
    const txId = await seedTx(db, "t1", -100000, "2026-01-05T00:00:00.000Z");
    await insertTrade(db, { transactionId: txId, isin: KSPI_ISIN, side: "buy", amountTiyin: 100000, orderNumber: null, commissionTiyin: 0 });
    await upsertPrices(db, KSPI_ISIN, [
      { date: "2026-01-01", closeTiyin: 50000 },
      { date: "2026-06-01", closeTiyin: 60000 },
    ]);

    const overview = await queryInvestmentsOverview(db, new Date("2026-06-15T00:00:00.000Z"));
    const [position] = overview.positions;
    expect(position.quantity).toBe(2);
    expect(position.currentPriceTiyin).toBe(60000);
    expect(position.currentValueTiyin).toBe(120000);
    expect(position.pnlTiyin).toBe(20000);
  });

  it("includes dividends received for a position", async () => {
    const db = createTestDb();
    const buyTx = await seedTx(db, "t1", -100000, "2026-01-05T00:00:00.000Z");
    await insertTrade(db, { transactionId: buyTx, isin: KSPI_ISIN, side: "buy", amountTiyin: 100000, orderNumber: null, commissionTiyin: 0 });
    const divTx = await seedTx(db, "t2", 5000, "2026-02-01T00:00:00.000Z");
    await insertDividend(db, { transactionId: divTx, isin: KSPI_ISIN, perShareTiyin: 2500, taxRatePercent: 0, quantityAtPayment: 2 });
    await upsertPrices(db, KSPI_ISIN, [{ date: "2026-01-01", closeTiyin: 50000 }]);

    const overview = await queryInvestmentsOverview(db);
    expect(overview.positions[0].dividendsReceivedTiyin).toBe(5000);
  });

  it("skips a security with no trades at all", async () => {
    const db = createTestDb();
    const overview = await queryInvestmentsOverview(db);
    expect(overview.positions).toHaveLength(0);
  });

  it("runs the golden check against imported snapshots", async () => {
    const db = createTestDb();
    const txId = await seedTx(db, "t1", -100000, "2026-01-05T00:00:00.000Z");
    await insertTrade(db, { transactionId: txId, isin: KSPI_ISIN, side: "buy", amountTiyin: 100000, orderNumber: null, commissionTiyin: 0 });
    await upsertPrices(db, KSPI_ISIN, [{ date: "2026-01-01", closeTiyin: 50000 }]);
    await importSnapshot(db, { snapshotDate: "2026-02-01T00:00:00.000Z", holdings: [{ isin: KSPI_ISIN, quantity: 2 }] });

    const overview = await queryInvestmentsOverview(db);
    expect(overview.goldenCheck).toEqual([
      { isin: KSPI_ISIN, snapshotDate: "2026-02-01", estimatedQuantity: 2, snapshotQuantity: 2, discrepancy: 0 },
    ]);
  });
});
