import { useState } from "react";
import type { Category } from "../../db/categories";

/** SPEC-2.md Ф4: appears once anything is multi-selected — category, link
 * (only when exactly two rows of opposite sign are selected), "не
 * учитывать", export selected. */
export function BulkActionBar({
  count,
  categories,
  allIgnored,
  canLink,
  onApplyCategory,
  onToggleIgnored,
  onLink,
  onExport,
  onClear,
}: {
  count: number;
  categories: Category[];
  allIgnored: boolean;
  canLink: boolean;
  onApplyCategory: (name: string) => void;
  onToggleIgnored: () => void;
  onLink: (kind: "transfer" | "refund") => void;
  onExport: () => void;
  onClear: () => void;
}) {
  const [categoryName, setCategoryName] = useState("");

  function submitCategory() {
    if (!categoryName.trim()) return;
    onApplyCategory(categoryName.trim());
    setCategoryName("");
  }

  return (
    <div className="bulk-action-bar">
      <span className="hint">Выбрано: {count}</span>
      <input
        list="bulk-categories"
        placeholder="Категория для всех..."
        value={categoryName}
        onChange={(e) => setCategoryName(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submitCategory()}
      />
      <datalist id="bulk-categories">
        {categories.map((c) => (
          <option key={c.id} value={c.name} />
        ))}
      </datalist>
      <button type="button" disabled={!categoryName.trim()} onClick={submitCategory}>
        Применить
      </button>
      <button type="button" onClick={onToggleIgnored}>
        {allIgnored ? "Учитывать" : "Не учитывать"}
      </button>
      <button type="button" disabled={!canLink} title="Доступно для ровно двух операций с разным знаком" onClick={() => onLink("transfer")}>
        Связать как перевод
      </button>
      <button type="button" disabled={!canLink} onClick={() => onLink("refund")}>
        Связать как возврат
      </button>
      <button type="button" onClick={onExport}>
        Экспорт выбранного
      </button>
      <button type="button" onClick={onClear}>
        Снять выделение
      </button>
    </div>
  );
}
