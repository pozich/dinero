import { useState } from "react";
import { getDb } from "../../db/client";
import { findOrCreateCategory, type Category } from "../../db/categories";
import { forgiveDebt } from "../../db/debts";
import { formatTiyin } from "../operations/money";
import { useBackButtonClose } from "../../reliability/useBackButtonClose";

/** SPEC-2.md 8: "простил долг → остаток превращается в расход с выбранной
 * категорией (по умолчанию «Подарки»)". */
export function ForgiveDebtDialog({
  debtId,
  personName,
  remainingTiyin,
  categories,
  onForgiven,
  onClose,
}: {
  debtId: number;
  personName: string;
  remainingTiyin: number;
  categories: readonly Category[];
  onForgiven: () => void;
  onClose: () => void;
}) {
  const [categoryName, setCategoryName] = useState("Подарки");
  useBackButtonClose(onClose);

  async function submit() {
    const db = await getDb();
    const categoryId = await findOrCreateCategory(db, categoryName.trim() || "Подарки");
    await forgiveDebt(db, debtId, remainingTiyin, categoryId, `Простил долг: ${personName}`);
    onForgiven();
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Списать долг</h3>
        <p className="hint">
          {personName}: {formatTiyin(remainingTiyin)} станет расходом.
        </p>
        <div className="manual-form">
          <label>
            Категория
            <input
              value={categoryName}
              onChange={(e) => setCategoryName(e.target.value)}
              list="forgive-debt-categories"
            />
            <datalist id="forgive-debt-categories">
              {categories.map((c) => (
                <option key={c.id} value={c.name} />
              ))}
            </datalist>
          </label>
        </div>
        <div className="modal-actions">
          <button type="button" onClick={onClose}>
            Отмена
          </button>
          <button type="button" onClick={submit}>
            Списать
          </button>
        </div>
      </div>
    </div>
  );
}
