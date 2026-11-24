/** Plain substring search, case-insensitive, over whatever the palette's
 * item list currently holds (actions/categories/operations) — Ctrl+K
 * (SPEC-2.md Ф4). Deterministic and simple, same principle as the rest of
 * the app: no fuzzy scoring to second-guess. */
export function searchPalette<T extends { label: string }>(items: readonly T[], query: string): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return items.slice(0, 20);
  return items.filter((i) => i.label.toLowerCase().includes(q)).slice(0, 20);
}
