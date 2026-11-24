import type { SortColumn } from "../../db/transactionsQuery";

export type ColumnConfig = { key: SortColumn; width: number; visible: boolean };

export const DEFAULT_COLUMNS: ColumnConfig[] = [
  { key: "occurred_at", width: 100, visible: true },
  { key: "amount_tiyin", width: 120, visible: true },
  { key: "description", width: 360, visible: true },
  { key: "category_name", width: 180, visible: true },
];

/** Moves the column at `fromIndex` to `toIndex`, keeping everything else in
 * order — used by column-header drag reordering. */
export function reorderColumns(columns: ColumnConfig[], fromIndex: number, toIndex: number): ColumnConfig[] {
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= columns.length || toIndex >= columns.length) {
    return columns;
  }
  const next = [...columns];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

export function resizeColumn(columns: ColumnConfig[], key: SortColumn, width: number): ColumnConfig[] {
  const clamped = Math.max(60, width);
  return columns.map((c) => (c.key === key ? { ...c, width: clamped } : c));
}

export function toggleColumnVisibility(columns: ColumnConfig[], key: SortColumn): ColumnConfig[] {
  return columns.map((c) => (c.key === key ? { ...c, visible: !c.visible } : c));
}

/** Merges a saved config with the current defaults — adding a new column
 * in code later shouldn't require every user to lose their saved layout,
 * and a column that no longer exists is dropped silently. */
export function mergeWithDefaults(saved: ColumnConfig[]): ColumnConfig[] {
  const byKey = new Map(saved.map((c) => [c.key, c]));
  return DEFAULT_COLUMNS.map((def) => byKey.get(def.key) ?? def);
}
