import type { Category } from "../db/categories";

/** True if `categoryId` is the system "Инвестиции" category or anywhere in
 * its subtree — the ledger module excludes these from income/expense
 * (SPEC-2.md раздел 1), except dividends, which carry their own
 * `is_investment_income` flag checked separately. */
export function isInvestmentCategory(
  categoryId: number | null,
  categories: readonly Category[],
): boolean {
  if (categoryId === null) return false;
  const investmentRoot = categories.find((c) => c.is_system && c.name === "Инвестиции");
  if (!investmentRoot) return false;

  const byId = new Map(categories.map((c) => [c.id, c]));
  let current = byId.get(categoryId);
  while (current) {
    if (current.id === investmentRoot.id) return true;
    current = current.parent_id !== null ? byId.get(current.parent_id) : undefined;
  }
  return false;
}
