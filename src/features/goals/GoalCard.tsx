import { useState } from "react";
import type { GoalOverviewItem } from "../../db/goalsOverview";
import type { CategoryChange } from "../../analytics/metrics";
import { computeGoalStatusLabel } from "../../goals/status";
import { computeWhyBreakdown } from "../../goals/calculator";
import { formatTiyin } from "../operations/money";
import { EChart } from "../analytics/EChart";
import { buildGoalPlanChartOption } from "./goalPlanChartOption";

const STATUS_LABELS: Record<ReturnType<typeof computeGoalStatusLabel>, string> = {
  achieved: "достигнута",
  overdue: "срок прошёл",
  onTrack: "по плану",
  behind: "отстаю",
  ahead: "опережаю",
  noDeadline: "без срока",
};

export function GoalCard({
  item,
  avgIncomeTiyin,
  avgExpenseTiyin,
  higherPriorityMonthlyNeeded,
  categoryChanges,
  onEdit,
  onContribute,
  onMarkAchieved,
  onDelete,
}: {
  item: GoalOverviewItem;
  avgIncomeTiyin: number;
  avgExpenseTiyin: number;
  higherPriorityMonthlyNeeded: number[];
  categoryChanges: readonly CategoryChange[];
  onEdit: () => void;
  onContribute: () => void;
  onMarkAchieved: () => void;
  onDelete: () => void;
}) {
  const [showWhy, setShowWhy] = useState(false);
  const { goal, currentTiyin, plan, monthlyContributionTiyin, contributions } = item;

  const statusLabel = computeGoalStatusLabel(plan, monthlyContributionTiyin);
  const percent = goal.amountTiyin > 0 ? Math.min(100, Math.max(0, (currentTiyin / goal.amountTiyin) * 100)) : 0;

  const monthlyNeededTiyin = plan.kind === "byDeadline" ? plan.monthlyNeededTiyin : 0;
  const why = computeWhyBreakdown(avgIncomeTiyin, avgExpenseTiyin, monthlyNeededTiyin, higherPriorityMonthlyNeeded);

  return (
    <div className="goal-card">
      <div className="goal-card-head">
        {goal.icon && <span>{goal.icon}</span>}
        <span className="goal-card-name">{goal.name}</span>
        <span className={`goal-status goal-status-${statusLabel}`}>{STATUS_LABELS[statusLabel]}</span>
      </div>

      <div className="goal-progress-bar">
        <div className="goal-progress-fill" style={{ width: `${percent}%` }} />
      </div>
      <p className="hint">
        {formatTiyin(currentTiyin)} из {formatTiyin(goal.amountTiyin)} ({percent.toFixed(0)}%)
      </p>

      {plan.kind === "byDeadline" && (
        <p className="hint">
          нужно {formatTiyin(plan.monthlyNeededTiyin)}/мес, осталось {plan.monthsRemaining.toFixed(1)} мес.
        </p>
      )}
      {plan.kind === "atCurrentPace" && (
        <p className="hint">
          {plan.projectedDate ? `при текущем темпе — к ${plan.projectedDate.slice(0, 10)}` : "взносов пока нет — дата не определена"}
        </p>
      )}
      {plan.kind === "deadlinePassed" && <p className="hint">не хватает {formatTiyin(plan.remainingTiyin)}, срок прошёл</p>}

      <div className="goal-card-actions">
        {goal.locationType === "envelope" && (
          <button type="button" onClick={onContribute}>
            Взнос / забрать
          </button>
        )}
        <button type="button" onClick={() => setShowWhy((v) => !v)}>
          Почему
        </button>
        <button type="button" onClick={onEdit}>
          Изменить
        </button>
        {goal.status === "active" && (
          <button type="button" onClick={onMarkAchieved}>
            Отметить достигнутой
          </button>
        )}
        <button type="button" onClick={onDelete}>
          Удалить
        </button>
      </div>

      {showWhy && (
        <div className="goal-why">
          <p className="hint">
            Доход {formatTiyin(why.avgIncomeTiyin)} − расход {formatTiyin(Math.abs(why.avgExpenseTiyin))} = свободно{" "}
            {formatTiyin(why.freePerMonthTiyin)}/мес
          </p>
          {why.allocatedToOtherGoalsTiyin > 0 && (
            <p className="hint">− уже уходит на другие цели: {formatTiyin(why.allocatedToOtherGoalsTiyin)}/мес</p>
          )}
          <p className={why.shortfallTiyin > 0 ? "metric-expense" : "metric-income"}>
            {why.shortfallTiyin > 0
              ? `не хватает ${formatTiyin(why.shortfallTiyin)}/мес`
              : `есть запас ${formatTiyin(-why.shortfallTiyin)}/мес`}
          </p>
          {why.shortfallTiyin > 0 && categoryChanges.length > 0 && (
            <>
              <p className="hint">Где взять разницу (выросшие категории):</p>
              <ul className="goal-category-suggestions">
                {categoryChanges
                  .filter((c) => c.deltaTiyin < 0)
                  .slice(0, 3)
                  .map((c) => (
                    <li key={c.categoryKey} className="hint">
                      {c.label}: {formatTiyin(c.deltaTiyin)}
                    </li>
                  ))}
              </ul>
            </>
          )}
          {goal.locationType === "envelope" && contributions.length > 0 && (
            <EChart
              option={buildGoalPlanChartOption(contributions, goal.amountTiyin, goal.deadline, monthlyContributionTiyin, new Date())}
              height={200}
            />
          )}
        </div>
      )}
    </div>
  );
}
