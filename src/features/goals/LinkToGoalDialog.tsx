import { useEffect, useState } from "react";
import { getDb } from "../../db/client";
import type { Goal } from "../../db/goals";
import { linkTransactionToGoal, unlinkTransaction, getGoalIdForTransaction } from "../../db/goalLinks";
import { useBackButtonClose } from "../../reliability/useBackButtonClose";

/** SPEC-2.md 10.4: "покупку можно связать с целью (метка в аналитике)" —
 * just a tag, doesn't change how the transaction counts in the ledger. */
export function LinkToGoalDialog({
  transactionId,
  description,
  goals,
  onClose,
  onLinked,
}: {
  transactionId: number;
  description: string;
  goals: readonly Goal[];
  onClose: () => void;
  onLinked: () => void;
}) {
  const [currentGoalId, setCurrentGoalId] = useState<number | null>(null);
  const [selected, setSelected] = useState<string>("");
  useBackButtonClose(onClose);

  useEffect(() => {
    getDb()
      .then((db) => getGoalIdForTransaction(db, transactionId))
      .then((id) => {
        setCurrentGoalId(id);
        setSelected(id ? String(id) : "");
      });
  }, [transactionId]);

  async function save() {
    const db = await getDb();
    if (!selected) {
      await unlinkTransaction(db, transactionId);
    } else {
      await linkTransactionToGoal(db, Number(selected), transactionId);
    }
    onLinked();
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Привязать к цели</h3>
        <p className="hint">{description}</p>
        <select value={selected} onChange={(e) => setSelected(e.target.value)}>
          <option value="">Не привязано</option>
          {goals.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
        <div className="modal-actions">
          <button type="button" onClick={onClose}>
            Отмена
          </button>
          <button type="button" onClick={save}>
            Сохранить
          </button>
        </div>
        {currentGoalId !== null && !selected && <p className="hint">Связь будет удалена.</p>}
      </div>
    </div>
  );
}
