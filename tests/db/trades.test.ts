import { describe, expect, it } from "vitest";
import { createTestDb } from "../testDb";
import { getAccountIdByKind } from "../../src/db/accounts";
import { insertTransaction } from "../../src/db/transactions";
import {
  insertTrade,
  listTrades,
  listTradesByIsin,
  findOrCreateSecurityByTicker,
  setEstimatedQuantity,
  tradeExistsForTransaction,
} from "../../src/db/trades";

async function seedTransaction(db: ReturnType<typeof createTestDb>, dedupKey: string, amountTiyin = -2178000) {
  const accountId = await getAccountIdByKind(db, "halyk_standard");
  return insertTransaction(db, {
    accountId,
    statementId: null,
    occurredAt: "2025-07-18T00:00:00.000Z",
    amountTiyin,
    description: "Исходящий перевод Broker Покупка акции: KEGC . На сумму: 21780. Номер заявки: BP0003342626",
    rawType: "Исходящий перевод Broker",
    dedupKey,
  });
}

describe("trades", () => {
  it("inserts and lists a trade joined with its security's ticker", async () => {
    const db = createTestDb();
    const transactionId = await seedTransaction(db, "t1");
    await insertTrade(db, {
      transactionId,
      isin: "KZ1C00000959",
      side: "buy",
      amountTiyin: 2178000,
      orderNumber: "BP0003342626",
      commissionTiyin: 0,
    });
    const [trade] = await listTrades(db);
    expect(trade).toMatchObject({ transactionId, ticker: "KEGC", side: "buy", amountTiyin: 2178000, estimatedQuantity: null });
  });

  it("lists trades filtered to one security", async () => {
    const db = createTestDb();
    const t1 = await seedTransaction(db, "t1");
    const t2 = await seedTransaction(db, "t2");
    await insertTrade(db, { transactionId: t1, isin: "KZ1C00000959", side: "buy", amountTiyin: 1000, orderNumber: null, commissionTiyin: 0 });
    await insertTrade(db, { transactionId: t2, isin: "KZ1C00001536", side: "buy", amountTiyin: 2000, orderNumber: null, commissionTiyin: 0 });
    expect(await listTradesByIsin(db, "KZ1C00000959")).toHaveLength(1);
  });

  it("sets an estimated quantity after the fact", async () => {
    const db = createTestDb();
    const transactionId = await seedTransaction(db, "t1");
    const tradeId = await insertTrade(db, {
      transactionId,
      isin: "KZ1C00000959",
      side: "buy",
      amountTiyin: 2178000,
      orderNumber: null,
      commissionTiyin: 0,
    });
    await setEstimatedQuantity(db, tradeId, 5);
    expect((await listTrades(db))[0].estimatedQuantity).toBe(5);
  });

  it("creates a placeholder security for an unrecognized ticker instead of failing", async () => {
    const db = createTestDb();
    const isin = await findOrCreateSecurityByTicker(db, "NEWCO");
    expect(isin).toBe("UNKNOWN:NEWCO");
    expect(await findOrCreateSecurityByTicker(db, "NEWCO")).toBe(isin); // idempotent
  });

  it("resolves a known ticker to its real seeded isin", async () => {
    const db = createTestDb();
    expect(await findOrCreateSecurityByTicker(db, "KSPI")).toBe("KZ1C00001536");
  });

  it("checks whether a transaction already has a trade behind it", async () => {
    const db = createTestDb();
    const transactionId = await seedTransaction(db, "t1");
    expect(await tradeExistsForTransaction(db, transactionId)).toBe(false);
    await insertTrade(db, { transactionId, isin: "KZ1C00000959", side: "buy", amountTiyin: 1000, orderNumber: null, commissionTiyin: 0 });
    expect(await tradeExistsForTransaction(db, transactionId)).toBe(true);
  });
});
