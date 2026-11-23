import type { DbClient } from "./types";

export type TransactionListItem = {
  id: number;
  account_id: number;
  account_name: string;
  occurred_at: string;
  amount_tiyin: number;
  description: string;
  category_id: number | null;
  category_name: string | null;
  split_count: number;
  is_manual: number;
  is_ignored: number;
  note: string | null;
};

export type TransactionFilters = {
  search?: string;
  exactDescription?: string;
  excludeId?: number;
  accountId?: number;
  onlyUncategorized?: boolean;
  periodStart?: string;
  periodEnd?: string;
  ids?: number[];
};

export type SortColumn = "occurred_at" | "amount_tiyin" | "description" | "category_name";
export type SortSpec = { column: SortColumn; direction: "asc" | "desc" };

const SORT_EXPR: Record<SortColumn, string> = {
  occurred_at: "t.occurred_at",
  amount_tiyin: "t.amount_tiyin",
  description: "t.description",
  category_name: "category_name",
};

export function buildTransactionsQuery(
  filters: TransactionFilters,
  sort: SortSpec[],
): { sql: string; params: unknown[] } {
  const where: string[] = [];
  const having: string[] = [];
  const params: unknown[] = [];

  if (filters.search) {
    // Pushed twice rather than reusing one $N index twice — the test
    // harness's placeholder translator (tests/testDb.ts) treats each `$N`
    // occurrence as consuming its own positional value, unlike sqlx's real
    // SQLite backend which would happily rebind the same index.
    params.push(`%${filters.search}%`);
    const descriptionIndex = params.length;
    params.push(`%${filters.search}%`);
    const noteIndex = params.length;
    where.push(`(t.description LIKE $${descriptionIndex} OR t.note LIKE $${noteIndex})`);
  }
  if (filters.exactDescription !== undefined) {
    params.push(filters.exactDescription);
    where.push(`t.description = $${params.length}`);
  }
  if (filters.excludeId !== undefined) {
    params.push(filters.excludeId);
    where.push(`t.id != $${params.length}`);
  }
  if (filters.accountId !== undefined) {
    params.push(filters.accountId);
    where.push(`t.account_id = $${params.length}`);
  }
  if (filters.periodStart) {
    params.push(filters.periodStart);
    where.push(`t.occurred_at >= $${params.length}`);
  }
  if (filters.periodEnd) {
    params.push(filters.periodEnd);
    where.push(`t.occurred_at <= $${params.length}`);
  }
  if (filters.onlyUncategorized) {
    having.push("COUNT(s.id) = 0");
  }
  if (filters.ids !== undefined) {
    if (filters.ids.length === 0) {
      where.push("0 = 1");
    } else {
      const placeholders = filters.ids.map((id) => {
        params.push(id);
        return `$${params.length}`;
      });
      where.push(`t.id IN (${placeholders.join(", ")})`);
    }
  }

  const orderBy =
    sort.length > 0
      ? sort.map((s) => `${SORT_EXPR[s.column]} ${s.direction.toUpperCase()}`).join(", ")
      : "t.occurred_at DESC";

  const sql = `
    SELECT
      t.id, t.account_id, a.name AS account_name, t.occurred_at, t.amount_tiyin, t.description,
      t.is_manual, t.is_ignored, t.note,
      MIN(s.category_id) AS category_id,
      MIN(c.name) AS category_name,
      COUNT(s.id) AS split_count
    FROM transactions t
    JOIN accounts a ON a.id = t.account_id
    LEFT JOIN splits s ON s.transaction_id = t.id
    LEFT JOIN categories c ON c.id = s.category_id
    ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
    GROUP BY t.id
    ${having.length ? `HAVING ${having.join(" AND ")}` : ""}
    ORDER BY ${orderBy}
  `;

  return { sql, params };
}

export function queryTransactions(
  db: DbClient,
  filters: TransactionFilters = {},
  sort: SortSpec[] = [],
): Promise<TransactionListItem[]> {
  const { sql, params } = buildTransactionsQuery(filters, sort);
  return db.select<TransactionListItem[]>(sql, params);
}
