import type { TransactionListItem } from "../db/transactionsQuery";
import type { Category } from "../db/categories";

function csvField(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function categoryPath(categoryId: number | null, byId: Map<number, Category>): string {
  if (categoryId === null) return "";
  const parts: string[] = [];
  let current = byId.get(categoryId);
  while (current) {
    parts.unshift(current.name);
    current = current.parent_id !== null ? byId.get(current.parent_id) : undefined;
  }
  return parts.join(" / ");
}

const HEADER = ["Дата", "Счёт", "Сумма", "Описание", "Категория", "Заметка", "Флаги"];

/**
 * SPEC-2.md 4.5: date/account/amount/description/category (full path,
 * parent/child joined with " / ")/note/flags. `rows` is whatever the
 * caller already filtered — "all operations" and "current view" are the
 * same export, just with different filters applied beforehand.
 */
export function buildCsv(rows: TransactionListItem[], categories: Category[]): string {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const lines = [HEADER.map(csvField).join(",")];

  for (const row of rows) {
    const flags = [row.is_manual ? "ручная" : null, row.is_ignored ? "не учитывать" : null]
      .filter((f): f is string => !!f)
      .join("; ");
    const fields = [
      row.occurred_at.slice(0, 10),
      row.account_name,
      (row.amount_tiyin / 100).toFixed(2),
      row.description,
      categoryPath(row.category_id, byId),
      row.note ?? "",
      flags,
    ];
    lines.push(fields.map((f) => csvField(String(f))).join(","));
  }

  return lines.join("\r\n");
}
