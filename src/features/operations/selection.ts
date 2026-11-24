/**
 * Pure multi-select logic for the operations table (SPEC-2.md Ф4): click
 * replaces the selection with just that row, Shift+click extends a range
 * from the last anchor, Ctrl+click toggles one row in or out, Ctrl+A
 * selects everything currently visible.
 */
export function selectSingle(id: number): Set<number> {
  return new Set([id]);
}

export function toggleSelection(selected: Set<number>, id: number): Set<number> {
  const next = new Set(selected);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

export function selectRange<T extends { id: number }>(
  rows: readonly T[],
  anchorId: number,
  clickedId: number,
): Set<number> {
  const anchorIndex = rows.findIndex((r) => r.id === anchorId);
  const clickedIndex = rows.findIndex((r) => r.id === clickedId);
  if (anchorIndex === -1 || clickedIndex === -1) {
    return new Set([clickedId]);
  }
  const [start, end] =
    anchorIndex <= clickedIndex ? [anchorIndex, clickedIndex] : [clickedIndex, anchorIndex];
  return new Set(rows.slice(start, end + 1).map((r) => r.id));
}

export function selectAll<T extends { id: number }>(rows: readonly T[]): Set<number> {
  return new Set(rows.map((r) => r.id));
}
