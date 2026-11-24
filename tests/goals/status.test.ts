import { describe, expect, it } from "vitest";
import { computeGoalStatusLabel } from "../../src/goals/status";
import type { GoalPlan } from "../../src/goals/calculator";

describe("computeGoalStatusLabel", () => {
  it("is 'achieved' regardless of pace", () => {
    expect(computeGoalStatusLabel({ kind: "achieved" }, 0)).toBe("achieved");
  });

  it("is 'overdue' for a passed deadline", () => {
    expect(computeGoalStatusLabel({ kind: "deadlinePassed", remainingTiyin: 1000 }, 0)).toBe("overdue");
  });

  it("is 'noDeadline' when there's no deadline to compare against", () => {
    const plan: GoalPlan = { kind: "atCurrentPace", remainingTiyin: 1000, projectedDate: null };
    expect(computeGoalStatusLabel(plan, 0)).toBe("noDeadline");
  });

  it("is 'onTrack' when the actual pace matches what's needed", () => {
    const plan: GoalPlan = { kind: "byDeadline", remainingTiyin: 100000, monthsRemaining: 10, monthlyNeededTiyin: 10000 };
    expect(computeGoalStatusLabel(plan, 10000)).toBe("onTrack");
  });

  it("is 'ahead' when contributing meaningfully faster than needed", () => {
    const plan: GoalPlan = { kind: "byDeadline", remainingTiyin: 100000, monthsRemaining: 10, monthlyNeededTiyin: 10000 };
    expect(computeGoalStatusLabel(plan, 20000)).toBe("ahead");
  });

  it("is 'behind' when contributing meaningfully slower than needed", () => {
    const plan: GoalPlan = { kind: "byDeadline", remainingTiyin: 100000, monthsRemaining: 10, monthlyNeededTiyin: 10000 };
    expect(computeGoalStatusLabel(plan, 2000)).toBe("behind");
  });
});
