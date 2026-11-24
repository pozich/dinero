import type { DbClient } from "./types";

export type RuleSign = "income" | "expense";

export type CategoryRule = {
  id: number;
  pattern: string;
  case_sensitive: number;
  category_id: number;
  category_name: string;
  priority: number;
  is_active: number;
  account_kinds: string | null;
  sign: RuleSign | null;
  min_amount_tiyin: number | null;
  max_amount_tiyin: number | null;
};

export type RuleConditionsInput = {
  accountKinds?: string[];
  sign?: RuleSign | null;
  minAmountTiyin?: number | null;
  maxAmountTiyin?: number | null;
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
  input: { pattern: string; caseSensitive: boolean; categoryId: number } & RuleConditionsInput,
): Promise<number> {
  const [{ maxPriority }] = await db.select<{ maxPriority: number | null }[]>(
    "SELECT MAX(priority) AS maxPriority FROM category_rules",
  );
  const priority = (maxPriority ?? -1) + 1;
  const result = await db.execute(
    `INSERT INTO category_rules
       (pattern, case_sensitive, category_id, priority, account_kinds, sign, min_amount_tiyin, max_amount_tiyin)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      input.pattern,
      input.caseSensitive ? 1 : 0,
      input.categoryId,
      priority,
      input.accountKinds && input.accountKinds.length > 0 ? input.accountKinds.join(",") : null,
      input.sign ?? null,
      input.minAmountTiyin ?? null,
      input.maxAmountTiyin ?? null,
    ],
  );
  return result.lastInsertId!;
}

export async function updateCategoryRule(
  db: DbClient,
  id: number,
  patch: {
    pattern?: string;
    caseSensitive?: boolean;
    categoryId?: number;
    isActive?: boolean;
  } & RuleConditionsInput,
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
  if (patch.accountKinds !== undefined) {
    await db.execute("UPDATE category_rules SET account_kinds = $1 WHERE id = $2", [
      patch.accountKinds.length > 0 ? patch.accountKinds.join(",") : null,
      id,
    ]);
  }
  if (patch.sign !== undefined) {
    await db.execute("UPDATE category_rules SET sign = $1 WHERE id = $2", [patch.sign, id]);
  }
  if (patch.minAmountTiyin !== undefined) {
    await db.execute("UPDATE category_rules SET min_amount_tiyin = $1 WHERE id = $2", [
      patch.minAmountTiyin,
      id,
    ]);
  }
  if (patch.maxAmountTiyin !== undefined) {
    await db.execute("UPDATE category_rules SET max_amount_tiyin = $1 WHERE id = $2", [
      patch.maxAmountTiyin,
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
