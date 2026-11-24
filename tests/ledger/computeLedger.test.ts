import { describe, expect, it } from "vitest";
import {
  computeLedger,
  type LedgerLink,
  type LedgerSplit,
  type LedgerTransaction,
} from "../../src/ledger/computeLedger";
import type { Category } from "../../src/db/categories";

function tx(partial: Partial<LedgerTransaction>): LedgerTransaction {
  return {
    id: 1,
    accountKind: "kaspi_gold",
    accountIsTransit: false,
    amountTiyin: -10000,
    isIgnored: false,
    isInvestmentIncome: false,
    ...partial,
  };
}

function split(partial: Partial<LedgerSplit>): LedgerSplit {
  return { id: 1, transactionId: 1, categoryId: 10, amountTiyin: -10000, ...partial };
}

function cat(partial: Partial<Category>): Category {
  return { id: 10, name: "Еда", parent_id: null, is_system: 0, color: null, icon: null, ...partial };
}

const FOOD_CATEGORY = cat({});
const INVESTMENT_ROOT = cat({ id: 1, name: "Инвестиции", is_system: 1 });

describe("computeLedger", () => {
  it("counts an ordinary expense in full", () => {
    const entries = computeLedger([tx({})], [split({})], [], [FOOD_CATEGORY]);
    expect(entries).toEqual([
      { splitId: 1, transactionId: 1, categoryId: 10, amountTiyin: -10000, isInvestmentIncome: false, excluded: false, reason: null },
    ]);
  });

  it("excludes a transit-account split entirely", () => {
    const entries = computeLedger(
      [tx({ accountIsTransit: true })],
      [split({})],
      [],
      [FOOD_CATEGORY],
    );
    expect(entries[0]).toMatchObject({ excluded: true, reason: "transit", amountTiyin: 0 });
  });

  it("excludes a split marked «не учитывать»", () => {
    const entries = computeLedger([tx({ isIgnored: true })], [split({})], [], [FOOD_CATEGORY]);
    expect(entries[0]).toMatchObject({ excluded: true, reason: "ignored", amountTiyin: 0 });
  });

  it("excludes both sides of a confirmed transfer", () => {
    const transactions = [tx({ id: 1, amountTiyin: -5000 }), tx({ id: 2, amountTiyin: 5000 })];
    const splits = [split({ id: 1, transactionId: 1, amountTiyin: -5000 }), split({ id: 2, transactionId: 2, amountTiyin: 5000 })];
    const links: LedgerLink[] = [{ kind: "transfer", fromTransactionId: 1, toTransactionId: 2 }];

    const entries = computeLedger(transactions, splits, links, [FOOD_CATEGORY]);
    expect(entries.every((e) => e.excluded && e.reason === "transfer")).toBe(true);
  });

  it("a full refund excludes both the purchase and the refund", () => {
    const transactions = [tx({ id: 1, amountTiyin: -1000 }), tx({ id: 2, amountTiyin: 1000 })];
    const splits = [split({ id: 1, transactionId: 1, amountTiyin: -1000 }), split({ id: 2, transactionId: 2, amountTiyin: 1000 })];
    const links: LedgerLink[] = [{ kind: "refund", fromTransactionId: 1, toTransactionId: 2 }];

    const entries = computeLedger(transactions, splits, links, [FOOD_CATEGORY]);
    expect(entries.every((e) => e.excluded && e.reason === "refund")).toBe(true);
  });

  it("a partial refund leaves only the uncovered difference as an expense", () => {
    const transactions = [tx({ id: 1, amountTiyin: -1000 }), tx({ id: 2, amountTiyin: 300 })];
    const splits = [split({ id: 1, transactionId: 1, amountTiyin: -1000 }), split({ id: 2, transactionId: 2, amountTiyin: 300 })];
    const links: LedgerLink[] = [{ kind: "refund", fromTransactionId: 1, toTransactionId: 2 }];

    const entries = computeLedger(transactions, splits, links, [FOOD_CATEGORY]);
    const purchaseEntry = entries.find((e) => e.transactionId === 1)!;
    const refundEntry = entries.find((e) => e.transactionId === 2)!;

    expect(purchaseEntry).toMatchObject({ excluded: false, amountTiyin: -700 });
    expect(refundEntry).toMatchObject({ excluded: true, reason: "refund" });
  });

  it("a partial refund on a transaction split across two categories scales both proportionally (раздел 1's explicit combo case)", () => {
    const transactions = [tx({ id: 1, amountTiyin: -1000 }), tx({ id: 2, amountTiyin: 400 })];
    // split 60/40 between two categories
    const splits = [
      split({ id: 1, transactionId: 1, categoryId: 10, amountTiyin: -600 }),
      split({ id: 2, transactionId: 1, categoryId: 20, amountTiyin: -400 }),
      split({ id: 3, transactionId: 2, categoryId: 10, amountTiyin: 400 }),
    ];
    const links: LedgerLink[] = [{ kind: "refund", fromTransactionId: 1, toTransactionId: 2 }];
    const categories = [FOOD_CATEGORY, cat({ id: 20, name: "Транспорт" })];

    const entries = computeLedger(transactions, splits, links, categories);
    // net factor = (-1000 + 400) / -1000 = 0.6 -> each split scaled by 0.6
    expect(entries.find((e) => e.splitId === 1)).toMatchObject({ amountTiyin: -360, excluded: false });
    expect(entries.find((e) => e.splitId === 2)).toMatchObject({ amountTiyin: -240, excluded: false });
    expect(entries.find((e) => e.splitId === 3)).toMatchObject({ excluded: true, reason: "refund" });
  });

  it("excludes an «Инвестиции» category split that isn't flagged as investment income", () => {
    const entries = computeLedger(
      [tx({})],
      [split({ categoryId: 1 })],
      [],
      [INVESTMENT_ROOT],
    );
    expect(entries[0]).toMatchObject({ excluded: true, reason: "investment", amountTiyin: 0 });
  });

  it("counts a dividend (Инвестиции category + isInvestmentIncome) and flags it", () => {
    const entries = computeLedger(
      [tx({ amountTiyin: 5000, isInvestmentIncome: true })],
      [split({ categoryId: 1, amountTiyin: 5000 })],
      [],
      [INVESTMENT_ROOT],
    );
    expect(entries[0]).toMatchObject({ excluded: false, amountTiyin: 5000, isInvestmentIncome: true });
  });

  it("excludes a debt's own transaction, and its repayments, from income/expense (Ф7's done-criterion)", () => {
    // Выдача 5000 -> возврат 2000 -> возврат 3000: none of the three count.
    const transactions = [
      tx({ id: 1, amountTiyin: -500000 }), // lent
      tx({ id: 2, amountTiyin: 200000 }), // repayment 1
      tx({ id: 3, amountTiyin: 300000 }), // repayment 2
    ];
    const splits = [
      split({ id: 1, transactionId: 1, amountTiyin: -500000 }),
      split({ id: 2, transactionId: 2, amountTiyin: 200000 }),
      split({ id: 3, transactionId: 3, amountTiyin: 300000 }),
    ];
    const debtTransactionIds = new Set([1, 2, 3]);

    const entries = computeLedger(transactions, splits, [], [FOOD_CATEGORY], debtTransactionIds);
    expect(entries).toEqual([
      { splitId: 1, transactionId: 1, categoryId: 10, amountTiyin: 0, isInvestmentIncome: false, excluded: true, reason: "debt" },
      { splitId: 2, transactionId: 2, categoryId: 10, amountTiyin: 0, isInvestmentIncome: false, excluded: true, reason: "debt" },
      { splitId: 3, transactionId: 3, categoryId: 10, amountTiyin: 0, isInvestmentIncome: false, excluded: true, reason: "debt" },
    ]);
  });

  it("doesn't exclude an ordinary transaction just because some other transaction is a debt", () => {
    const entries = computeLedger([tx({ id: 1 })], [split({ transactionId: 1 })], [], [FOOD_CATEGORY], new Set([999]));
    expect(entries[0]).toMatchObject({ excluded: false });
  });
});
