import { useState } from "react";
import type { TransactionListItem } from "../../db/transactionsQuery";
import { formatTiyin } from "./money";
import { formatTransactionDate, spansMultipleYears } from "./dateFormat";

export function ApplyToSimilarDialog({
  categoryName,
  candidates,
  onApply,
  onClose,
  onCreateRule,
}: {
  categoryName: string;
  candidates: TransactionListItem[];
  onApply: (ids: number[]) => void;
  onClose: () => void;
  onCreateRule?: () => void;
}) {
  const [checked, setChecked] = useState<Set<number>>(new Set(candidates.map((c) => c.id)));
  const showYear = spansMultipleYears(candidates.map((c) => c.occurred_at));

  function toggle(id: number) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h3>Применить «{categoryName}» ко всем похожим?</h3>
        <p className="hint">
          Операции с таким же описанием, пока без категории — отметьте нужные.
        </p>
        <ul className="similar-list">
          {candidates.map((c) => (
            <li key={c.id}>
              <label>
                <input
                  type="checkbox"
                  checked={checked.has(c.id)}
                  onChange={() => toggle(c.id)}
                />
                {formatTransactionDate(c.occurred_at, showYear)} · {c.account_name} ·{" "}
                {formatTiyin(c.amount_tiyin)}
              </label>
            </li>
          ))}
        </ul>
        <div className="modal-actions">
          <button type="button" onClick={onClose}>
            Пропустить
          </button>
          {onCreateRule && (
            <button type="button" onClick={onCreateRule}>
              Создать правило из этого
            </button>
          )}
          <button
            type="button"
            disabled={checked.size === 0}
            onClick={() => onApply([...checked])}
          >
            Применить ({checked.size})
          </button>
        </div>
      </div>
    </div>
  );
}
