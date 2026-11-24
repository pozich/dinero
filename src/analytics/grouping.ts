import type { LedgerRow } from "../db/ledgerQuery";
import type { Category } from "../db/categories";
import { normalizeDescription } from "../transfers/normalizeDescription";
import { buildCategoryTree, type TreeNode } from "../features/categories/buildCategoryTree";

export type GroupMode = "category" | "account" | "counterparty" | "weekday" | "month";

export type GroupBucket = {
  key: string;
  label: string;
  amountTiyin: number;
  transactionIds: number[];
};

const WEEKDAY_LABELS = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];

function categoryPath(categoryId: number | null, byId: Map<number, Category>): string {
  if (categoryId === null) return "Без категории";
  const parts: string[] = [];
  let current = byId.get(categoryId);
  while (current) {
    parts.unshift(current.name);
    current = current.parent_id !== null ? byId.get(current.parent_id) : undefined;
  }
  return parts.length > 0 ? parts.join(" / ") : "Без категории";
}

/** Flat grouping for charts that don't need tree structure (bar/line/
 * donut/sankey endpoints/heatmap) — SPEC-2.md 6.3. Counterparty groups by
 * the same normalized text refund-matching already uses, so minor
 * whitespace/case differences collapse into one bucket, but displays the
 * first-seen raw description (more readable than the normalized form). */
export function groupLedgerRows(
  rows: readonly LedgerRow[],
  mode: GroupMode,
  categories: readonly Category[],
): GroupBucket[] {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const buckets = new Map<string, GroupBucket>();

  for (const row of rows) {
    if (row.excluded) continue;

    let key: string;
    let label: string;
    if (mode === "category") {
      key = row.categoryId === null ? "none" : String(row.categoryId);
      label = categoryPath(row.categoryId, byId);
    } else if (mode === "account") {
      key = row.accountKind;
      label = row.accountName;
    } else if (mode === "counterparty") {
      key = normalizeDescription(row.description);
      label = row.description;
    } else if (mode === "weekday") {
      const day = new Date(row.occurredAt).getUTCDay();
      key = String(day);
      label = WEEKDAY_LABELS[day];
    } else {
      key = row.occurredAt.slice(0, 7);
      label = key;
    }

    const existing = buckets.get(key);
    if (existing) {
      existing.amountTiyin += row.amountTiyin;
      existing.transactionIds.push(row.transactionId);
    } else {
      buckets.set(key, { key, label, amountTiyin: row.amountTiyin, transactionIds: [row.transactionId] });
    }
  }

  return [...buckets.values()];
}

export type CategoryTreeBucket = {
  categoryId: number | null;
  name: string;
  /** This category's own rows plus every descendant's — what a treemap/
   * sankey node should show. */
  amountTiyin: number;
  ownAmountTiyin: number;
  transactionIds: number[];
  children: CategoryTreeBucket[];
};

/** "Категории (с раскрытием дерева)" (SPEC-2.md 6.3) — parent totals roll
 * up every descendant's amount, the way a treemap needs them. */
export function groupByCategoryTree(
  rows: readonly LedgerRow[],
  categories: readonly Category[],
): CategoryTreeBucket[] {
  const tree = buildCategoryTree(categories);
  const own = new Map<number, { amount: number; ids: number[] }>();
  let noneAmount = 0;
  const noneIds: number[] = [];

  for (const row of rows) {
    if (row.excluded) continue;
    if (row.categoryId === null) {
      noneAmount += row.amountTiyin;
      noneIds.push(row.transactionId);
      continue;
    }
    const entry = own.get(row.categoryId) ?? { amount: 0, ids: [] };
    entry.amount += row.amountTiyin;
    entry.ids.push(row.transactionId);
    own.set(row.categoryId, entry);
  }

  function build(node: TreeNode): CategoryTreeBucket {
    const entry = own.get(node.id) ?? { amount: 0, ids: [] };
    const children = node.children.map(build);
    const amountTiyin = entry.amount + children.reduce((sum, c) => sum + c.amountTiyin, 0);
    return {
      categoryId: node.id,
      name: node.name,
      amountTiyin,
      ownAmountTiyin: entry.amount,
      transactionIds: entry.ids,
      children,
    };
  }

  const buckets = tree.map(build);
  if (noneAmount !== 0 || noneIds.length > 0) {
    buckets.push({
      categoryId: null,
      name: "Без категории",
      amountTiyin: noneAmount,
      ownAmountTiyin: noneAmount,
      transactionIds: noneIds,
      children: [],
    });
  }
  return buckets;
}
