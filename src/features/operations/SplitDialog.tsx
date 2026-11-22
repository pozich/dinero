import { useState } from "react";
import type { Category } from "../../db/categories";
import type { SplitInput } from "../../db/transactions";
import { formatTiyin, parseTiyinInput } from "./money";

type Row = { categoryName: string; amountText: string };

export function SplitDialog({
  transactionAmountTiyin,
  description,
  categories,
  onSave,
  onClose,
}: {
  transactionAmountTiyin: number;
  description: string;
  categories: Category[];
  onSave: (splits: SplitInput[]) => void;
  onClose: () => void;
}) {
  const [rows, setRows] = useState<Row[]>([
    { categoryName: "", amountText: (transactionAmountTiyin / 100).toFixed(2) },
  ]);

  const parsedAmounts = rows.map((r) => parseTiyinInput(r.amountText));
  const sum = parsedAmounts.reduce((a: number, v) => a + (v ?? 0), 0);
  const remaining = transactionAmountTiyin - sum;
  const categoryIds = rows.map(
    (r) => categories.find((c) => c.name.toLowerCase() === r.categoryName.trim().toLowerCase())?.id,
  );
  const canSave =
    remaining === 0 &&
    parsedAmounts.every((v) => v !== null) &&
    categoryIds.every((id) => id !== undefined);

  function updateRow(index: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function addRow() {
    setRows((prev) => [...prev, { categoryName: "", amountText: (remaining / 100).toFixed(2) }]);
  }

  function removeRow(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index));
  }

  function save() {
    if (!canSave) return;
    onSave(
      rows.map((_, i) => ({
        categoryId: categoryIds[i]!,
        amountTiyin: parsedAmounts[i]!,
      })),
    );
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") onClose();
  }

  return (
    <div className="modal-backdrop" onKeyDown={onKeyDown}>
      <div className="modal split-dialog">
        <h3>Разрез операции</h3>
        <p className="hint">{description}</p>
        <table>
          <thead>
            <tr>
              <th>Категория</th>
              <th>Сумма</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>
                <td>
                  <input
                    list="split-categories"
                    value={row.categoryName}
                    onChange={(e) => updateRow(i, { categoryName: e.target.value })}
                    autoFocus={i === 0}
                  />
                </td>
                <td>
                  <input
                    value={row.amountText}
                    onChange={(e) => updateRow(i, { amountText: e.target.value })}
                  />
                </td>
                <td>
                  {rows.length > 1 && (
                    <button type="button" onClick={() => removeRow(i)}>
                      ×
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <datalist id="split-categories">
          {categories.map((c) => (
            <option key={c.id} value={c.name} />
          ))}
        </datalist>
        <p className="hint">
          Сумма операции: {formatTiyin(transactionAmountTiyin)} · Остаток:{" "}
          {formatTiyin(remaining)}
        </p>
        <div className="modal-actions">
          <button type="button" onClick={addRow}>
            + ещё часть
          </button>
          <button type="button" onClick={onClose}>
            Отмена
          </button>
          <button type="button" disabled={!canSave} onClick={save}>
            Сохранить
          </button>
        </div>
      </div>
    </div>
  );
}
