import { useState } from "react";
import { getDb } from "../../db/client";
import { addContribution } from "../../db/goalContributions";
import { parseTiyinInput } from "../operations/money";
import { useBackButtonClose } from "../../reliability/useBackButtonClose";

/** SPEC-2.md 10.2: "взносы вручную... можно забрать обратно" — a
 * withdrawal is just a contribution with a negative amount. */
export function ContributionDialog({
  goalId,
  goalName,
  onClose,
  onSaved,
}: {
  goalId: number;
  goalName: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [direction, setDirection] = useState<"deposit" | "withdraw">("deposit");
  const [amountText, setAmountText] = useState("");
  const [occurredAt, setOccurredAt] = useState(() => new Date().toISOString().slice(0, 10));
  useBackButtonClose(onClose);

  const amountTiyin = parseTiyinInput(amountText);
  const canSave = amountTiyin !== null && amountTiyin > 0;

  async function submit() {
    if (!canSave) return;
    const db = await getDb();
    await addContribution(db, goalId, direction === "deposit" ? amountTiyin! : -amountTiyin!, `${occurredAt}T00:00:00.000Z`);
    onSaved();
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>{goalName}</h3>
        <div className="manual-sign">
          <label>
            <input type="radio" checked={direction === "deposit"} onChange={() => setDirection("deposit")} />
            Взнос
          </label>
          <label>
            <input type="radio" checked={direction === "withdraw"} onChange={() => setDirection("withdraw")} />
            Забрать
          </label>
        </div>
        <div className="manual-form">
          <label>
            Сумма
            <input value={amountText} onChange={(e) => setAmountText(e.target.value)} autoFocus />
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
