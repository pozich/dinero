import { describe, expect, it } from "vitest";
import { createTestDb } from "../testDb";
import { getAccountIdByKind } from "../../src/db/accounts";
import { insertTransaction } from "../../src/db/transactions";
import { importInvestmentRows } from "../../src/import/importInvestments";
import { listTrades } from "../../src/db/trades";
import { listDividends } from "../../src/db/dividends";
import type { ParsedTransaction } from "../../src/parsers/types";

async function seedTx(db: ReturnType<typeof createTestDb>, dedupKey: string, description: string, amountTiyin: number) {
  const accountId = await getAccountIdByKind(db, "halyk_standard");
  return insertTransaction(db, {
    accountId,
    statementId: null,
    occurredAt: "2025-07-18T00:00:00.000Z",
    amountTiyin,
    description,
    rawType: description,
    dedupKey,
  });
}

function tx(description: string, amountTiyin: number): ParsedTransaction {
  return { occurredAt: "2025-07-18T00:00:00.000Z", amountTiyin, description, rawType: description };
}

describe("importInvestmentRows", () => {
  it("extracts a trade from a buy description", async () => {
    const db = createTestDb();
    const description = "Исходящий перевод Broker Покупка акции: KEGC . На сумму: 21780. Номер заявки: BP0003342626";
    const id = await seedTx(db, "t1", description, -2178000);
    await importInvestmentRows(db, [tx(description, -2178000)], [id]);
    const [trade] = await listTrades(db);
    expect(trade).toMatchObject({ ticker: "KEGC", side: "buy", amountTiyin: 2178000, orderNumber: "BP0003342626" });
  });

  it("extracts a dividend, deriving quantity-at-payment", async () => {
    const db = createTestDb();
    const description = "Зачисление дивидендов Выплата дивидендов по ЦБ KZ000A0LE0S4 дивиденд на 1 акцию 21 KZT ставка налога 0";
    const id = await seedTx(db, "d1", description, 42000);
    await importInvestmentRows(db, [tx(description, 42000)], [id]);
    const [dividend] = await listDividends(db);
    expect(dividend).toMatchObject({ ticker: "HSBK", perShareTiyin: 2100, quantityAtPayment: 20 });
  });

  it("is idempotent: calling it twice for the same transaction doesn't duplicate the trade", async () => {
    const db = createTestDb();
    const description = "Исходящий перевод Broker Покупка акции: KEGC . На сумму: 21780. Номер заявки: BP0003342626";
    const id = await seedTx(db, "t1", description, -2178000);
    await importInvestmentRows(db, [tx(description, -2178000)], [id]);
    await importInvestmentRows(db, [tx(description, -2178000)], [id]);
    expect(await listTrades(db)).toHaveLength(1);
  });

  it("ignores a transaction that isn't a trade or dividend", async () => {
    const db = createTestDb();
    const id = await seedTx(db, "t1", "Поступление перевода", 100000);
    await importInvestmentRows(db, [tx("Поступление перевода", 100000)], [id]);
    expect(await listTrades(db)).toHaveLength(0);
    expect(await listDividends(db)).toHaveLength(0);
  });

  it("creates a placeholder security for an unrecognized ticker", async () => {
    const db = createTestDb();
    const description = "Исходящий перевод Broker Покупка акции: ZZZZ . На сумму: 1000. Номер заявки: BP1";
    const id = await seedTx(db, "t1", description, -100000);
    await importInvestmentRows(db, [tx(description, -100000)], [id]);
    const [trade] = await listTrades(db);
    expect(trade.isin).toBe("UNKNOWN:ZZZZ");
  });
});
