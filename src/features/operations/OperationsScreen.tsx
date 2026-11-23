import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getDb } from "../../db/client";
import { listAccounts, type Account } from "../../db/accounts";
import { listCategories, findOrCreateCategory, type Category } from "../../db/categories";
import {
  queryTransactions,
  type SortColumn,
  type SortSpec,
  type TransactionFilters,
  type TransactionListItem,
} from "../../db/transactionsQuery";
import { setTransactionCategory, setTransactionSplits } from "../../db/transactions";
import {
  listCategoryRules,
  createCategoryRule,
  updateCategoryRule,
  deleteCategoryRule,
  moveCategoryRule,
  type CategoryRule,
} from "../../db/categoryRules";
import { formatTransactionDate, spansMultipleYears } from "./dateFormat";
import { formatTiyin } from "./money";
import { toggleSort } from "./sorting";
import { findMatchingCategory } from "./categoryRuleMatch";
import { CategoryInput } from "./CategoryInput";
import { SplitDialog } from "./SplitDialog";
import { ApplyToSimilarDialog } from "./ApplyToSimilarDialog";
import { RulesDialog } from "./RulesDialog";
import { ApplyRulesDialog, type RuleMatch } from "./ApplyRulesDialog";

const COLUMNS: { key: SortColumn; label: string }[] = [
  { key: "occurred_at", label: "Дата" },
  { key: "amount_tiyin", label: "Сумма" },
  { key: "description", label: "Описание" },
  { key: "category_name", label: "Категория" },
];

type SimilarPrompt = {
  categoryId: number;
  categoryName: string;
  candidates: TransactionListItem[];
};

export function OperationsScreen() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [rows, setRows] = useState<TransactionListItem[]>([]);
  const [search, setSearch] = useState("");
  const [accountId, setAccountId] = useState<number | "">("");
  const [onlyUncategorized, setOnlyUncategorized] = useState(false);
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [sort, setSort] = useState<SortSpec[]>([]);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [editingCategory, setEditingCategory] = useState(false);
  const [splitFor, setSplitFor] = useState<TransactionListItem | null>(null);
  const [similarPrompt, setSimilarPrompt] = useState<SimilarPrompt | null>(null);
  const [rules, setRules] = useState<CategoryRule[]>([]);
  const [showRules, setShowRules] = useState(false);
  const [ruleMatches, setRuleMatches] = useState<RuleMatch[] | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const refreshRules = useCallback(async () => {
    const db = await getDb();
    setRules(await listCategoryRules(db));
  }, []);

  const filters: TransactionFilters = useMemo(
    () => ({
      search: search.trim() || undefined,
      accountId: accountId === "" ? undefined : accountId,
      onlyUncategorized: onlyUncategorized || undefined,
      periodStart: periodStart ? `${periodStart}T00:00:00.000Z` : undefined,
      periodEnd: periodEnd ? `${periodEnd}T00:00:00.000Z` : undefined,
    }),
    [search, accountId, onlyUncategorized, periodStart, periodEnd],
  );

  const refresh = useCallback(async () => {
    const db = await getDb();
    setRows(await queryTransactions(db, filters, sort));
  }, [filters, sort]);

  useEffect(() => {
    getDb().then(async (db) => {
      setAccounts(await listAccounts(db));
      setCategories(await listCategories(db));
    });
    refreshRules();
  }, [refreshRules]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (activeIndex !== null && activeIndex >= rows.length) {
      setActiveIndex(rows.length > 0 ? rows.length - 1 : null);
    }
  }, [rows, activeIndex]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const isSaveChord = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s";
      if (isSaveChord) {
        e.preventDefault();
        if (activeIndex !== null && rows[activeIndex]) {
          setEditingCategory(false);
          setSplitFor(rows[activeIndex]);
        }
        return;
      }
      if (editingCategory || splitFor || similarPrompt) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => (i === null ? 0 : Math.min(i + 1, rows.length - 1)));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => (i === null ? 0 : Math.max(i - 1, 0)));
      } else if (e.key === "Enter") {
        if (activeIndex === null && rows.length > 0) {
          e.preventDefault();
          setActiveIndex(0);
          setEditingCategory(true);
        } else if (activeIndex !== null) {
          e.preventDefault();
          setEditingCategory(true);
        }
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeIndex, editingCategory, rows, splitFor, similarPrompt]);

  async function commitCategory(name: string) {
    const row = activeIndex !== null ? rows[activeIndex] : undefined;
    setEditingCategory(false);
    if (!row) return;

    const db = await getDb();
    const categoryId = await findOrCreateCategory(db, name);
    await setTransactionCategory(db, row.id, categoryId, row.amount_tiyin);
    setCategories(await listCategories(db));

    const candidates = (
      await queryTransactions(db, {
        exactDescription: row.description,
        onlyUncategorized: true,
        excludeId: row.id,
      })
    ).filter((c) => c.id !== row.id);

    if (candidates.length > 0) {
      setSimilarPrompt({ categoryId, categoryName: name, candidates });
    }
    refresh();
  }

  async function applySimilar(ids: number[]) {
    if (!similarPrompt) return;
    const db = await getDb();
    for (const id of ids) {
      const row = similarPrompt.candidates.find((c) => c.id === id);
      if (row) await setTransactionCategory(db, id, similarPrompt.categoryId, row.amount_tiyin);
    }
    setSimilarPrompt(null);
    refresh();
  }

  async function saveSplits(splits: { categoryId: number; amountTiyin: number }[]) {
    if (!splitFor) return;
    const db = await getDb();
    await setTransactionSplits(db, splitFor.id, splitFor.amount_tiyin, splits);
    setSplitFor(null);
    refresh();
  }

  async function createRule(input: { pattern: string; caseSensitive: boolean; categoryName: string }) {
    const db = await getDb();
    const categoryId = await findOrCreateCategory(db, input.categoryName);
    await createCategoryRule(db, {
      pattern: input.pattern,
      caseSensitive: input.caseSensitive,
      categoryId,
    });
    setCategories(await listCategories(db));
    refreshRules();
  }

  async function updateRule(id: number, patch: { isActive?: boolean }) {
    const db = await getDb();
    await updateCategoryRule(db, id, patch);
    refreshRules();
  }

  async function deleteRule(id: number) {
    const db = await getDb();
    await deleteCategoryRule(db, id);
    refreshRules();
  }

  async function moveRule(id: number, direction: "up" | "down") {
    const db = await getDb();
    await moveCategoryRule(db, id, direction);
    refreshRules();
  }

  async function openApplyRules() {
    const db = await getDb();
    const uncategorized = await queryTransactions(db, { onlyUncategorized: true });
    const categoryById = new Map(categories.map((c) => [c.id, c.name]));
    const matches: RuleMatch[] = [];
    for (const transaction of uncategorized) {
      const categoryId = findMatchingCategory(transaction.description, rules);
      if (categoryId !== null) {
        matches.push({
          transaction,
          categoryId,
          categoryName: categoryById.get(categoryId) ?? "?",
        });
      }
    }
    setRuleMatches(matches);
  }

  async function applyRules(transactionIds: number[]) {
    if (!ruleMatches) return;
    const db = await getDb();
    for (const id of transactionIds) {
      const match = ruleMatches.find((m) => m.transaction.id === id);
      if (match) {
        await setTransactionCategory(db, id, match.categoryId, match.transaction.amount_tiyin);
      }
    }
    setRuleMatches(null);
    refresh();
  }

  const showYear = spansMultipleYears(rows.map((r) => r.occurred_at));

  return (
    <div className="screen operations-screen" ref={containerRef}>
      <h2>Категории + Операции</h2>

      <div className="filters">
        <input
          placeholder="Поиск по описанию..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          value={accountId}
          onChange={(e) => setAccountId(e.target.value ? Number(e.target.value) : "")}
        >
          <option value="">Все счета</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        <label>
          <input
            type="checkbox"
            checked={onlyUncategorized}
            onChange={(e) => setOnlyUncategorized(e.target.checked)}
          />
          без категории
        </label>
        <input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
        <span>—</span>
        <input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
        <button type="button" onClick={() => setShowRules(true)}>
          Правила ({rules.length})
        </button>
        <button type="button" onClick={openApplyRules}>
          Применить правила
        </button>
      </div>

      <table>
        <thead>
          <tr>
            {COLUMNS.map((col) => {
              const priority = sort.findIndex((s) => s.column === col.key);
              const spec = priority === -1 ? null : sort[priority];
              return (
                <th
                  key={col.key}
                  className="sortable"
                  onClick={() => setSort((s) => toggleSort(s, col.key))}
                >
                  {col.label}
                  {spec && (
                    <span className="sort-badge">
                      {priority + 1}
                      {spec.direction === "asc" ? "↑" : "↓"}
                    </span>
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.id} className={i === activeIndex ? "active-row" : ""}>
              <td>{formatTransactionDate(row.occurred_at, showYear)}</td>
              <td>{formatTiyin(row.amount_tiyin)}</td>
              <td>{row.description}</td>
              <td
                className="category-cell"
                onClick={() => {
                  setActiveIndex(i);
                  setEditingCategory(true);
                }}
              >
                {i === activeIndex && editingCategory ? (
                  <CategoryInput
                    initialValue={row.category_name ?? ""}
                    categories={categories}
                    onCommit={commitCategory}
                    onCancel={() => setEditingCategory(false)}
                  />
                ) : row.split_count > 1 ? (
                  `Разрез (${row.split_count})`
                ) : (
                  (row.category_name ?? "—")
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="hint">
        {rows.length} операций.{" "}
        <span className="keyboard-hint">
          ↑/↓ — выбрать строку, Enter — категория, Ctrl+S — разрез.
        </span>
      </p>

      {splitFor && (
        <SplitDialog
          transactionAmountTiyin={splitFor.amount_tiyin}
          description={splitFor.description}
          categories={categories}
          onSave={saveSplits}
          onClose={() => setSplitFor(null)}
        />
      )}

      {similarPrompt && (
        <ApplyToSimilarDialog
          categoryName={similarPrompt.categoryName}
          candidates={similarPrompt.candidates}
          onApply={applySimilar}
          onClose={() => setSimilarPrompt(null)}
        />
      )}

      {showRules && (
        <RulesDialog
          rules={rules}
          categories={categories}
          onCreate={createRule}
          onUpdate={updateRule}
          onDelete={deleteRule}
          onMove={moveRule}
          onClose={() => setShowRules(false)}
        />
      )}

      {ruleMatches && (
        <ApplyRulesDialog matches={ruleMatches} onApply={applyRules} onClose={() => setRuleMatches(null)} />
      )}
    </div>
  );
}
