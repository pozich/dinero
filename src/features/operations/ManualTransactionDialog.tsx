import { useState } from "react";
import type { Account } from "../../db/accounts";
import type { Category } from "../../db/categories";
import type { TransactionListItem } from "../../db/transactionsQuery";
import { parseTiyinInput } from "./money";

export type ManualFormResult = {
  accountId: number;
  occurredAt: string;
  amountTiyin: number;
  description: string;
  categoryName: string;
  note: string;
  isIgnored: boolean;
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Doubles as "add a manual operation" (no `row`) and "edit" (with one) —
 * SPEC-2.md 4.1: an imported row only ever has category/note/"не учитывать"
 * editable here, amount/date/account/description stay locked; a manual row
 * (`is_manual`) allows all of it, plus deleting it entirely.
 */
export function ManualTransactionDialog({
  row,
  accounts,
  categories,
  onSave,
  onDelete,
  onClose,
}: {
  row?: TransactionListItem;
  accounts: Account[];
  categories: Category[];
  onSave: (result: ManualFormResult) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const isEditing = !!row;
  const fieldsLocked = isEditing && !row!.is_manual;

  const [accountId, setAccountId] = useState<number>(row?.account_id ?? accounts[0]?.id ?? 0);
  const [isExpense, setIsExpense] = useState(row ? row.amount_tiyin < 0 : true);
  const [amountText, setAmountText] = useState(
    row ? (Math.abs(row.amount_tiyin) / 100).toFixed(2) : "",
  );
  const [date, setDate] = useState(row ? row.occurred_at.slice(0, 10) : todayIso());
  const [description, setDescription] = useState(row?.description ?? "");
  const [categoryName, setCategoryName] = useState(row?.category_name ?? "");
  const [note, setNote] = useState(row?.note ?? "");
  const [isIgnored, setIsIgnored] = useState(row ? !!row.is_ignored : false);

  const amount = parseTiyinInput(amountText);
  const canSave = amount !== null && amount > 0 && description.trim().length > 0;

  function save() {
    if (!canSave || amount === null) return;
    onSave({
      accountId,
      occurredAt: `${date}T00:00:00.000Z`,
      amountTiyin: isExpense ? -amount : amount,
      description: description.trim(),
      categoryName: categoryName.trim(),
      note: note.trim(),
      isIgnored,
    });
  }

  return (
    <div className="modal-backdrop">
      <div className="modal manual-dialog">
        <h3>{isEditing ? "Операция" : "Новая операция"}</h3>
        {fieldsLocked && (
          <p className="hint">
            Это операция из выписки — сумму, дату, счёт и описание не поменять, только
            категорию, заметку и «не учитывать».
          </p>
        )}
        <div className="manual-form">
          <label>
            Счёт
            <select
              value={accountId}
              disabled={fieldsLocked}
              onChange={(e) => setAccountId(Number(e.target.value))}
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
          <div className="manual-sign">
            <label>
              <input
                type="radio"
                name="sign"
                checked={isExpense}
                disabled={fieldsLocked}
                onChange={() => setIsExpense(true)}
              />
              Расход
            </label>
            <label>
              <input
                type="radio"
                name="sign"
                checked={!isExpense}
                disabled={fieldsLocked}
                onChange={() => setIsExpense(false)}
              />
              Приход
            </label>
          </div>
          <label>
            Сумма
            <input
              value={amountText}
              disabled={fieldsLocked}
              placeholder="0.00"
              onChange={(e) => setAmountText(e.target.value)}
            />
          </label>
          <label>
            Дата
            <input
              type="date"
              value={date}
              disabled={fieldsLocked}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
          <label>
            Описание
            <input
              value={description}
              disabled={fieldsLocked}
              autoFocus={!isEditing}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
          <label>
            Категория
            <input
              list="manual-categories"
              value={categoryName}
              onChange={(e) => setCategoryName(e.target.value)}
            />
          </label>
          <datalist id="manual-categories">
            {categories.map((c) => (
              <option key={c.id} value={c.name} />
            ))}
          </datalist>
          <label>
            Заметка
            <input value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
          <label className="manual-ignored">
            <input
              type="checkbox"
              checked={isIgnored}
              onChange={(e) => setIsIgnored(e.target.checked)}
            />
            не учитывать
          </label>
        </div>
        <div className="modal-actions">
          {onDelete && (
            <button type="button" onClick={onDelete}>
              Удалить
            </button>
          )}
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
