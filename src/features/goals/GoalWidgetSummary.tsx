import type { GoalOverviewItem } from "../../db/goalsOverview";
import { computeGoalStatusLabel } from "../../goals/status";
import { formatTiyin } from "../operations/money";

const STATUS_LABELS: Record<ReturnType<typeof computeGoalStatusLabel>, string> = {
  achieved: "достигнута",
  overdue: "срок прошёл",
  onTrack: "по плану",
  behind: "отстаю",
  ahead: "опережаю",
  noDeadline: "без срока",
};

/** SPEC-2.md 10.4's "виджеты целей доступны в дашборде" — a compact,
 * read-only summary (no edit/contribute actions) for the dashboard grid;
 * the full GoalCard with its "почему" breakdown lives in GoalsScreen. */
export function GoalWidgetSummary({ items }: { items: readonly GoalOverviewItem[] }) {
  if (items.length === 0) return <p className="hint">Целей пока нет.</p>;
  return (
    <div className="goal-widget-summary">
      {items.map((item) => {
        const percent = item.goal.amountTiyin > 0 ? Math.min(100, Math.max(0, (item.currentTiyin / item.goal.amountTiyin) * 100)) : 0;
        const statusLabel = computeGoalStatusLabel(item.plan, item.monthlyContributionTiyin);
        return (
          <div key={item.goal.id} className="goal-widget-row">
            <div className="goal-widget-row-head">
              <span>
                {item.goal.icon} {item.goal.name}
              </span>
              <span className={`goal-status goal-status-${statusLabel}`}>{STATUS_LABELS[statusLabel]}</span>
            </div>
            <div className="goal-progress-bar">
              <div className="goal-progress-fill" style={{ width: `${percent}%` }} />
            </div>
            <span className="hint">
              {formatTiyin(item.currentTiyin)} из {formatTiyin(item.goal.amountTiyin)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
