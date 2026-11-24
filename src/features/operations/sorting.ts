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

/** Shift+click (SPEC-2.md Ф4): adds/cycles a column as a *secondary* sort
 * without disturbing the priority of the others — the opposite of
 * `toggleSort`, which always promotes the clicked column to the front. */
export function addSecondarySort(current: SortSpec[], column: SortColumn): SortSpec[] {
  const index = current.findIndex((s) => s.column === column);
  if (index === -1) return [...current, { column, direction: "asc" }];
  if (current[index].direction === "asc") {
    return current.map((s, i) => (i === index ? { ...s, direction: "desc" } : s));
  }
  return current.filter((s) => s.column !== column);
}
