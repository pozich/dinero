import { useState } from "react";
import type { TransactionListItem } from "../../db/transactionsQuery";
import { formatTransactionDate } from "../operations/dateFormat";
import { formatTiyin } from "../operations/money";

export type DisplayMergeCandidate = {
  manualId: number;
  importedId: number;
  manual: TransactionListItem;
  imported: TransactionListItem;
};

/** SPEC-2.md 4.1: "это та же операция?" — shown after an import whose new
 * rows look like something already entered by hand. */
export function MergeManualDialog({
  candidates,
  onApply,
  onClose,
}: {
  candidates: DisplayMergeCandidate[];
  onApply: (chosen: DisplayMergeCandidate[]) => void;
  onClose: () => void;
}) {
  const [checked, setChecked] = useState<Set<number>>(
    new Set(candidates.map((c) => c.manualId)),
  );

  function toggle(manualId: number) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(manualId)) next.delete(manualId);
      else next.add(manualId);
      return next;
    });
  }

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h3>Это та же операция?</h3>
        <p className="hint">
          Среди только что импортированного нашлись операции, похожие на уже введённые
          руками (тот же счёт, сумма, дата ±1 день). Слияние переносит категорию и
          заметку на настоящую операцию из выписки, а ручную запись убирает.
        </p>
        <ul className="similar-list">
          {candidates.map((c) => (
            <li key={c.manualId}>
              <label>
                <input
                  type="checkbox"
                  checked={checked.has(c.manualId)}
                  onChange={() => toggle(c.manualId)}
                />
                <span>
                  {formatTransactionDate(c.manual.occurred_at, true)} ·{" "}
                  {formatTiyin(c.manual.amount_tiyin)} · ручная «{c.manual.description}» →
                  выписка «{c.imported.description}»
                </span>
              </label>
            </li>
          ))}
        </ul>
        <div className="modal-actions">
          <button type="button" onClick={onClose}>
            Пропустить
          </button>
          <button
            type="button"
            disabled={checked.size === 0}
            onClick={() => onApply(candidates.filter((c) => checked.has(c.manualId)))}
          >
            Слить ({checked.size})
          </button>
        </div>
      </div>
    </div>
  );
}
