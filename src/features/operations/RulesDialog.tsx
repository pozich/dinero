import { useState } from "react";
import type { CategoryRule } from "../../db/categoryRules";
import type { Category } from "../../db/categories";
import { matchRule } from "./categoryRuleMatch";

const CHEAT_SHEET = [
  [".", "любой символ"],
  [".*", "любое число любых символов"],
  ["^", "начало строки"],
  ["$", "конец строки"],
  ["|", "или — «Tele2|Kcell» совпадёт с любым из двух"],
  ["\\d", "любая цифра"],
  ["[абв]", "любой символ из скобок"],
  ["(?:...)", "группа, не влияющая на совпадение"],
] as const;

export function RulesDialog({
  rules,
  categories,
  onCreate,
  onUpdate,
  onDelete,
  onMove,
  onClose,
}: {
  rules: CategoryRule[];
  categories: Category[];
  onCreate: (input: { pattern: string; caseSensitive: boolean; categoryName: string }) => void;
  onUpdate: (id: number, patch: { isActive?: boolean }) => void;
  onDelete: (id: number) => void;
  onMove: (id: number, direction: "up" | "down") => void;
  onClose: () => void;
}) {
  const [pattern, setPattern] = useState("");
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [categoryName, setCategoryName] = useState("");
  const [testText, setTestText] = useState("");
  const [patternError, setPatternError] = useState<string | null>(null);

  function checkPattern(value: string): boolean {
    try {
      new RegExp(value);
      setPatternError(null);
      return true;
    } catch (e) {
      setPatternError(String(e));
      return false;
    }
  }

  function submit() {
    if (!pattern.trim() || !categoryName.trim()) return;
    if (!checkPattern(pattern)) return;
    onCreate({ pattern, caseSensitive, categoryName: categoryName.trim() });
    setPattern("");
    setCategoryName("");
    setTestText("");
  }

  const liveMatch =
    testText && !patternError
      ? matchRule(testText, {
          pattern,
          case_sensitive: caseSensitive ? 1 : 0,
          category_id: 0,
          priority: 0,
          is_active: 1,
        })
      : null;

  return (
    <div className="modal-backdrop">
      <div className="modal rules-dialog">
        <h3>Правила авто-категоризации</h3>
        <p className="hint">
          Если описание операции совпадает с регулярным выражением — правило
          предлагает категорию. Ничего не меняется само: только по кнопке
          «Применить правила» на экране операций, с превью и галочками.
        </p>

        <table>
          <thead>
            <tr>
              <th>Регулярка</th>
              <th>Аа</th>
              <th>Категория</th>
              <th>Вкл</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rules.map((r, i) => (
              <tr key={r.id}>
                <td>
                  <code>{r.pattern}</code>
                </td>
                <td>{r.case_sensitive ? "да" : "—"}</td>
                <td>{r.category_name}</td>
                <td>
                  <input
                    type="checkbox"
                    checked={!!r.is_active}
                    onChange={(e) => onUpdate(r.id, { isActive: e.target.checked })}
                  />
                </td>
                <td className="rule-actions">
                  <button
                    type="button"
                    disabled={i === 0}
                    onClick={() => onMove(r.id, "up")}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    disabled={i === rules.length - 1}
                    onClick={() => onMove(r.id, "down")}
                  >
                    ↓
                  </button>
                  <button type="button" onClick={() => onDelete(r.id)}>
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="hint">
          Срабатывает первое правило сверху вниз, которое совпало — порядок
          меняется стрелками.
        </p>

        <h4>Новое правило</h4>
        <div className="rule-form">
          <input
            list="rule-categories"
            placeholder="Категория"
            value={categoryName}
            onChange={(e) => setCategoryName(e.target.value)}
          />
          <datalist id="rule-categories">
            {categories.map((c) => (
              <option key={c.id} value={c.name} />
            ))}
          </datalist>
          <input
            placeholder="Регулярное выражение, например Сатти"
            value={pattern}
            onChange={(e) => {
              setPattern(e.target.value);
              checkPattern(e.target.value);
            }}
          />
          <label>
            <input
              type="checkbox"
              checked={caseSensitive}
              onChange={(e) => setCaseSensitive(e.target.checked)}
            />
            учитывать регистр
          </label>
        </div>
        {patternError && <p className="hint rule-error">Регулярка не собирается: {patternError}</p>}

        <div className="rule-tester">
          <input
            placeholder="Проверить на примере описания..."
            value={testText}
            onChange={(e) => setTestText(e.target.value)}
          />
          {liveMatch !== null && (
            <span className={liveMatch ? "rule-match-yes" : "rule-match-no"}>
              {liveMatch ? "✓ совпадает" : "✗ не совпадает"}
            </span>
          )}
        </div>

        <details className="rule-cheatsheet">
          <summary>Шпаргалка по регуляркам</summary>
          <table>
            <tbody>
              {CHEAT_SHEET.map(([token, desc]) => (
                <tr key={token}>
                  <td>
                    <code>{token}</code>
                  </td>
                  <td>{desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>

        <div className="modal-actions">
          <button type="button" onClick={onClose}>
            Закрыть
          </button>
          <button type="button" onClick={submit} disabled={!pattern.trim() || !categoryName.trim()}>
            Добавить правило
          </button>
        </div>
      </div>
    </div>
  );
}
