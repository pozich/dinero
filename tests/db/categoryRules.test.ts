import { describe, expect, it } from "vitest";
import { createTestDb } from "../testDb";
import { findOrCreateCategory } from "../../src/db/categories";
import {
  listCategoryRules,
  createCategoryRule,
  updateCategoryRule,
  deleteCategoryRule,
  moveCategoryRule,
} from "../../src/db/categoryRules";

describe("category rules (node:sqlite, real migrations)", () => {
  it("creates rules with increasing priority and lists them in order", async () => {
    const db = createTestDb();
    const food = await findOrCreateCategory(db, "Еда");
    const transport = await findOrCreateCategory(db, "Транспорт");

    await createCategoryRule(db, { pattern: "Сатти", caseSensitive: false, categoryId: food });
    await createCategoryRule(db, { pattern: "Avtobys", caseSensitive: false, categoryId: transport });

    const rules = await listCategoryRules(db);
    expect(rules.map((r) => r.pattern)).toEqual(["Сатти", "Avtobys"]);
    expect(rules.map((r) => r.priority)).toEqual([0, 1]);
    expect(rules[0].category_name).toBe("Еда");
  });

  it("moveCategoryRule swaps priority with the neighbour", async () => {
    const db = createTestDb();
    const cat = await findOrCreateCategory(db, "Еда");
    const first = await createCategoryRule(db, { pattern: "a", caseSensitive: false, categoryId: cat });
    const second = await createCategoryRule(db, { pattern: "b", caseSensitive: false, categoryId: cat });

    await moveCategoryRule(db, second, "up");

    const rules = await listCategoryRules(db);
    expect(rules.map((r) => r.id)).toEqual([second, first]);
  });

  it("updateCategoryRule changes only the given fields", async () => {
    const db = createTestDb();
    const cat = await findOrCreateCategory(db, "Еда");
    const id = await createCategoryRule(db, { pattern: "a", caseSensitive: false, categoryId: cat });

    await updateCategoryRule(db, id, { isActive: false });

    const [rule] = await listCategoryRules(db);
    expect(rule.is_active).toBe(0);
    expect(rule.pattern).toBe("a");
  });

  it("deleteCategoryRule removes it", async () => {
    const db = createTestDb();
    const cat = await findOrCreateCategory(db, "Еда");
    const id = await createCategoryRule(db, { pattern: "a", caseSensitive: false, categoryId: cat });

    await deleteCategoryRule(db, id);

    expect(await listCategoryRules(db)).toHaveLength(0);
  });
});
