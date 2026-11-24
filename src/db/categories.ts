import type { DbClient } from "./types";

export type Category = {
  id: number;
  name: string;
  parent_id: number | null;
  is_system: number;
  color: string | null;
  icon: string | null;
};

export function listCategories(db: DbClient): Promise<Category[]> {
  return db.select<Category[]>("SELECT * FROM categories ORDER BY name");
}

/** Создаётся прямо из поля ввода при категоризации (SPEC.md 6.4). */
export async function findOrCreateCategory(
  db: DbClient,
  name: string,
  parentId: number | null = null,
): Promise<number> {
  const trimmed = name.trim();
  const existing = await db.select<{ id: number }[]>(
    "SELECT id FROM categories WHERE name = $1 AND parent_id IS $2",
    [trimmed, parentId],
  );
  if (existing[0]) return existing[0].id;

  const result = await db.execute(
    "INSERT INTO categories (name, parent_id) VALUES ($1, $2)",
    [trimmed, parentId],
  );
  return result.lastInsertId!;
}
