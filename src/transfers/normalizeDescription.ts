/**
 * Shared, deliberately simple text normalization for comparing two
 * operations' descriptions (SPEC-2.md 3.2: refund matching needs "похожее
 * описание (нормализованное)"). Just case/whitespace — no fuzzy matching —
 * since the real examples in samples/ (KOYEB, OZON) already share the exact
 * same description string once a bank splits one logical row into two
 * transactions. Revisit with something stronger only if real data shows a
 * need for it.
 */
export function normalizeDescription(description: string): string {
  return description.trim().toLowerCase().replace(/\s+/g, " ");
}
