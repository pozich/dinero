import { describe, expect, it } from "vitest";
import { matchesGoalRule, type GoalRule } from "../../src/goals/matchGoalRule";

function rule(partial: Partial<GoalRule>): GoalRule {
  return { accountKind: null, sign: null, minAmountTiyin: null, maxAmountTiyin: null, ...partial };
}

describe("matchesGoalRule", () => {
  it("matches anything when no conditions are set", () => {
    expect(matchesGoalRule(rule({}), { accountKind: "cash", amountTiyin: 1 })).toBe(true);
  });

  it("filters by account kind", () => {
    const r = rule({ accountKind: "kaspi_deposit" });
    expect(matchesGoalRule(r, { accountKind: "kaspi_deposit", amountTiyin: 1000 })).toBe(true);
    expect(matchesGoalRule(r, { accountKind: "cash", amountTiyin: 1000 })).toBe(false);
  });

  it("filters by sign", () => {
    expect(matchesGoalRule(rule({ sign: "income" }), { accountKind: "x", amountTiyin: 500 })).toBe(true);
    expect(matchesGoalRule(rule({ sign: "income" }), { accountKind: "x", amountTiyin: -500 })).toBe(false);
    expect(matchesGoalRule(rule({ sign: "expense" }), { accountKind: "x", amountTiyin: -500 })).toBe(true);
  });

  it("filters by absolute amount range", () => {
    const r = rule({ minAmountTiyin: 1000, maxAmountTiyin: 5000 });
    expect(matchesGoalRule(r, { accountKind: "x", amountTiyin: -2000 })).toBe(true);
    expect(matchesGoalRule(r, { accountKind: "x", amountTiyin: -500 })).toBe(false);
    expect(matchesGoalRule(r, { accountKind: "x", amountTiyin: 9000 })).toBe(false);
  });

  it("ANDs every condition together", () => {
    const r = rule({ accountKind: "kaspi_deposit", sign: "income", minAmountTiyin: 1000 });
    expect(matchesGoalRule(r, { accountKind: "kaspi_deposit", amountTiyin: 2000 })).toBe(true);
    expect(matchesGoalRule(r, { accountKind: "kaspi_deposit", amountTiyin: 500 })).toBe(false);
    expect(matchesGoalRule(r, { accountKind: "cash", amountTiyin: 2000 })).toBe(false);
  });
});
