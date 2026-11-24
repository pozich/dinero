import { useCallback, useEffect, useState } from "react";
import { getDb } from "../../db/client";
import { queryGoalsOverview, computeAverageIncomeExpense, type GoalOverviewItem } from "../../db/goalsOverview";
import { deleteGoal, setGoalStatus, type Goal } from "../../db/goals";
import { listAccounts, type Account } from "../../db/accounts";
import { listCategories } from "../../db/categories";
import { queryLedger } from "../../db/ledgerQuery";
import { computeCategoryChanges, type CategoryChange } from "../../analytics/metrics";
import { currentPeriod, comparisonPeriod } from "../../analytics/period";
import { useBackButtonClose } from "../../reliability/useBackButtonClose";
import { GoalCard } from "./GoalCard";
import { NewGoalDialog } from "./NewGoalDialog";
import { ContributionDialog } from "./ContributionDialog";

export function GoalsScreen({ onClose, onCountChange }: { onClose: () => void; onCountChange?: (n: number) => void }) {
  const [items, setItems] = useState<GoalOverviewItem[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categoryChanges, setCategoryChanges] = useState<CategoryChange[]>([]);
  const [whyWindowMonths, setWhyWindowMonths] = useState<3 | 6 | 12>(3);
  const [avg, setAvg] = useState({ avgIncomeTiyin: 0, avgExpenseTiyin: 0 });
  const [editGoal, setEditGoal] = useState<Goal | "new" | null>(null);
  const [contributeFor, setContributeFor] = useState<{ id: number; name: string } | null>(null);
  useBackButtonClose(onClose);

  const refresh = useCallback(async () => {
    const db = await getDb();
    const [overview, accs, categories] = await Promise.all([queryGoalsOverview(db), listAccounts(db), listCategories(db)]);
    setItems(overview);
    setAccounts(accs);
    onCountChange?.(overview.filter((i) => i.plan.kind !== "achieved").length);

    const period = currentPeriod("month");
    const prevPeriod = comparisonPeriod(period, "month", "previous");
    const [currentRows, previousRows] = await Promise.all([
      queryLedger(db, { periodStart: period.start, periodEnd: period.end }),
      queryLedger(db, { periodStart: prevPeriod.start, periodEnd: prevPeriod.end }),
    ]);
    setCategoryChanges(computeCategoryChanges(currentRows, previousRows, categories));
  }, [onCountChange]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    getDb().then((db) => computeAverageIncomeExpense(db, whyWindowMonths)).then(setAvg);
  }, [whyWindowMonths]);

  async function markAchieved(id: number) {
    const db = await getDb();
    await setGoalStatus(db, id, "achieved");
    refresh();
  }

  async function removeGoal(id: number) {
    if (!confirm("Удалить цель? История взносов тоже удалится.")) return;
    const db = await getDb();
    await deleteGoal(db, id);
    refresh();
  }

  let higherPriorityMonthlyNeeded: number[] = [];

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal debts-screen" onClick={(e) => e.stopPropagation()}>
        <h3>Цели накоплений</h3>
        <div className="goals-toolbar">
          <button type="button" onClick={() => setEditGoal("new")}>
            + Цель
          </button>
          <span className="hint">Окно для «почему»:</span>
          {([3, 6, 12] as const).map((m) => (
            <button key={m} type="button" className={m === whyWindowMonths ? "active" : ""} onClick={() => setWhyWindowMonths(m)}>
              {m} мес
            </button>
          ))}
        </div>

        {items.length === 0 && <p className="hint">Пока нет целей.</p>}

        <div className="goals-list">
          {items.map((item) => {
            const needed = higherPriorityMonthlyNeeded.slice();
            higherPriorityMonthlyNeeded = [
              ...higherPriorityMonthlyNeeded,
              item.plan.kind === "byDeadline" ? item.plan.monthlyNeededTiyin : item.monthlyContributionTiyin,
            ];
            return (
              <GoalCard
                key={item.goal.id}
                item={item}
                avgIncomeTiyin={avg.avgIncomeTiyin}
                avgExpenseTiyin={avg.avgExpenseTiyin}
                higherPriorityMonthlyNeeded={needed}
                categoryChanges={categoryChanges}
                onEdit={() => setEditGoal(item.goal)}
                onContribute={() => setContributeFor({ id: item.goal.id, name: item.goal.name })}
                onMarkAchieved={() => markAchieved(item.goal.id)}
                onDelete={() => removeGoal(item.goal.id)}
              />
            );
          })}
        </div>

        <div className="modal-actions">
          <button type="button" onClick={onClose}>
            Закрыть
          </button>
        </div>

        {editGoal && (
          <NewGoalDialog
            goal={editGoal === "new" ? null : editGoal}
            accounts={accounts}
            onClose={() => setEditGoal(null)}
            onSaved={() => {
              setEditGoal(null);
              refresh();
            }}
          />
        )}

        {contributeFor && (
          <ContributionDialog
            goalId={contributeFor.id}
            goalName={contributeFor.name}
            onClose={() => setContributeFor(null)}
            onSaved={() => {
              setContributeFor(null);
              refresh();
            }}
          />
        )}
      </div>
    </div>
  );
}
