import { useState } from "react";
import { getDb } from "../../db/client";
import { createGoal, updateGoal, type Goal, type GoalLocationType } from "../../db/goals";
import type { Account } from "../../db/accounts";
import { parseTiyinInput } from "../operations/money";
import { useBackButtonClose } from "../../reliability/useBackButtonClose";

/** SPEC-2.md 10.1/10.2: название, сумма, срок, иконка, заметка, и где
 * лежат деньги (счёт/конверт/портфель). */
export function NewGoalDialog({
  goal,
  accounts,
  onClose,
  onSaved,
}: {
  goal: Goal | null;
  accounts: readonly Account[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(goal?.name ?? "");
  const [amountText, setAmountText] = useState(goal ? String(goal.amountTiyin / 100) : "");
  const [deadline, setDeadline] = useState(goal?.deadline?.slice(0, 10) ?? "");
  const [icon, setIcon] = useState(goal?.icon ?? "");
  const [note, setNote] = useState(goal?.note ?? "");
  const [locationType, setLocationType] = useState<GoalLocationType>(goal?.locationType ?? "envelope");
  const [locationAccountId, setLocationAccountId] = useState<string>(goal?.locationAccountId ? String(goal.locationAccountId) : "");
  const [depositRateText, setDepositRateText] = useState(goal?.depositRatePercent ? String(goal.depositRatePercent) : "");
  useBackButtonClose(onClose);

  const amountTiyin = parseTiyinInput(amountText);
  const canSave = name.trim().length > 0 && amountTiyin !== null && amountTiyin > 0 && (locationType !== "account" || !!locationAccountId);

  async function submit() {
    if (!canSave) return;
    const db = await getDb();
    const input = {
      name: name.trim(),
      amountTiyin: amountTiyin!,
      deadline: deadline ? `${deadline}T00:00:00.000Z` : null,
      icon: icon.trim() || null,
      note: note.trim() || null,
      locationAccountId: locationType === "account" ? Number(locationAccountId) : null,
      depositRatePercent: depositRateText ? Number(depositRateText) : null,
    };
    if (goal) {
      await updateGoal(db, goal.id, input);
    } else {
      await createGoal(db, { ...input, locationType });
    }
    onSaved();
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal manual-dialog" onClick={(e) => e.stopPropagation()}>
        <h3>{goal ? "Изменить цель" : "Новая цель"}</h3>
        <div className="manual-form">
          <label>
            Название
            <input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </label>
          <label>
            Сумма
            <input value={amountText} onChange={(e) => setAmountText(e.target.value)} placeholder="1000000" />
          </label>
          <label>
            Срок (необязательно)
            <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
          </label>
          <label>
            Иконка (эмодзи, необязательно)
            <input value={icon} onChange={(e) => setIcon(e.target.value)} maxLength={4} />
          </label>
          {!goal && (
            <div className="manual-sign">
              <label>
                <input type="radio" checked={locationType === "envelope"} onChange={() => setLocationType("envelope")} />
                Конверт
              </label>
              <label>
                <input type="radio" checked={locationType === "account"} onChange={() => setLocationType("account")} />
                Счёт
              </label>
              <label>
                <input type="radio" checked={locationType === "portfolio"} onChange={() => setLocationType("portfolio")} />
                Портфель
              </label>
            </div>
          )}
          {locationType === "account" && (
            <label>
              Счёт
              <select value={locationAccountId} onChange={(e) => setLocationAccountId(e.target.value)}>
                <option value="">Выбрать...</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label>
            Ставка депозита, % годовых (если применимо)
            <input value={depositRateText} onChange={(e) => setDepositRateText(e.target.value)} placeholder="14" />
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
