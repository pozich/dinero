import { useState } from "react";
import type { TransactionListItem } from "../../db/transactionsQuery";
import { formatTiyin } from "./money";
import { formatTransactionDate, spansMultipleYears } from "./dateFormat";
import { useBackButtonClose } from "../../reliability/useBackButtonClose";

export type RuleMatch = {
  transaction: TransactionListItem;
  categoryId: number;
  categoryName: string;
};

export function ApplyRulesDialog({
  matches,
  onApply,
  onClose,
}: {
  matches: RuleMatch[];
  onApply: (transactionIds: number[]) => void;
  onClose: () => void;
}) {
  useBackButtonClose(onClose);
  const [checked, setChecked] = useState<Set<number>>(
    new Set(matches.map((m) => m.transaction.id)),
  );
  const showYear = spansMultipleYears(matches.map((m) => m.transaction.occurred_at));

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
        <h3>Применить правила?</h3>
        <p className="hint">
          {matches.length === 0
            ? "Ни одна из операций без категории не подошла ни под одно правило."
            : `${matches.length} операций без категории совпали с правилами — отметьте, что применить.`}
        </p>
        <ul className="similar-list">
          {matches.map((m) => (
            <li key={m.transaction.id}>
              <label>
                <input
                  type="checkbox"
                  checked={checked.has(m.transaction.id)}
                  onChange={() => toggle(m.transaction.id)}
                />
                {formatTransactionDate(m.transaction.occurred_at, showYear)} ·{" "}
                {m.transaction.account_name} · {formatTiyin(m.transaction.amount_tiyin)} ·{" "}
                {m.transaction.description} → <strong>{m.categoryName}</strong>
              </label>
            </li>
          ))}
        </ul>
        <div className="modal-actions">
          <button type="button" onClick={onClose}>
            {matches.length === 0 ? "Закрыть" : "Отмена"}
          </button>
          {matches.length > 0 && (
            <button
              type="button"
              disabled={checked.size === 0}
              onClick={() => onApply([...checked])}
            >
              Применить ({checked.size})
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
