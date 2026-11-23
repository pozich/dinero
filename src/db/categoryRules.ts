import type { DbClient } from "./types";

export type CategoryRule = {
  id: number;
  pattern: string;
  case_sensitive: number;
  category_id: number;
  category_name: string;
  priority: number;
  is_active: number;
};

export function listCategoryRules(db: DbClient): Promise<CategoryRule[]> {
  return db.select<CategoryRule[]>(
    `SELECT r.*, c.name AS category_name
     FROM category_rules r
     JOIN categories c ON c.id = r.category_id
     ORDER BY r.priority ASC`,
  );
}

export async function createCategoryRule(
  db: DbClient,
  input: { pattern: string; caseSensitive: boolean; categoryId: number },
): Promise<number> {
  const [{ maxPriority }] = await db.select<{ maxPriority: number | null }[]>(
    "SELECT MAX(priority) AS maxPriority FROM category_rules",
  );
  const priority = (maxPriority ?? -1) + 1;
  const result = await db.execute(
    "INSERT INTO category_rules (pattern, case_sensitive, category_id, priority) VALUES ($1, $2, $3, $4)",
    [input.pattern, input.caseSensitive ? 1 : 0, input.categoryId, priority],
  );
  return result.lastInsertId!;
}

export async function updateCategoryRule(
  db: DbClient,
  id: number,
  patch: { pattern?: string; caseSensitive?: boolean; categoryId?: number; isActive?: boolean },
): Promise<void> {
  if (patch.pattern !== undefined) {
    await db.execute("UPDATE category_rules SET pattern = $1 WHERE id = $2", [patch.pattern, id]);
  }
  if (patch.caseSensitive !== undefined) {
    await db.execute("UPDATE category_rules SET case_sensitive = $1 WHERE id = $2", [
      patch.caseSensitive ? 1 : 0,
      id,
    ]);
  }
  if (patch.categoryId !== undefined) {
    await db.execute("UPDATE category_rules SET category_id = $1 WHERE id = $2", [
      patch.categoryId,
      id,
    ]);
  }
  if (patch.isActive !== undefined) {
    await db.execute("UPDATE category_rules SET is_active = $1 WHERE id = $2", [
      patch.isActive ? 1 : 0,
      id,
    ]);
  }
}

export async function deleteCategoryRule(db: DbClient, id: number): Promise<void> {
  await db.execute("DELETE FROM category_rules WHERE id = $1", [id]);
}

/** Swaps priority with the immediate neighbour — used by the ↑/↓ reorder
 * buttons (first match wins, so order matters). */
export async function moveCategoryRule(
  db: DbClient,
  id: number,
  direction: "up" | "down",
): Promise<void> {
  const rules = await listCategoryRules(db);
  const index = rules.findIndex((r) => r.id === id);
  if (index === -1) return;
  const swapWith = direction === "up" ? index - 1 : index + 1;
  if (swapWith < 0 || swapWith >= rules.length) return;

  const a = rules[index];
  const b = rules[swapWith];
  await db.execute("UPDATE category_rules SET priority = $1 WHERE id = $2", [b.priority, a.id]);
  await db.execute("UPDATE category_rules SET priority = $1 WHERE id = $2", [a.priority, b.id]);
}
