import { describe, expect, it } from "vitest";
import {
  computeGoalPlan,
  computeWhyBreakdown,
  monthlyToProjectedDate,
  dateToRequiredMonthly,
  type GoalProgress,
} from "../../src/goals/calculator";

const NOW = new Date("2026-01-01T00:00:00.000Z");

describe("computeGoalPlan", () => {
  it("is 'achieved' once current meets or exceeds the target", () => {
    const progress: GoalProgress = { targetTiyin: 100000, currentTiyin: 100000, deadline: null, monthlyContributionTiyin: 0 };
    expect(computeGoalPlan(progress, NOW)).toEqual({ kind: "achieved" });
  });

  it("is 'achieved' when current overshoots the target", () => {
    const progress: GoalProgress = { targetTiyin: 100000, currentTiyin: 150000, deadline: null, monthlyContributionTiyin: 0 };
    expect(computeGoalPlan(progress, NOW)).toEqual({ kind: "achieved" });
  });

  it("flags a deadline already in the past", () => {
    const progress: GoalProgress = {
      targetTiyin: 100000,
      currentTiyin: 0,
      deadline: "2025-01-01T00:00:00.000Z",
      monthlyContributionTiyin: 1000,
    };
    expect(computeGoalPlan(progress, NOW)).toEqual({ kind: "deadlinePassed", remainingTiyin: 100000 });
  });

  it("computes the monthly amount needed for a future deadline", () => {
    const progress: GoalProgress = {
      targetTiyin: 1200000,
      currentTiyin: 0,
      deadline: "2027-01-01T00:00:00.000Z", // ~12 months out
      monthlyContributionTiyin: 0,
    };
    const plan = computeGoalPlan(progress, NOW);
    expect(plan.kind).toBe("byDeadline");
    if (plan.kind === "byDeadline") {
      expect(plan.monthlyNeededTiyin).toBeGreaterThan(90000);
      expect(plan.monthlyNeededTiyin).toBeLessThan(105000);
    }
  });

  it("needs a smaller monthly amount when the goal earns deposit interest", () => {
    const base: GoalProgress = { targetTiyin: 1200000, currentTiyin: 0, deadline: "2027-01-01T00:00:00.000Z", monthlyContributionTiyin: 0 };
    const withoutInterest = computeGoalPlan(base, NOW);
    const withInterest = computeGoalPlan({ ...base, annualDepositRatePercent: 14 }, NOW);
    expect(withInterest.kind).toBe("byDeadline");
    expect(withoutInterest.kind).toBe("byDeadline");
    if (withInterest.kind === "byDeadline" && withoutInterest.kind === "byDeadline") {
      expect(withInterest.monthlyNeededTiyin).toBeLessThan(withoutInterest.monthlyNeededTiyin);
    }
  });

  it("projects a date at the current pace when there's no deadline", () => {
    const progress: GoalProgress = { targetTiyin: 1200000, currentTiyin: 0, deadline: null, monthlyContributionTiyin: 100000 };
    const plan = computeGoalPlan(progress, NOW);
    expect(plan.kind).toBe("atCurrentPace");
    if (plan.kind === "atCurrentPace") {
      expect(plan.projectedDate).not.toBeNull();
      expect(new Date(plan.projectedDate!).getFullYear()).toBe(2027);
    }
  });

  it("gives no projected date when the current pace is zero", () => {
    const progress: GoalProgress = { targetTiyin: 1200000, currentTiyin: 0, deadline: null, monthlyContributionTiyin: 0 };
    expect(computeGoalPlan(progress, NOW)).toEqual({ kind: "atCurrentPace", remainingTiyin: 1200000, projectedDate: null });
  });

  it("gives no projected date when the current pace is negative (withdrawing faster than contributing)", () => {
    const progress: GoalProgress = { targetTiyin: 1200000, currentTiyin: 0, deadline: null, monthlyContributionTiyin: -5000 };
    expect(computeGoalPlan(progress, NOW).kind).toBe("atCurrentPace");
    const plan = computeGoalPlan(progress, NOW);
    if (plan.kind === "atCurrentPace") expect(plan.projectedDate).toBeNull();
  });
});

describe("computeWhyBreakdown", () => {
  it("computes free-per-month as income plus (negative) expense", () => {
    const breakdown = computeWhyBreakdown(500000, -300000, 100000, []);
    expect(breakdown.freePerMonthTiyin).toBe(200000);
    expect(breakdown.shortfallTiyin).toBe(-100000); // plenty of slack
  });

  it("subtracts what higher-priority goals already claim", () => {
    const breakdown = computeWhyBreakdown(500000, -300000, 100000, [150000]);
    expect(breakdown.availableForThisGoalTiyin).toBe(50000); // 200000 - 150000
    expect(breakdown.shortfallTiyin).toBe(50000); // needs 100000, only 50000 available
  });

  it("allows a negative available amount when expenses eat everything", () => {
    const breakdown = computeWhyBreakdown(300000, -400000, 50000, []);
    expect(breakdown.freePerMonthTiyin).toBe(-100000);
    expect(breakdown.availableForThisGoalTiyin).toBe(-100000);
    expect(breakdown.shortfallTiyin).toBe(150000);
  });
});

describe("monthlyToProjectedDate / dateToRequiredMonthly (the slider)", () => {
  it("round-trips roughly: date -> monthly -> date lands close to the original", () => {
    const deadline = "2027-01-01T00:00:00.000Z";
    const monthly = dateToRequiredMonthly(1200000, deadline, NOW);
    expect(monthly).not.toBeNull();
    const projected = monthlyToProjectedDate(1200000, monthly!, NOW);
    const diffDays = Math.abs(new Date(projected!).getTime() - new Date(deadline).getTime()) / 86_400_000;
    expect(diffDays).toBeLessThan(31); // within a month, since Math.ceil rounds the monthly amount up
  });

  it("monthlyToProjectedDate returns null for a zero/negative monthly amount", () => {
    expect(monthlyToProjectedDate(1200000, 0, NOW)).toBeNull();
    expect(monthlyToProjectedDate(1200000, -100, NOW)).toBeNull();
  });

  it("dateToRequiredMonthly returns null for a deadline already in the past", () => {
    expect(dateToRequiredMonthly(1200000, "2025-01-01T00:00:00.000Z", NOW)).toBeNull();
  });

  it("both return a zero-ish result once the goal is already met", () => {
    expect(monthlyToProjectedDate(0, 0, NOW)).toBe(NOW.toISOString());
    expect(dateToRequiredMonthly(0, "2025-01-01T00:00:00.000Z", NOW)).toBe(0);
  });
});
