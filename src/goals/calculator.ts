const AVG_DAYS_PER_MONTH = 30.44;

function monthsBetween(from: Date, to: Date): number {
  return (to.getTime() - from.getTime()) / (AVG_DAYS_PER_MONTH * 86_400_000);
}

function addMonths(date: Date, months: number): Date {
  return new Date(date.getTime() + months * AVG_DAYS_PER_MONTH * 86_400_000);
}

export type GoalProgress = {
  targetTiyin: number;
  currentTiyin: number;
  deadline: string | null;
  /** Current pace, tiyin/month — used only when there's no deadline. */
  monthlyContributionTiyin: number;
  /** Only applied to the "есть срок" branch (SPEC-2.md 10.3's "процент
   * депозита учитывается, если цель на депозите"). */
  annualDepositRatePercent?: number | null;
};

export type GoalPlan =
  | { kind: "achieved" }
  | { kind: "deadlinePassed"; remainingTiyin: number }
  | { kind: "byDeadline"; remainingTiyin: number; monthsRemaining: number; monthlyNeededTiyin: number }
  | { kind: "atCurrentPace"; remainingTiyin: number; projectedDate: string | null };

/** How much, per future month, closes `remainingTiyin` over `monthsRemaining`
 * — compounds at `annualRatePercent` when the goal sits in a deposit
 * (future value of an ordinary annuity, solved for the payment). */
function monthlyNeeded(remainingTiyin: number, monthsRemaining: number, annualRatePercent: number | null | undefined): number {
  const monthlyRate = (annualRatePercent ?? 0) / 100 / 12;
  if (monthlyRate === 0) return Math.ceil(remainingTiyin / monthsRemaining);
  const growthFactor = (Math.pow(1 + monthlyRate, monthsRemaining) - 1) / monthlyRate;
  return Math.ceil(remainingTiyin / growthFactor);
}

/**
 * SPEC-2.md 10.3's "когда, сколько, почему" core — every branch the
 * done-criterion names explicitly: already achieved (remaining <= 0),
 * deadline in the past, and a zero/negative pace (no projected date,
 * rather than a nonsensical or infinite one).
 */
export function computeGoalPlan(progress: GoalProgress, now: Date = new Date()): GoalPlan {
  const remainingTiyin = progress.targetTiyin - progress.currentTiyin;
  if (remainingTiyin <= 0) return { kind: "achieved" };

  if (progress.deadline) {
    const monthsRemaining = monthsBetween(now, new Date(progress.deadline));
    if (monthsRemaining <= 0) return { kind: "deadlinePassed", remainingTiyin };
    return {
      kind: "byDeadline",
      remainingTiyin,
      monthsRemaining,
      monthlyNeededTiyin: monthlyNeeded(remainingTiyin, monthsRemaining, progress.annualDepositRatePercent),
    };
  }

  if (progress.monthlyContributionTiyin <= 0) {
    return { kind: "atCurrentPace", remainingTiyin, projectedDate: null };
  }
  const monthsToGo = remainingTiyin / progress.monthlyContributionTiyin;
  return { kind: "atCurrentPace", remainingTiyin, projectedDate: addMonths(now, monthsToGo).toISOString() };
}

export type WhyBreakdown = {
  avgIncomeTiyin: number;
  avgExpenseTiyin: number;
  freePerMonthTiyin: number;
  allocatedToOtherGoalsTiyin: number;
  availableForThisGoalTiyin: number;
  shortfallTiyin: number;
};

/**
 * "Разбор почему" (10.3): what's free per month, minus whatever
 * higher-priority goals already claim, versus what this goal needs.
 * `shortfallTiyin` can come back negative (there's slack) — that's not
 * clamped, a negative shortfall is the useful signal that this goal is
 * comfortably funded.
 */
export function computeWhyBreakdown(
  avgIncomeTiyin: number,
  avgExpenseTiyin: number,
  monthlyNeededForThisGoalTiyin: number,
  higherPriorityGoalsMonthlyNeeded: readonly number[],
): WhyBreakdown {
  const freePerMonthTiyin = avgIncomeTiyin + avgExpenseTiyin;
  const allocatedToOtherGoalsTiyin = higherPriorityGoalsMonthlyNeeded.reduce((sum, n) => sum + n, 0);
  const availableForThisGoalTiyin = freePerMonthTiyin - allocatedToOtherGoalsTiyin;
  return {
    avgIncomeTiyin,
    avgExpenseTiyin,
    freePerMonthTiyin,
    allocatedToOtherGoalsTiyin,
    availableForThisGoalTiyin,
    shortfallTiyin: monthlyNeededForThisGoalTiyin - availableForThisGoalTiyin,
  };
}

/** The "сумма в месяц ↔ дата" slider's two directions — both pure, both
 * cheap enough to recompute on every drag event. */
export function monthlyToProjectedDate(remainingTiyin: number, monthlyTiyin: number, now: Date = new Date()): string | null {
  if (remainingTiyin <= 0) return now.toISOString();
  if (monthlyTiyin <= 0) return null;
  return addMonths(now, remainingTiyin / monthlyTiyin).toISOString();
}

export function dateToRequiredMonthly(remainingTiyin: number, deadline: string, now: Date = new Date()): number | null {
  if (remainingTiyin <= 0) return 0;
  const monthsRemaining = monthsBetween(now, new Date(deadline));
  if (monthsRemaining <= 0) return null;
  return Math.ceil(remainingTiyin / monthsRemaining);
}
