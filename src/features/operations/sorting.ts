import type { SortColumn, SortSpec } from "../../db/transactionsQuery";

/** Clicking a column promotes it to top priority and cycles its direction
 * asc -> desc -> off; other active columns keep their relative order
 * (SPEC.md 8: "порядок иконок = приоритет; направление вверх/вниз/выкл"). */
export function toggleSort(current: SortSpec[], column: SortColumn): SortSpec[] {
  const existing = current.find((s) => s.column === column);
  const rest = current.filter((s) => s.column !== column);

  if (!existing) return [{ column, direction: "asc" }, ...rest];
  if (existing.direction === "asc") return [{ column, direction: "desc" }, ...rest];
  return rest;
}
