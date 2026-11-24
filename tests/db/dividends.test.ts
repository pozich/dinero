import { describe, expect, it } from "vitest";
import { createTestDb } from "../testDb";
import { getAccountIdByKind } from "../../src/db/accounts";
import { insertTransaction } from "../../src/db/transactions";
import { insertDividend, listDividends, listDividendsByIsin, dividendExistsForTransaction } from "../../src/db/dividends";

async function seedTransaction(db: ReturnType<typeof createTestDb>, dedupKey: string, amountTiyin = 42000) {
  const accountId = await getAccountIdByKind(db, "halyk_standard");
  return insertTransaction(db, {
    accountId,
    statementId: null,
    occurredAt: "2025-10-09T00:00:00.000Z",
    amountTiyin,
    description: "Зачисление дивидендов Выплата дивидендов по ЦБ KZ000A0LE0S4 дивиденд на 1 акцию 21 KZT",
    rawType: "Зачисление дивидендов",
    dedupKey,
  });
}

describe("dividends", () => {
  it("inserts and lists a dividend joined with its known security", async () => {
    const db = createTestDb();
    const transactionId = await seedTransaction(db, "d1");
    await insertDividend(db, { transactionId, isin: "KZ000A0LE0S4", perShareTiyin: 2100, taxRatePercent: 0, quantityAtPayment: 20 });
    const [dividend] = await listDividends(db);
    expect(dividend).toMatchObject({ transactionId, ticker: "HSBK", amountTiyin: 42000, perShareTiyin: 2100, quantityAtPayment: 20 });
  });

  it("still lists a dividend under an ISIN the dictionary doesn't recognize, with null ticker/name", async () => {
    const db = createTestDb();
    const transactionId = await seedTransaction(db, "d1");
    await insertDividend(db, { transactionId, isin: "KZ999UNKNOWN0", perShareTiyin: 1000, taxRatePercent: 0, quantityAtPayment: 1 });
    const [dividend] = await listDividends(db);
    expect(dividend.ticker).toBeNull();
    expect(dividend.isin).toBe("KZ999UNKNOWN0");
  });

  it("filters to one security", async () => {
    const db = createTestDb();
    const t1 = await seedTransaction(db, "d1");
    const t2 = await seedTransaction(db, "d2");
    await insertDividend(db, { transactionId: t1, isin: "KZ000A0LE0S4", perShareTiyin: 2100, taxRatePercent: 0, quantityAtPayment: 20 });
    await insertDividend(db, { transactionId: t2, isin: "KZ1C00001536", perShareTiyin: 85000, taxRatePercent: 0, quantityAtPayment: 1 });
    expect(await listDividendsByIsin(db, "KZ000A0LE0S4")).toHaveLength(1);
  });

  it("checks whether a transaction already has a dividend behind it", async () => {
    const db = createTestDb();
    const transactionId = await seedTransaction(db, "d1");
    expect(await dividendExistsForTransaction(db, transactionId)).toBe(false);
    await insertDividend(db, { transactionId, isin: "KZ000A0LE0S4", perShareTiyin: 2100, taxRatePercent: 0, quantityAtPayment: 20 });
    expect(await dividendExistsForTransaction(db, transactionId)).toBe(true);
  });
});
