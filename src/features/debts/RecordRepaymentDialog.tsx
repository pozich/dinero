import { useState } from "react";
import { getDb } from "../../db/client";
import { recordRepayment } from "../../db/debts";
import { formatTiyin, parseTiyinInput } from "../operations/money";
import { useBackButtonClose } from "../../reliability/useBackButtonClose";

/** SPEC-2.md 8's "ручной возврат наличными" — not tied to any transaction. */
export function RecordRepaymentDialog({
  debtId,
  personName,
  remainingTiyin,
  onRecorded,
  onClose,
}: {
  debtId: number;
  personName: string;
  remainingTiyin: number;
  onRecorded: () => void;
  onClose: () => void;
}) {
  const [amountText, setAmountText] = useState(String(remainingTiyin / 100));
  const [occurredAt, setOccurredAt] = useState(() => new Date().toISOString().slice(0, 10));
  useBackButtonClose(onClose);

  const amountTiyin = parseTiyinInput(amountText);
  const canSave = amountTiyin !== null && amountTiyin > 0;

  async function submit() {
    if (!canSave) return;
    const db = await getDb();
    await recordRepayment(db, debtId, null, amountTiyin!, `${occurredAt}T00:00:00.000Z`);
    onRecorded();
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Возврат от {personName}</h3>
        <p className="hint">Осталось: {formatTiyin(remainingTiyin)}</p>
        <div className="manual-form">
          <label>
            Сумма
            <input value={amountText} onChange={(e) => setAmountText(e.target.value)} />
          </label>
          <label>
            Дата
            <input type="date" value={occurredAt} onChange={(e) => setOccurredAt(e.target.value)} />
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
