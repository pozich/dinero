import { useState } from "react";
import { getDb } from "../../db/client";
import { findOrCreatePersonByAlias, type Person } from "../../db/people";
import { createDebt } from "../../db/debts";
import type { DebtDirection } from "../../debts/computeDebtBalances";
import { extractPersonName } from "../../debts/extractPersonName";
import { formatTiyin } from "../operations/money";
import { useBackButtonClose } from "../../reliability/useBackButtonClose";
import { PersonInput } from "./PersonInput";

type MarkableTransaction = {
  id: number;
  description: string;
  amount_tiyin: number;
  occurred_at: string;
};

/** SPEC-2.md 8: "Пометить долг" from an existing transfer — the person is
 * pre-filled from the description when `extractPersonName` is confident
 * enough, direction defaults from the transaction's own sign (money out =
 * "Дал в долг", money in = "Взял в долг"), both are editable. */
export function MarkDebtDialog({
  row,
  people,
  onCreated,
  onClose,
}: {
  row: MarkableTransaction;
  people: readonly Person[];
  onCreated: () => void;
  onClose: () => void;
}) {
  const [personName, setPersonName] = useState(extractPersonName(row.description) ?? "");
  const [direction, setDirection] = useState<DebtDirection>(row.amount_tiyin < 0 ? "lent" : "borrowed");
  const [dueDate, setDueDate] = useState("");
  const [note, setNote] = useState("");
  useBackButtonClose(onClose);

  async function submit() {
    if (!personName.trim()) return;
    const db = await getDb();
    const personId = await findOrCreatePersonByAlias(db, personName.trim());
    await createDebt(db, {
      personId,
      direction,
      transactionId: row.id,
      amountTiyin: Math.abs(row.amount_tiyin),
      occurredAt: row.occurred_at,
      dueDate: dueDate ? `${dueDate}T00:00:00.000Z` : null,
      note: note.trim() || null,
    });
    onCreated();
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal manual-dialog" onClick={(e) => e.stopPropagation()}>
        <h3>Отметить долг</h3>
        <p className="hint">
          {row.description} · {formatTiyin(row.amount_tiyin)}
        </p>
        <div className="manual-form">
          <label>
            Человек
            <PersonInput value={personName} people={people} onChange={setPersonName} />
          </label>
          <div className="manual-sign">
            <label>
              <input type="radio" checked={direction === "lent"} onChange={() => setDirection("lent")} />
              Дал в долг (мне должны)
            </label>
            <label>
              <input type="radio" checked={direction === "borrowed"} onChange={() => setDirection("borrowed")} />
              Взял в долг (я должен)
            </label>
          </div>
          <label>
            Срок возврата (необязательно)
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </label>
          <label>
            Заметка
            <input value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
        </div>
        <div className="modal-actions">
          <button type="button" onClick={onClose}>
            Отмена
          </button>
          <button type="button" disabled={!personName.trim()} onClick={submit}>
            Сохранить
          </button>
        </div>
      </div>
    </div>
  );
}
