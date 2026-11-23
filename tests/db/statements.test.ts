import { describe, expect, it } from "vitest";
import { createTestDb } from "../testDb";
import { getAccountIdByKind } from "../../src/db/accounts";
import { findOrCreateCategory } from "../../src/db/categories";
import { insertTransaction, insertTransferLink, setTransactionCategory } from "../../src/db/transactions";
import {
  insertStatement,
  listStatements,
  countCategorizedTransactions,
  deleteStatement,
} from "../../src/db/statements";

async function seed(db: ReturnType<typeof createTestDb>) {
  const kaspiId = await getAccountIdByKind(db, "kaspi_gold");
  const depositId = await getAccountIdByKind(db, "kaspi_deposit");

  const statementId = await insertStatement(db, {
    accountId: kaspiId,
    bank: "kaspi",
    periodStart: "2026-01-01T00:00:00.000Z",
    periodEnd: "2026-10-31T00:00:00.000Z",
    fileHash: "abc",
    fileName: "kaspi_oct.pdf",
  });

  const main = await insertTransaction(db, {
    accountId: kaspiId,
    statementId,
    occurredAt: "2026-10-01T00:00:00.000Z",
    amountTiyin: -1000000,
    description: "To Kaspi Deposit",
    rawType: "Transfer to your account",
    dedupKey: "k1",
  });
  const mirror = await insertTransaction(db, {
    accountId: depositId,
    statementId,
    occurredAt: "2026-10-01T00:00:00.000Z",
    amountTiyin: 1000000,
    description: "To Kaspi Deposit",
    rawType: "Transfer to your account",
    dedupKey: "k2",
  });
  await insertTransferLink(db, main, mirror, true);

  const categorized = await insertTransaction(db, {
    accountId: kaspiId,
    statementId,
    occurredAt: "2026-10-02T00:00:00.000Z",
    amountTiyin: -50000,
    description: "Сатти Маркет",
    rawType: "Purchases",
    dedupKey: "k3",
  });
  const foodCategory = await findOrCreateCategory(db, "Еда");
  await setTransactionCategory(db, categorized, foodCategory, -50000);

  return { statementId, main, mirror, categorized };
}

describe("statements: listing, categorized-count warning, deletion", () => {
  it("lists a statement with account name and transaction count", async () => {
    const db = createTestDb();
    await seed(db);

    const rows = await listStatements(db);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      account_name: "Kaspi Gold",
      transaction_count: 2, // main + categorized; the mirror lives on a different account
    });
  });

  it("counts only the categorized transactions for the delete warning", async () => {
    const db = createTestDb();
    const { statementId } = await seed(db);
    expect(await countCategorizedTransactions(db, statementId)).toBe(1);
  });

  it("deleteStatement removes the statement, its transactions, splits and transfer_links", async () => {
    const db = createTestDb();
    const { statementId } = await seed(db);

    await deleteStatement(db, statementId);

    expect(await listStatements(db)).toHaveLength(0);
    expect(await db.select<unknown[]>("SELECT * FROM transactions")).toHaveLength(0);
    expect(await db.select<unknown[]>("SELECT * FROM splits")).toHaveLength(0);
    expect(await db.select<unknown[]>("SELECT * FROM transfer_links")).toHaveLength(0);
  });
});
