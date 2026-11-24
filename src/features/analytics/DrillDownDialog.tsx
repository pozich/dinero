import { useEffect, useState } from "react";
import { getDb } from "../../db/client";
import { queryTransactions, type TransactionListItem } from "../../db/transactionsQuery";
import { setTransactionCategory } from "../../db/transactions";
import { findOrCreateCategory, type Category } from "../../db/categories";
import { formatTiyin } from "../operations/money";
import { CategoryInput } from "../operations/CategoryInput";
import { useUndoStack } from "../../undo/UndoContext";
import { withUndo } from "../../undo/undoStack";
import { useReadOnly } from "../../reliability/ReadOnlyContext";
import { useBackButtonClose } from "../../reliability/useBackButtonClose";

/**
 * SPEC-2.md 6.8: клик по графику → ровно те операции, из которых сложилось
 * число, с возможностью сразу поправить категорию — not a full operations
 * screen, just enough to fix what the accuracy warning flagged.
 */
export function DrillDownDialog({
  title,
  transactionIds,
  categories,
  onClose,
  onChanged,
}: {
  title: string;
  transactionIds: number[];
  categories: Category[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const [rows, setRows] = useState<TransactionListItem[] | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const undoStack = useUndoStack();
  const readOnly = useReadOnly();
  useBackButtonClose(onClose);

  useEffect(() => {
    getDb()
      .then((db) => queryTransactions(db, { ids: transactionIds }))
      .then(setRows);
  }, [transactionIds]);

  async function commitCategory(row: TransactionListItem, name: string) {
    const db = await getDb();
    const categoryId = await findOrCreateCategory(db, name);
    await withUndo(
      undoStack,
      `Категория «${name}»: ${row.description}`,
      [{ table: "splits", whereSql: "transaction_id = $1", params: [row.id] }],
      () => setTransactionCategory(db, row.id, categoryId, row.amount_tiyin),
    );
    setEditingId(null);
    setRows(await queryTransactions(db, { ids: transactionIds }));
    onChanged();
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal drilldown-dialog" onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        {rows === null ? (
          <p className="hint">Загрузка...</p>
        ) : rows.length === 0 ? (
          <p className="hint">Операций нет.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Дата</th>
                <th>Счёт</th>
                <th>Описание</th>
                <th>Категория</th>
                <th>Сумма</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.occurred_at.slice(0, 10)}</td>
                  <td>{r.account_name}</td>
                  <td>{r.description}</td>
                  <td
                    className="category-cell"
                    onDoubleClick={() => !readOnly && setEditingId(r.id)}
                  >
                    {editingId === r.id ? (
                      <CategoryInput
                        initialValue={r.category_name ?? ""}
                        categories={categories}
                        onCommit={(name) => commitCategory(r, name)}
                        onCancel={() => setEditingId(null)}
                      />
                    ) : (
                      r.category_name ?? "Без категории"
                    )}
                  </td>
                  <td>{formatTiyin(r.amount_tiyin)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="modal-actions">
          <button type="button" onClick={onClose}>
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}
