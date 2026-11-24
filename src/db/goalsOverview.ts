import type { DbClient } from "./types";
import { listGoals, type Goal } from "./goals";
import { listContributions, type GoalContribution } from "./goalContributions";
import { queryAccountOverview } from "./accountOverview";
import { queryInvestmentsOverview } from "./investmentsOverview";
import { queryLedger } from "./ledgerQuery";
import { computeMetrics } from "../analytics/metrics";
import { computeGoalCurrentTiyin, sumContributions, averageMonthlyContribution, type GoalLocation } from "../goals/progress";
import { computeGoalPlan, type GoalPlan } from "../goals/calculator";

export type GoalOverviewItem = {
  goal: Goal;
  currentTiyin: number;
  plan: GoalPlan;
  monthlyContributionTiyin: number;
  contributions: GoalContribution[];
};

function locationOf(goal: Goal): GoalLocation {
  if (goal.locationType === "account") return { type: "account", accountId: goal.locationAccountId ?? -1 };
  if (goal.locationType === "portfolio") return { type: "portfolio" };
  return { type: "envelope" };
}

/**
 * Per-goal current/plan, in priority order (goals are already listed that
 * way) so the UI can derive "сколько уже уходит в другие цели" just by
 * folding over the goals that come before this one in the list.
 */
export async function queryGoalsOverview(db: DbClient, now: Date = new Date()): Promise<GoalOverviewItem[]> {
  const goals = await listGoals(db);
  const accountOverviews = await queryAccountOverview(db);
  const accountBalances = new Map(accountOverviews.map((a) => [a.accountId, a.currentBalanceTiyin]));
  const investmentsOverview = await queryInvestmentsOverview(db, now);
  const portfolioValueTiyin = investmentsOverview.positions.reduce((sum, p) => sum + (p.currentValueTiyin ?? 0), 0);

  const items: GoalOverviewItem[] = [];
  for (const goal of goals) {
    const contributions = goal.locationType === "envelope" ? await listContributions(db, goal.id) : [];
    const currentTiyin = computeGoalCurrentTiyin(locationOf(goal), {
      accountBalances,
      envelopeContributionsTiyin: sumContributions(contributions),
      portfolioValueTiyin,
    });
    const monthlyContributionTiyin = averageMonthlyContribution(contributions, 3, now);
    const plan = computeGoalPlan(
      {
        targetTiyin: goal.amountTiyin,
        currentTiyin,
        deadline: goal.deadline,
        monthlyContributionTiyin,
        annualDepositRatePercent: goal.depositRatePercent,
      },
      now,
    );
    items.push({ goal, currentTiyin, plan, monthlyContributionTiyin, contributions });
  }
  return items;
}

/** SPEC-2.md 10.3's средний доход/расход за 3/6/12 мес — the window the
 * «разбор почему» toggle picks. */
export async function computeAverageIncomeExpense(
  db: DbClient,
  months: number,
  now: Date = new Date(),
): Promise<{ avgIncomeTiyin: number; avgExpenseTiyin: number }> {
  const periodStart = new Date(now.getTime() - months * 30.44 * 86_400_000).toISOString();
  const rows = await queryLedger(db, { periodStart, periodEnd: now.toISOString() });
  const metrics = computeMetrics(rows, { periodDays: Math.round(months * 30.44), includeDividends: true });
  return { avgIncomeTiyin: Math.round(metrics.incomeTiyin / months), avgExpenseTiyin: Math.round(metrics.expenseTiyin / months) };
}
