import { describe, expect, it } from "vitest";
import { isInvestmentCategory } from "../../src/ledger/isInvestmentCategory";
import type { Category } from "../../src/db/categories";

function cat(partial: Partial<Category>): Category {
  return { id: 1, name: "x", parent_id: null, is_system: 0, color: null, icon: null, ...partial };
}

describe("isInvestmentCategory", () => {
  const categories = [
    cat({ id: 1, name: "Инвестиции", is_system: 1 }),
    cat({ id: 2, name: "Акции KASE", parent_id: 1 }),
    cat({ id: 3, name: "Еда" }),
  ];

  it("is true for the system category itself", () => {
    expect(isInvestmentCategory(1, categories)).toBe(true);
  });

  it("is true for a descendant of it", () => {
    expect(isInvestmentCategory(2, categories)).toBe(true);
  });

  it("is false for an unrelated category", () => {
    expect(isInvestmentCategory(3, categories)).toBe(false);
  });

  it("is false for null (no category yet)", () => {
    expect(isInvestmentCategory(null, categories)).toBe(false);
  });

  it("is false when the system category doesn't exist at all", () => {
    expect(isInvestmentCategory(3, [cat({ id: 3, name: "Еда" })])).toBe(false);
  });
});
