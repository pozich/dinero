import { useState } from "react";
import { getDb } from "../../db/client";
import { findOrCreatePersonByAlias, type Person } from "../../db/people";
import { createDebt } from "../../db/debts";
import type { DebtDirection } from "../../debts/computeDebtBalances";
import { parseTiyinInput } from "../operations/money";
import { useBackButtonClose } from "../../reliability/useBackButtonClose";
import { PersonInput } from "./PersonInput";

/** SPEC-2.md 8's "ручная запись (наличные)" — a debt with no transaction
 * behind it at all, doesn't touch any account balance. */
export function NewDebtDialog({
  people,
  onCreated,
  onClose,
}: {
  people: readonly Person[];
  onCreated: () => void;
  onClose: () => void;
}) {
  const [personName, setPersonName] = useState("");
  const [direction, setDirection] = useState<DebtDirection>("lent");
  const [amountText, setAmountText] = useState("");
  const [occurredAt, setOccurredAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState("");
  const [note, setNote] = useState("");
  useBackButtonClose(onClose);

  const amountTiyin = parseTiyinInput(amountText);
  const canSave = personName.trim().length > 0 && amountTiyin !== null && amountTiyin > 0;

  async function submit() {
    if (!canSave) return;
    const db = await getDb();
    const personId = await findOrCreatePersonByAlias(db, personName.trim());
    await createDebt(db, {
      personId,
      direction,
      transactionId: null,
      amountTiyin: amountTiyin!,
      occurredAt: `${occurredAt}T00:00:00.000Z`,
      dueDate: dueDate ? `${dueDate}T00:00:00.000Z` : null,
      note: note.trim() || null,
    });
    onCreated();
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal manual-dialog" onClick={(e) => e.stopPropagation()}>
        <h3>Новый долг</h3>
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
            Сумма
            <input value={amountText} onChange={(e) => setAmountText(e.target.value)} placeholder="5000" />
          </label>
          <label>
            Дата
            <input type="date" value={occurredAt} onChange={(e) => setOccurredAt(e.target.value)} />
          </label>
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
          <button type="button" disabled={!canSave} onClick={submit}>
            Сохранить
          </button>
        </div>
      </div>
    </div>
  );
}
