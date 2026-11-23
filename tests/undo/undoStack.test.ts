import { describe, it, expect } from "vitest";
import { createTestDb } from "../testDb";
import { UndoStack, withUndo } from "../../src/undo/undoStack";

const RULES_SPEC = [{ table: "category_rules", whereSql: "1=1", params: [] }];

describe("UndoStack", () => {
  it("run(): undo reverts an update, redo re-applies it", async () => {
    const db = createTestDb();
    const [{ id: categoryId }] = await db.select<{ id: number }[]>(
      "SELECT id FROM categories LIMIT 1",
    );
    await db.execute(
      "INSERT INTO category_rules (pattern, case_sensitive, category_id, priority) VALUES ($1, $2, $3, $4)",
      ["foo", 0, categoryId, 0],
    );
    const stack = new UndoStack(db);

    await stack.run("toggle", RULES_SPEC, () =>
      db.execute("UPDATE category_rules SET is_active = 0 WHERE pattern = $1", ["foo"]).then(() => undefined),
    );
    expect(await activeFlag(db)).toBe(0);

    expect(await stack.undo()).toBe("toggle");
    expect(await activeFlag(db)).toBe(1);

    expect(await stack.redo()).toBe("toggle");
    expect(await activeFlag(db)).toBe(0);
  });

  it("run(): undo removes a row inserted during the action, redo brings it back", async () => {
    const db = createTestDb();
    const [{ id: categoryId }] = await db.select<{ id: number }[]>(
      "SELECT id FROM categories LIMIT 1",
    );
    const stack = new UndoStack(db);

    await stack.run("new rule", RULES_SPEC, () =>
      db
        .execute(
          "INSERT INTO category_rules (pattern, case_sensitive, category_id, priority) VALUES ($1, $2, $3, $4)",
          ["bar", 0, categoryId, 0],
        )
        .then(() => undefined),
    );
    expect(await ruleCount(db)).toBe(1);

    await stack.undo();
    expect(await ruleCount(db)).toBe(0);

    await stack.redo();
    expect(await ruleCount(db)).toBe(1);
  });

  it("pushCreated(): undo deletes the freshly-created row, redo restores it", async () => {
    const db = createTestDb();
    const stack = new UndoStack(db);

    const result = await db.execute("INSERT INTO categories (name) VALUES ($1)", ["Тест"]);
    const id = result.lastInsertId!;
    stack.pushCreated("new category", "categories", id);

    expect(await categoryExists(db, id)).toBe(true);

    await stack.undo();
    expect(await categoryExists(db, id)).toBe(false);

    await stack.redo();
    const [row] = await db.select<{ name: string }[]>("SELECT name FROM categories WHERE id = $1", [id]);
    expect(row.name).toBe("Тест");
  });

  it("undo/redo with nothing to undo returns null and doesn't throw", async () => {
    const stack = new UndoStack(createTestDb());
    expect(await stack.undo()).toBeNull();
    expect(await stack.redo()).toBeNull();
  });

  it("caps depth at 50 steps — the oldest pushes fall off", async () => {
    const db = createTestDb();
    const stack = new UndoStack(db);

    for (let i = 0; i < 55; i++) {
      await stack.run(`step ${i}`, RULES_SPEC, async () => {});
    }
    expect(stack.canUndo()).toBe(true);

    for (let i = 0; i < 50; i++) {
      expect(await stack.undo()).not.toBeNull();
    }
    expect(await stack.undo()).toBeNull();
  });

  it("withUndo() runs the mutation untracked when the stack is null", async () => {
    let ran = false;
    await withUndo(null, "label", RULES_SPEC, async () => {
      ran = true;
    });
    expect(ran).toBe(true);
  });
});

async function activeFlag(db: ReturnType<typeof createTestDb>) {
  const [row] = await db.select<{ is_active: number }[]>(
    "SELECT is_active FROM category_rules WHERE pattern = $1",
    ["foo"],
  );
  return row.is_active;
}

async function ruleCount(db: ReturnType<typeof createTestDb>) {
  const [{ n }] = await db.select<{ n: number }[]>("SELECT COUNT(*) AS n FROM category_rules");
  return n;
}

async function categoryExists(db: ReturnType<typeof createTestDb>, id: number) {
  const rows = await db.select<{ id: number }[]>("SELECT id FROM categories WHERE id = $1", [id]);
  return rows.length > 0;
}
