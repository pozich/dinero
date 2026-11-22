import { describe, expect, it } from "vitest";
import { createTestDb } from "../testDb";
import { getAccountIdByKind } from "../../src/db/accounts";
import { findOrCreateCategory } from "../../src/db/categories";
import {
  insertTransaction,
  setTransactionCategory,
  setTransactionSplits,
} from "../../src/db/transactions";
import { queryTransactions } from "../../src/db/transactionsQuery";

async function seed(db: ReturnType<typeof createTestDb>) {
  const kaspiId = await getAccountIdByKind(db, "kaspi_gold");
  const halykId = await getAccountIdByKind(db, "halyk_salary");

  const coffee1 = await insertTransaction(db, {
    accountId: kaspiId,
    statementId: null,
    occurredAt: "2026-10-20T00:00:00.000Z",
    amountTiyin: -90000,
    description: "Сатти Маркет",
    rawType: "Purchases",
    dedupKey: "k1",
  });
  const coffee2 = await insertTransaction(db, {
    accountId: kaspiId,
    statementId: null,
    occurredAt: "2026-10-20T00:00:00.000Z",
    amountTiyin: -90000,
    description: "Сатти Маркет",
    rawType: "Purchases",
    dedupKey: "k2",
  });
  const salary = await insertTransaction(db, {
    accountId: halykId,
    statementId: null,
    occurredAt: "2026-10-18T00:00:00.000Z",
    amountTiyin: 500000,
    description: "Поступление перевода",
    rawType: "Поступление перевода",
    dedupKey: "k3",
  });

  return { kaspiId, halykId, coffee1, coffee2, salary };
}

describe("db transactions layer (node:sqlite, real migration)", () => {
  it("lists transactions with account names, newest first by default", async () => {
    const db = createTestDb();
    await seed(db);

    const rows = await queryTransactions(db);
    expect(rows).toHaveLength(3);
    expect(rows[0].occurred_at.startsWith("2026-10-20")).toBe(true);
    expect(rows.every((r) => r.account_name.length > 0)).toBe(true);
    expect(rows.every((r) => r.category_id === null && r.split_count === 0)).toBe(true);
  });

  it("filters by account, search and uncategorized", async () => {
    const db = createTestDb();
    const { kaspiId, halykId } = await seed(db);

    expect(await queryTransactions(db, { accountId: kaspiId })).toHaveLength(2);
    expect(await queryTransactions(db, { accountId: halykId })).toHaveLength(1);
    expect(await queryTransactions(db, { search: "Маркет" })).toHaveLength(2);
    expect(await queryTransactions(db, { search: "Маркет", exactDescription: "Сатти Маркет" })).toHaveLength(2);
  });

  it("setTransactionCategory assigns a single full-amount split and shows up in the listing", async () => {
    const db = createTestDb();
    const { coffee1 } = await seed(db);
    const categoryId = await findOrCreateCategory(db, "Еда");

    await setTransactionCategory(db, coffee1, categoryId, -90000);

    const rows = await queryTransactions(db, { onlyUncategorized: true });
    expect(rows).toHaveLength(2); // coffee2 + salary remain uncategorized

    const [row] = await queryTransactions(db, { search: "Сатти" }).then((r) =>
      r.filter((x) => x.id === coffee1),
    );
    expect(row.category_name).toBe("Еда");
    expect(row.split_count).toBe(1);
  });

  it("findOrCreateCategory returns the same id for the same name, a new one otherwise", async () => {
    const db = createTestDb();
    const first = await findOrCreateCategory(db, "Еда");
    const again = await findOrCreateCategory(db, "Еда");
    const other = await findOrCreateCategory(db, "Транспорт");
    expect(again).toBe(first);
    expect(other).not.toBe(first);
  });

  it("setTransactionSplits rejects a sum that doesn't match the transaction amount", async () => {
    const db = createTestDb();
    const { coffee1 } = await seed(db);
    const food = await findOrCreateCategory(db, "Еда");
    const transport = await findOrCreateCategory(db, "Транспорт");

    await expect(
      setTransactionSplits(db, coffee1, -90000, [
        { categoryId: food, amountTiyin: -50000 },
        { categoryId: transport, amountTiyin: -30000 },
      ]),
    ).rejects.toThrow();

    await setTransactionSplits(db, coffee1, -90000, [
      { categoryId: food, amountTiyin: -60000 },
      { categoryId: transport, amountTiyin: -30000 },
    ]);
    const rows = await queryTransactions(db);
    const row = rows.find((r) => r.id === coffee1)!;
    expect(row.split_count).toBe(2);
  });

  it("excludeId leaves the given transaction out (used by 'apply to similar')", async () => {
    const db = createTestDb();
    const { coffee1, coffee2 } = await seed(db);
    const rows = await queryTransactions(db, {
      exactDescription: "Сатти Маркет",
      onlyUncategorized: true,
      excludeId: coffee1,
    });
    expect(rows.map((r) => r.id)).toEqual([coffee2]);
  });
});
