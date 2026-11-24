import { describe, expect, it } from "vitest";
import { createTestDb } from "../testDb";
import { getAccountIdByKind } from "../../src/db/accounts";
import { insertTransaction } from "../../src/db/transactions";
import { insertStatement } from "../../src/db/statements";
import { queryAccountOverview } from "../../src/db/accountOverview";

describe("queryAccountOverview", () => {
  it("reports no gaps for a virtual account that never had a statement", async () => {
    const db = createTestDb();
    const cashId = await getAccountIdByKind(db, "cash");
    await insertTransaction(db, {
      accountId: cashId,
      statementId: null,
      occurredAt: "2026-01-01T00:00:00.000Z",
      amountTiyin: -5000,
      description: "x",
      rawType: null,
      dedupKey: "c1",
    });

    const overview = await queryAccountOverview(db);
    const cash = overview.find((a) => a.accountKind === "cash")!;
    expect(cash.gaps).toEqual([]);
    expect(cash.currentBalanceTiyin).toBe(-5000);
  });

  it("flags a real account's balance discrepancy against its last statement", async () => {
    const db = createTestDb();
    const kaspiId = await getAccountIdByKind(db, "kaspi_gold");
    await insertStatement(db, {
      accountId: kaspiId,
      bank: "kaspi",
      periodStart: "2026-01-01T00:00:00.000Z",
      periodEnd: "2026-01-31T00:00:00.000Z",
      fileHash: "h1",
      fileName: "f1.pdf",
      closingBalanceTiyin: -10000,
    });
    await insertTransaction(db, {
      accountId: kaspiId,
      statementId: null,
      occurredAt: "2026-01-15T00:00:00.000Z",
      amountTiyin: -7000, // doesn't match the statement's claimed closing balance
      description: "x",
      rawType: null,
      dedupKey: "k1",
    });

    const overview = await queryAccountOverview(db);
    const kaspi = overview.find((a) => a.accountKind === "kaspi_gold")!;
    expect(kaspi.discrepancyTiyin).toBe(3000);
  });
});
