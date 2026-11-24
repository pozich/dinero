import { describe, expect, it } from "vitest";
import { createTestDb } from "../testDb";
import { getAccountIdByKind } from "../../src/db/accounts";
import { findOrCreateCategory } from "../../src/db/categories";
import { insertTransaction, setTransactionCategory } from "../../src/db/transactions";
import { createCategoryRule } from "../../src/db/categoryRules";
import {
  renameCategory,
  moveCategory,
  mergeCategories,
  deleteCategory,
  listCategoryCounts,
} from "../../src/db/categoryTree";

async function seedTransaction(db: ReturnType<typeof createTestDb>, categoryId: number, amount: number) {
  const kaspiId = await getAccountIdByKind(db, "kaspi_gold");
  const txId = await insertTransaction(db, {
    accountId: kaspiId,
    statementId: null,
    occurredAt: "2026-01-01T00:00:00.000Z",
    amountTiyin: amount,
    description: "x",
    rawType: null,
    dedupKey: `tx-${Math.random()}`,
  });
  await setTransactionCategory(db, txId, categoryId, amount);
  return txId;
}

describe("categoryTree", () => {
  it("renameCategory changes the name", async () => {
    const db = createTestDb();
    const id = await findOrCreateCategory(db, "Еда");
    await renameCategory(db, id, "Продукты");
    const [row] = await db.select<{ name: string }[]>("SELECT name FROM categories WHERE id = $1", [id]);
    expect(row.name).toBe("Продукты");
  });

  it("moveCategory refuses to make a category its own parent", async () => {
    const db = createTestDb();
    const id = await findOrCreateCategory(db, "Еда");
    await expect(moveCategory(db, id, id)).rejects.toThrow();
  });

  it("moveCategory reparents it otherwise", async () => {
    const db = createTestDb();
    const parent = await findOrCreateCategory(db, "Траты");
    const child = await findOrCreateCategory(db, "Еда");
    await moveCategory(db, child, parent);
    const [row] = await db.select<{ parent_id: number }[]>(
      "SELECT parent_id FROM categories WHERE id = $1",
      [child],
    );
    expect(row.parent_id).toBe(parent);
  });

  it("mergeCategories reassigns splits, rules, and children, then removes the source", async () => {
    const db = createTestDb();
    const source = await findOrCreateCategory(db, "Кафе");
    const target = await findOrCreateCategory(db, "Еда");
    const child = await findOrCreateCategory(db, "Кофейни", source);
    await createCategoryRule(db, { pattern: "кафе", caseSensitive: false, categoryId: source });
    const txId = await seedTransaction(db, source, -50000);

    await mergeCategories(db, source, target);

    const [split] = await db.select<{ category_id: number }[]>(
      "SELECT category_id FROM splits WHERE transaction_id = $1",
      [txId],
    );
    expect(split.category_id).toBe(target);

    const [rule] = await db.select<{ category_id: number }[]>(
      "SELECT category_id FROM category_rules WHERE pattern = $1",
      ["кафе"],
    );
    expect(rule.category_id).toBe(target);

    const [childRow] = await db.select<{ parent_id: number }[]>(
      "SELECT parent_id FROM categories WHERE id = $1",
      [child],
    );
    expect(childRow.parent_id).toBe(target);

    const [{ n }] = await db.select<{ n: number }[]>(
      "SELECT COUNT(*) AS n FROM categories WHERE id = $1",
      [source],
    );
    expect(n).toBe(0);
  });

  it("mergeCategories refuses to touch a system category as the source", async () => {
    const db = createTestDb();
    const [{ id: systemId }] = await db.select<{ id: number }[]>(
      "SELECT id FROM categories WHERE is_system = 1 LIMIT 1",
    );
    const target = await findOrCreateCategory(db, "Еда");
    await expect(mergeCategories(db, systemId, target)).rejects.toThrow();
  });

  it("deleteCategory with a replacement reassigns splits and rules", async () => {
    const db = createTestDb();
    const doomed = await findOrCreateCategory(db, "Временная");
    const replacement = await findOrCreateCategory(db, "Прочее");
    await createCategoryRule(db, { pattern: "x", caseSensitive: false, categoryId: doomed });
    const txId = await seedTransaction(db, doomed, -10000);

    await deleteCategory(db, doomed, replacement);

    const [split] = await db.select<{ category_id: number }[]>(
      "SELECT category_id FROM splits WHERE transaction_id = $1",
      [txId],
    );
    expect(split.category_id).toBe(replacement);
    const [{ n: ruleCount }] = await db.select<{ n: number }[]>(
      "SELECT COUNT(*) AS n FROM category_rules WHERE category_id = $1",
      [replacement],
    );
    expect(ruleCount).toBe(1);
  });

  it("deleteCategory with no replacement clears splits and drops rules that pointed at it", async () => {
    const db = createTestDb();
    const doomed = await findOrCreateCategory(db, "Временная");
    await createCategoryRule(db, { pattern: "x", caseSensitive: false, categoryId: doomed });
    const txId = await seedTransaction(db, doomed, -10000);

    await deleteCategory(db, doomed, null);

    const [split] = await db.select<{ category_id: number | null }[]>(
      "SELECT category_id FROM splits WHERE transaction_id = $1",
      [txId],
    );
    expect(split.category_id).toBeNull();
    const [{ n: ruleCount }] = await db.select<{ n: number }[]>(
      "SELECT COUNT(*) AS n FROM category_rules",
    );
    expect(ruleCount).toBe(0);
  });

  it("listCategoryCounts aggregates count and total per category", async () => {
    const db = createTestDb();
    const food = await findOrCreateCategory(db, "Еда");
    await seedTransaction(db, food, -10000);
    await seedTransaction(db, food, -20000);

    const counts = await listCategoryCounts(db);
    const foodCount = counts.find((c) => c.category_id === food);
    expect(foodCount).toEqual({ category_id: food, count: 2, total_tiyin: -30000 });
  });
});
