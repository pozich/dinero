import { describe, expect, it } from "vitest";
import { buildCsv } from "../../src/export/exportCsv";
import type { TransactionListItem } from "../../src/db/transactionsQuery";
import type { Category } from "../../src/db/categories";

function row(partial: Partial<TransactionListItem>): TransactionListItem {
  return {
    id: 1,
    account_id: 1,
    account_name: "Kaspi Gold",
    account_kind: "kaspi_gold",
    occurred_at: "2026-10-25T00:00:00.000Z",
    amount_tiyin: -150000,
    description: "Сатти Маркет",
    category_id: null,
    category_name: null,
    split_count: 0,
    is_manual: 0,
    is_ignored: 0,
    note: null,
    ...partial,
  };
}

function category(partial: Partial<Category>): Category {
  return { id: 1, name: "x", parent_id: null, is_system: 0, color: null, icon: null, ...partial };
}

describe("buildCsv", () => {
  it("has the expected header", () => {
    const csv = buildCsv([], []);
    expect(csv).toBe("Дата,Счёт,Сумма,Описание,Категория,Заметка,Флаги");
  });

  it("formats a plain row", () => {
    const csv = buildCsv([row({})], []);
    const lines = csv.split("\r\n");
    expect(lines[1]).toBe("2026-10-25,Kaspi Gold,-1500.00,Сатти Маркет,,,");
  });

  it("joins a category's full parent/child path", () => {
    const parent = category({ id: 1, name: "Еда" });
    const child = category({ id: 2, name: "Кафе", parent_id: 1 });
    const csv = buildCsv([row({ category_id: 2 })], [parent, child]);
    expect(csv.split("\r\n")[1]).toContain("Еда / Кафе");
  });

  it("lists active flags, joined with semicolons", () => {
    const csv = buildCsv([row({ is_manual: 1, is_ignored: 1 })], []);
    expect(csv.split("\r\n")[1].endsWith("ручная; не учитывать")).toBe(true);
  });

  it("quotes a description containing a comma", () => {
    const csv = buildCsv([row({ description: "Кофе, чай" })], []);
    expect(csv.split("\r\n")[1]).toContain('"Кофе, чай"');
  });

  it("escapes a quote inside a description by doubling it", () => {
    const csv = buildCsv([row({ description: 'Магазин "Люкс"' })], []);
    expect(csv.split("\r\n")[1]).toContain('"Магазин ""Люкс"""');
  });
});
