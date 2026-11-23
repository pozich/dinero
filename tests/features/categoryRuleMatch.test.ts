import { describe, expect, it } from "vitest";
import {
  compileRule,
  findMatchingCategory,
  matchRule,
  type MatchableRule,
} from "../../src/features/operations/categoryRuleMatch";

function rule(partial: Partial<MatchableRule>): MatchableRule {
  return {
    pattern: "Сатти",
    case_sensitive: 0,
    category_id: 1,
    priority: 0,
    is_active: 1,
    ...partial,
  };
}

describe("matchRule", () => {
  it("matches a substring by default (regex without anchors)", () => {
    expect(matchRule("Сатти Маркет", rule({ pattern: "Сатти" }))).toBe(true);
    expect(matchRule("Avtobys", rule({ pattern: "Сатти" }))).toBe(false);
  });

  it("is case-insensitive unless case_sensitive is set", () => {
    expect(matchRule("САТТИ МАРКЕТ", rule({ pattern: "сатти", case_sensitive: 0 }))).toBe(true);
    expect(matchRule("САТТИ МАРКЕТ", rule({ pattern: "сатти", case_sensitive: 1 }))).toBe(false);
  });

  it("supports real regex syntax (alternation, anchors)", () => {
    expect(matchRule("Tele2", rule({ pattern: "^(Tele2|Kcell)$" }))).toBe(true);
    expect(matchRule("Tele2 top-up", rule({ pattern: "^(Tele2|Kcell)$" }))).toBe(false);
  });

  it("an invalid pattern never matches instead of throwing", () => {
    expect(compileRule(rule({ pattern: "(unterminated" }))).toBeNull();
    expect(matchRule("anything", rule({ pattern: "(unterminated" }))).toBe(false);
  });
});

describe("findMatchingCategory", () => {
  it("returns null when nothing matches", () => {
    expect(findMatchingCategory("Avtobys", [rule({ pattern: "Сатти" })])).toBeNull();
  });

  it("picks the lowest-priority (first) match when several rules match", () => {
    const rules = [
      rule({ pattern: "Маркет", category_id: 2, priority: 1 }),
      rule({ pattern: "Сатти", category_id: 1, priority: 0 }),
    ];
    expect(findMatchingCategory("Сатти Маркет", rules)).toBe(1);
  });

  it("skips inactive rules", () => {
    const rules = [rule({ pattern: "Сатти", category_id: 1, is_active: 0 })];
    expect(findMatchingCategory("Сатти Маркет", rules)).toBeNull();
  });
});
