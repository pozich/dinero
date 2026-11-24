import type { DbClient } from "./types";

export async function renameCategory(db: DbClient, id: number, name: string): Promise<void> {
  await db.execute("UPDATE categories SET name = $1 WHERE id = $2", [name.trim(), id]);
}

export async function moveCategory(
  db: DbClient,
  id: number,
  newParentId: number | null,
): Promise<void> {
  if (newParentId === id) {
    throw new Error("Категория не может быть родителем самой себе");
  }
  await db.execute("UPDATE categories SET parent_id = $1 WHERE id = $2", [newParentId, id]);
}

export async function setCategoryAppearance(
  db: DbClient,
  id: number,
  patch: { color?: string | null; icon?: string | null },
): Promise<void> {
  if (patch.color !== undefined) {
    await db.execute("UPDATE categories SET color = $1 WHERE id = $2", [patch.color, id]);
  }
  if (patch.icon !== undefined) {
    await db.execute("UPDATE categories SET icon = $1 WHERE id = $2", [patch.icon, id]);
  }
}

async function requireNotSystem(db: DbClient, id: number, action: string): Promise<void> {
  const [row] = await db.select<{ is_system: number }[]>(
    "SELECT is_system FROM categories WHERE id = $1",
    [id],
  );
  if (row?.is_system) {
    throw new Error(`Системную категорию нельзя ${action}`);
  }
}

/** Reassigns every split, rule, and child category from `sourceId` to
 * `targetId`, then removes the now-empty source (SPEC-2.md 4.3). */
export async function mergeCategories(
  db: DbClient,
  sourceId: number,
  targetId: number,
): Promise<void> {
  if (sourceId === targetId) return;
  await requireNotSystem(db, sourceId, "слить с другой");

  await db.execute("UPDATE splits SET category_id = $1 WHERE category_id = $2", [
    targetId,
    sourceId,
  ]);
  await db.execute("UPDATE category_rules SET category_id = $1 WHERE category_id = $2", [
    targetId,
    sourceId,
  ]);
  await db.execute("UPDATE categories SET parent_id = $1 WHERE parent_id = $2", [
    targetId,
    sourceId,
  ]);
  await db.execute("DELETE FROM categories WHERE id = $1", [sourceId]);
}

/**
 * Deletes a category, reassigning its operations to `replacementId` (or
 * clearing them, when null — "без категории"). A rule's `category_id` is
 * NOT NULL, so with no replacement any rule pointing at this category is
 * removed outright rather than left dangling.
 */
export async function deleteCategory(
  db: DbClient,
  id: number,
  replacementId: number | null,
): Promise<void> {
  await requireNotSystem(db, id, "удалить");

  await db.execute("UPDATE splits SET category_id = $1 WHERE category_id = $2", [
    replacementId,
    id,
  ]);
  if (replacementId === null) {
    await db.execute("DELETE FROM category_rules WHERE category_id = $1", [id]);
  } else {
    await db.execute("UPDATE category_rules SET category_id = $1 WHERE category_id = $2", [
      replacementId,
      id,
    ]);
  }
  await db.execute("UPDATE categories SET parent_id = $1 WHERE parent_id = $2", [
    replacementId,
    id,
  ]);
  await db.execute("DELETE FROM categories WHERE id = $1", [id]);
}

export type CategoryCount = { category_id: number; count: number; total_tiyin: number };

/** One row per category that has at least one split — used for the
 * "сколько операций и на какую сумму" counters (SPEC-2.md 4.3). */
export function listCategoryCounts(db: DbClient): Promise<CategoryCount[]> {
  return db.select<CategoryCount[]>(
    `SELECT category_id, COUNT(*) AS count, SUM(amount_tiyin) AS total_tiyin
     FROM splits
     WHERE category_id IS NOT NULL
     GROUP BY category_id`,
  );
}
