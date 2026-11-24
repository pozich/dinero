import { describe, expect, it } from "vitest";
import { groupLedgerRows, groupByCategoryTree } from "../../src/analytics/grouping";
import type { LedgerRow } from "../../src/db/ledgerQuery";
import type { Category } from "../../src/db/categories";

function row(partial: Partial<LedgerRow>): LedgerRow {
  return {
    splitId: 1,
    transactionId: 1,
    categoryId: null,
    amountTiyin: -1000,
    isInvestmentIncome: false,
    excluded: false,
    reason: null,
    occurredAt: "2026-01-15T00:00:00.000Z", // a Thursday
    accountId: 1,
    accountName: "Kaspi Gold",
    accountKind: "kaspi_gold",
    description: "Магазин",
    note: null,
    ...partial,
  };
}

function cat(partial: Partial<Category>): Category {
  return { id: 1, name: "x", parent_id: null, is_system: 0, color: null, icon: null, ...partial };
}

describe("groupLedgerRows", () => {
  it("excludes rows the ledger already marked excluded", () => {
    const rows = [row({ excluded: true, amountTiyin: -99999 }), row({})];
    const buckets = groupLedgerRows(rows, "account", []);
    expect(buckets).toHaveLength(1);
    expect(buckets[0].amountTiyin).toBe(-1000);
  });

  it("groups by account", () => {
    const rows = [
      row({ transactionId: 1, accountKind: "kaspi_gold", accountName: "Kaspi Gold", amountTiyin: -1000 }),
      row({ transactionId: 2, accountKind: "kaspi_gold", accountName: "Kaspi Gold", amountTiyin: -500 }),
      row({ transactionId: 3, accountKind: "halyk_salary", accountName: "Halyk", amountTiyin: -200 }),
    ];
    const buckets = groupLedgerRows(rows, "account", []);
    expect(buckets.find((b) => b.key === "kaspi_gold")?.amountTiyin).toBe(-1500);
    expect(buckets.find((b) => b.key === "halyk_salary")?.amountTiyin).toBe(-200);
  });

  it("groups by counterparty using the normalized description as the key, but keeps a readable label", () => {
    const rows = [
      row({ transactionId: 1, description: "  OZON.KZ  ", amountTiyin: -1000 }),
      row({ transactionId: 2, description: "ozon.kz", amountTiyin: -500 }),
    ];
    const buckets = groupLedgerRows(rows, "counterparty", []);
    expect(buckets).toHaveLength(1);
    expect(buckets[0].amountTiyin).toBe(-1500);
    expect(buckets[0].label).toBe("  OZON.KZ  "); // first-seen raw text
  });

  it("groups by weekday", () => {
    const rows = [row({ occurredAt: "2026-01-15T00:00:00.000Z" })]; // Thursday
    const buckets = groupLedgerRows(rows, "weekday", []);
    expect(buckets[0].label).toBe("Чт");
  });

  it("groups by month", () => {
    const rows = [row({ occurredAt: "2026-03-05T00:00:00.000Z" })];
    const buckets = groupLedgerRows(rows, "month", []);
    expect(buckets[0].key).toBe("2026-03");
  });

  it("falls back to «Без категории» for an unassigned category", () => {
    const rows = [row({ categoryId: null })];
    const buckets = groupLedgerRows(rows, "category", []);
    expect(buckets[0].label).toBe("Без категории");
  });

  it("shows a category's full parent/child path", () => {
    const categories = [cat({ id: 1, name: "Еда" }), cat({ id: 2, name: "Кафе", parent_id: 1 })];
    const rows = [row({ categoryId: 2 })];
    const buckets = groupLedgerRows(rows, "category", categories);
    expect(buckets[0].label).toBe("Еда / Кафе");
  });
});

describe("groupByCategoryTree", () => {
  it("rolls a child's amount up into its parent's total", () => {
    const categories = [cat({ id: 1, name: "Еда" }), cat({ id: 2, name: "Кафе", parent_id: 1 })];
    const rows = [row({ categoryId: 2, amountTiyin: -1000 })];

    const tree = groupByCategoryTree(rows, categories);
    const food = tree.find((n) => n.categoryId === 1)!;
    expect(food.amountTiyin).toBe(-1000);
    expect(food.ownAmountTiyin).toBe(0);
    expect(food.children[0].amountTiyin).toBe(-1000);
  });

  it("adds a separate «Без категории» bucket for uncategorized rows", () => {
    const rows = [row({ categoryId: null, amountTiyin: -300 })];
    const tree = groupByCategoryTree(rows, []);
    expect(tree.find((n) => n.categoryId === null)?.amountTiyin).toBe(-300);
  });
});
