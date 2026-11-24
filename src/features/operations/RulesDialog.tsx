import { useState } from "react";
import type { CategoryRule, RuleConditionsInput, RuleSign } from "../../db/categoryRules";
import type { Category } from "../../db/categories";
import type { Account } from "../../db/accounts";
import { testPattern } from "./categoryRuleMatch";
import { parseTiyinInput, formatTiyin } from "./money";
import { useBackButtonClose } from "../../reliability/useBackButtonClose";

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

export type NewRuleInput = {
  pattern: string;
  caseSensitive: boolean;
  categoryName: string;
} & RuleConditionsInput;

function conditionsSummary(r: CategoryRule): string | null {
  const parts: string[] = [];
  if (r.account_kinds) parts.push(r.account_kinds.split(",").join(", "));
  if (r.sign) parts.push(r.sign === "expense" ? "расход" : "приход");
  if (r.min_amount_tiyin !== null) parts.push(`≥ ${formatTiyin(r.min_amount_tiyin).replace("+ ", "")}`);
  if (r.max_amount_tiyin !== null) parts.push(`≤ ${formatTiyin(r.max_amount_tiyin).replace("+ ", "")}`);
  return parts.length > 0 ? parts.join(" · ") : null;
}

export function RulesDialog({
  rules,
  categories,
  accounts,
  initialPattern,
  initialCategoryName,
  onCreate,
  onUpdate,
  onDelete,
  onMove,
  onClose,
}: {
  rules: CategoryRule[];
  categories: Category[];
  accounts: Account[];
  initialPattern?: string;
  initialCategoryName?: string;
  onCreate: (input: NewRuleInput) => void;
  onUpdate: (id: number, patch: { isActive?: boolean }) => void;
  onDelete: (id: number) => void;
  onMove: (id: number, direction: "up" | "down") => void;
  onClose: () => void;
}) {
  useBackButtonClose(onClose);
  const [pattern, setPattern] = useState(initialPattern ?? "");
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [categoryName, setCategoryName] = useState(initialCategoryName ?? "");
  const [testText, setTestText] = useState("");
  const [patternError, setPatternError] = useState<string | null>(null);
  const [accountKinds, setAccountKinds] = useState<Set<string>>(new Set());
  const [sign, setSign] = useState<RuleSign | "">("");
  const [minAmountText, setMinAmountText] = useState("");
  const [maxAmountText, setMaxAmountText] = useState("");

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

  function toggleAccount(kind: string) {
    setAccountKinds((prev) => {
      const next = new Set(prev);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });
  }

  function submit() {
    if (!pattern.trim() || !categoryName.trim()) return;
    if (!checkPattern(pattern)) return;
    onCreate({
      pattern,
      caseSensitive,
      categoryName: categoryName.trim(),
      accountKinds: [...accountKinds],
      sign: sign || null,
      minAmountTiyin: minAmountText.trim() ? Math.abs(parseTiyinInput(minAmountText) ?? 0) : null,
      maxAmountTiyin: maxAmountText.trim() ? Math.abs(parseTiyinInput(maxAmountText) ?? 0) : null,
    });
    setPattern("");
    setCategoryName("");
    setTestText("");
    setAccountKinds(new Set());
    setSign("");
    setMinAmountText("");
    setMaxAmountText("");
  }

  const liveMatch =
    testText && !patternError ? testPattern(testText, { pattern, case_sensitive: caseSensitive ? 1 : 0 }) : null;

  return (
    <div className="modal-backdrop">
      <div className="modal rules-dialog">
        <h3>Правила авто-категоризации</h3>
        <p className="hint">
          Если описание операции совпадает с регулярным выражением (и все заданные
          дополнительные условия — счёт/знак/сумма — тоже подходят) — правило
          предлагает категорию. Ничего не меняется само: только по кнопке
          «Применить правила» на экране операций, с превью и галочками.
        </p>

        <table>
          <thead>
            <tr>
              <th>Регулярка</th>
              <th>Аа</th>
              <th>Условия</th>
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
                <td className="hint">{conditionsSummary(r) ?? "—"}</td>
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

        <details className="rule-cheatsheet">
          <summary>Дополнительные условия (не обязательно)</summary>
          <div className="rule-conditions">
            <div className="rule-accounts">
              {accounts.map((a) => (
                <label key={a.kind}>
                  <input
                    type="checkbox"
                    checked={accountKinds.has(a.kind)}
                    onChange={() => toggleAccount(a.kind)}
                  />
                  {a.name}
                </label>
              ))}
            </div>
            <label>
              <select value={sign} onChange={(e) => setSign(e.target.value as RuleSign | "")}>
                <option value="">любой знак</option>
                <option value="expense">только расход</option>
                <option value="income">только приход</option>
              </select>
            </label>
            <input
              placeholder="сумма от..."
              value={minAmountText}
              onChange={(e) => setMinAmountText(e.target.value)}
            />
            <input
              placeholder="сумма до..."
              value={maxAmountText}
              onChange={(e) => setMaxAmountText(e.target.value)}
            />
          </div>
        </details>

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
