import { describe, expect, it } from "vitest";
import {
  compileRule,
  findMatchingCategory,
  matchRule,
  testPattern,
  type MatchableRule,
  type MatchableTransaction,
} from "../../src/features/operations/categoryRuleMatch";

function rule(partial: Partial<MatchableRule>): MatchableRule {
  return {
    pattern: "Сатти",
    case_sensitive: 0,
    category_id: 1,
    priority: 0,
    is_active: 1,
    account_kinds: null,
    sign: null,
    min_amount_tiyin: null,
    max_amount_tiyin: null,
    ...partial,
  };
}

function tx(partial: Partial<MatchableTransaction>): MatchableTransaction {
  return {
    description: "Сатти Маркет",
    accountKind: "kaspi_gold",
    amountTiyin: -10000,
    ...partial,
  };
}

describe("testPattern (regex only — used by the rule editor's live tester)", () => {
  it("matches a substring by default (regex without anchors)", () => {
    expect(testPattern("Сатти Маркет", rule({ pattern: "Сатти" }))).toBe(true);
    expect(testPattern("Avtobys", rule({ pattern: "Сатти" }))).toBe(false);
  });

  it("is case-insensitive unless case_sensitive is set", () => {
    expect(testPattern("САТТИ МАРКЕТ", rule({ pattern: "сатти", case_sensitive: 0 }))).toBe(true);
    expect(testPattern("САТТИ МАРКЕТ", rule({ pattern: "сатти", case_sensitive: 1 }))).toBe(false);
  });

  it("supports real regex syntax (alternation, anchors)", () => {
    expect(testPattern("Tele2", rule({ pattern: "^(Tele2|Kcell)$" }))).toBe(true);
    expect(testPattern("Tele2 top-up", rule({ pattern: "^(Tele2|Kcell)$" }))).toBe(false);
  });

  it("an invalid pattern never matches instead of throwing", () => {
    expect(compileRule(rule({ pattern: "(unterminated" }))).toBeNull();
    expect(testPattern("anything", rule({ pattern: "(unterminated" }))).toBe(false);
  });
});

describe("matchRule (regex + optional account/sign/amount conditions, SPEC-2.md 4.4)", () => {
  it("matches on the regex alone when no extra conditions are set", () => {
    expect(matchRule(tx({}), rule({ pattern: "Сатти" }))).toBe(true);
  });

  it("account_kinds restricts which account the rule applies to", () => {
    const r = rule({ pattern: "Сатти", account_kinds: "kaspi_gold,halyk_salary" });
    expect(matchRule(tx({ accountKind: "kaspi_gold" }), r)).toBe(true);
    expect(matchRule(tx({ accountKind: "eurasian" }), r)).toBe(false);
  });

  it("sign restricts expense vs income", () => {
    const expenseOnly = rule({ pattern: "Сатти", sign: "expense" });
    expect(matchRule(tx({ amountTiyin: -10000 }), expenseOnly)).toBe(true);
    expect(matchRule(tx({ amountTiyin: 10000 }), expenseOnly)).toBe(false);
  });

  it("min/max amount compare against the absolute value", () => {
    const r = rule({ pattern: "Сатти", min_amount_tiyin: 5000, max_amount_tiyin: 20000 });
    expect(matchRule(tx({ amountTiyin: -10000 }), r)).toBe(true);
    expect(matchRule(tx({ amountTiyin: -1000 }), r)).toBe(false);
    expect(matchRule(tx({ amountTiyin: -50000 }), r)).toBe(false);
  });

  it("all conditions are ANDed with the regex", () => {
    const r = rule({
      pattern: "Сатти",
      account_kinds: "kaspi_gold",
      sign: "expense",
      min_amount_tiyin: 5000,
    });
    expect(matchRule(tx({ accountKind: "kaspi_gold", amountTiyin: -10000 }), r)).toBe(true);
    expect(matchRule(tx({ accountKind: "halyk_salary", amountTiyin: -10000 }), r)).toBe(false);
    expect(matchRule(tx({ accountKind: "kaspi_gold", amountTiyin: 10000 }), r)).toBe(false);
  });
});

describe("findMatchingCategory", () => {
  it("returns null when nothing matches", () => {
    expect(findMatchingCategory(tx({ description: "Avtobys" }), [rule({ pattern: "Сатти" })])).toBeNull();
  });

  it("picks the lowest-priority (first) match when several rules match", () => {
    const rules = [
      rule({ pattern: "Маркет", category_id: 2, priority: 1 }),
      rule({ pattern: "Сатти", category_id: 1, priority: 0 }),
    ];
    expect(findMatchingCategory(tx({}), rules)).toBe(1);
  });

  it("skips inactive rules", () => {
    const rules = [rule({ pattern: "Сатти", category_id: 1, is_active: 0 })];
    expect(findMatchingCategory(tx({}), rules)).toBeNull();
  });
});
