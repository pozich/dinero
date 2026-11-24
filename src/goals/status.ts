import type { GoalPlan } from "./calculator";

export type GoalStatusLabel = "achieved" | "overdue" | "onTrack" | "behind" | "ahead" | "noDeadline";

/** SPEC-2.md 10.4's card status (по плану/отстаю/опережаю) — only
 * meaningful when there's a deadline to measure against; a no-deadline
 * goal is just "noDeadline", not forced into one of the three. */
export function computeGoalStatusLabel(plan: GoalPlan, monthlyContributionTiyin: number): GoalStatusLabel {
  if (plan.kind === "achieved") return "achieved";
  if (plan.kind === "deadlinePassed") return "overdue";
  if (plan.kind === "atCurrentPace") return "noDeadline";

  const ratio = plan.monthlyNeededTiyin > 0 ? monthlyContributionTiyin / plan.monthlyNeededTiyin : 1;
  if (ratio >= 1.05) return "ahead";
  if (ratio < 0.95) return "behind";
  return "onTrack";
}
