import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
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
import { ManualLinkDialog } from "./ManualLinkDialog";
import { ManualTransactionDialog, type ManualFormResult } from "./ManualTransactionDialog";
import { useUndoStack } from "../../undo/UndoContext";
import { withUndo } from "../../undo/undoStack";
import { useReadOnly } from "../../reliability/ReadOnlyContext";
import { backupBefore } from "../../reliability/backups";
import {
  confirmTransferLink,
  unlinkTransferLink,
  listConfirmedLinksForTransaction,
} from "../../db/transferLinks";
import {
  insertManualTransaction,
  updateManualTransaction,
  deleteManualTransaction,
} from "../../db/manualTransactions";
import { setTransactionNote, setTransactionIgnored } from "../../db/transactions";

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable
  );
}

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
  const [contextMenu, setContextMenu] = useState<{
    row: TransactionListItem;
    x: number;
    y: number;
    linkId: number | null;
  } | null>(null);
  const [manualLinkFor, setManualLinkFor] = useState<TransactionListItem | null>(null);
  const [manualDialog, setManualDialog] = useState<TransactionListItem | "new" | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const undoStack = useUndoStack();
  const readOnly = useReadOnly();

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
        if (!readOnly && activeIndex !== null && rows[activeIndex]) {
          setEditingCategory(false);
          setSplitFor(rows[activeIndex]);
        }
        return;
      }
      if (editingCategory || splitFor || similarPrompt || manualDialog) return;
      if (isTypingTarget(e.target)) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => (i === null ? 0 : Math.min(i + 1, rows.length - 1)));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => (i === null ? 0 : Math.max(i - 1, 0)));
      } else if (e.key === "Enter" && !readOnly) {
        if (activeIndex === null && rows.length > 0) {
          e.preventDefault();
          setActiveIndex(0);
          setEditingCategory(true);
        } else if (activeIndex !== null) {
          e.preventDefault();
          setEditingCategory(true);
        }
      } else if (e.key.toLowerCase() === "n" && !readOnly) {
        e.preventDefault();
        setManualDialog("new");
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeIndex, editingCategory, rows, splitFor, similarPrompt, manualDialog, readOnly]);

  async function commitCategory(name: string) {
    const row = activeIndex !== null ? rows[activeIndex] : undefined;
    setEditingCategory(false);
    if (!row || readOnly) return;

    const db = await getDb();
    const categoryId = await findOrCreateCategory(db, name);
    await withUndo(
      undoStack,
      `Категория: ${row.description}`,
      [{ table: "splits", whereSql: "transaction_id = $1", params: [row.id] }],
      () => setTransactionCategory(db, row.id, categoryId, row.amount_tiyin),
    );
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
    if (!similarPrompt || readOnly) return;
    await backupBefore("bulk_action");
    const db = await getDb();
    const specs = ids.map((id) => ({
      table: "splits",
      whereSql: "transaction_id = $1",
      params: [id],
    }));
    await withUndo(
      undoStack,
      `Применить категорию «${similarPrompt.categoryName}» к похожим (${ids.length})`,
      specs,
      async () => {
        for (const id of ids) {
          const row = similarPrompt.candidates.find((c) => c.id === id);
          if (row) await setTransactionCategory(db, id, similarPrompt.categoryId, row.amount_tiyin);
        }
      },
    );
    setSimilarPrompt(null);
    refresh();
  }

  async function saveSplits(splits: { categoryId: number; amountTiyin: number }[]) {
    if (!splitFor || readOnly) return;
    const db = await getDb();
    await withUndo(
      undoStack,
      `Разрез: ${splitFor.description}`,
      [{ table: "splits", whereSql: "transaction_id = $1", params: [splitFor.id] }],
      () => setTransactionSplits(db, splitFor.id, splitFor.amount_tiyin, splits),
    );
    setSplitFor(null);
    refresh();
  }

  // All category_rules mutations snapshot the whole (small) table rather
  // than computing which row(s) are affected (moveRule swaps a neighbour
  // whose id we'd otherwise have to look up twice) — one undo step always
  // restores the table to exactly what it was.
  const RULES_TABLE_SPEC = [{ table: "category_rules", whereSql: "1=1", params: [] }];

  async function createRule(input: { pattern: string; caseSensitive: boolean; categoryName: string }) {
    if (readOnly) return;
    const db = await getDb();
    const categoryId = await findOrCreateCategory(db, input.categoryName);
    await withUndo(undoStack, `Новое правило: ${input.pattern}`, RULES_TABLE_SPEC, () =>
      createCategoryRule(db, {
        pattern: input.pattern,
        caseSensitive: input.caseSensitive,
        categoryId,
      }).then(() => undefined),
    );
    setCategories(await listCategories(db));
    refreshRules();
  }

  async function updateRule(id: number, patch: { isActive?: boolean }) {
    if (readOnly) return;
    const db = await getDb();
    await withUndo(undoStack, "Изменение правила", RULES_TABLE_SPEC, () =>
      updateCategoryRule(db, id, patch),
    );
    refreshRules();
  }

  async function deleteRule(id: number) {
    if (readOnly) return;
    const db = await getDb();
    await withUndo(undoStack, "Удаление правила", RULES_TABLE_SPEC, () => deleteCategoryRule(db, id));
    refreshRules();
  }

  async function moveRule(id: number, direction: "up" | "down") {
    if (readOnly) return;
    const db = await getDb();
    await withUndo(undoStack, "Порядок правил", RULES_TABLE_SPEC, () =>
      moveCategoryRule(db, id, direction),
    );
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
    if (!ruleMatches || readOnly) return;
    await backupBefore("apply_rules");
    const db = await getDb();
    const specs = transactionIds.map((id) => ({
      table: "splits",
      whereSql: "transaction_id = $1",
      params: [id],
    }));
    await withUndo(
      undoStack,
      `Применить правила (${transactionIds.length})`,
      specs,
      async () => {
        for (const id of transactionIds) {
          const match = ruleMatches.find((m) => m.transaction.id === id);
          if (match) {
            await setTransactionCategory(db, id, match.categoryId, match.transaction.amount_tiyin);
          }
        }
      },
    );
    setRuleMatches(null);
    refresh();
  }

  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    window.addEventListener("click", close);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [contextMenu]);

  async function openContextMenu(e: MouseEvent, row: TransactionListItem) {
    e.preventDefault();
    if (readOnly) return;
    const db = await getDb();
    const links = await listConfirmedLinksForTransaction(db, row.id);
    setContextMenu({ row, x: e.clientX, y: e.clientY, linkId: links[0]?.id ?? null });
  }

  async function unlink(linkId: number) {
    const db = await getDb();
    await withUndo(
      undoStack,
      "Разрыв связи",
      [{ table: "transfer_links", whereSql: "id = $1", params: [linkId] }],
      () => unlinkTransferLink(db, linkId),
    );
    setContextMenu(null);
    refresh();
  }

  async function manualConfirm(other: TransactionListItem) {
    if (!manualLinkFor) return;
    const db = await getDb();
    const [from, to] = manualLinkFor.amount_tiyin < 0 ? [manualLinkFor, other] : [other, manualLinkFor];
    const id = await confirmTransferLink(db, from.id, to.id, "transfer");
    undoStack?.pushCreated(`Перевод: ${from.description} → ${to.description}`, "transfer_links", id);
    setManualLinkFor(null);
    refresh();
  }

  async function saveManual(result: ManualFormResult) {
    const db = await getDb();

    if (manualDialog === "new") {
      const txId = await insertManualTransaction(db, {
        accountId: result.accountId,
        occurredAt: result.occurredAt,
        amountTiyin: result.amountTiyin,
        description: result.description,
        note: result.note || null,
      });
      const createdEntries: { table: string; id: number }[] = [{ table: "transactions", id: txId }];

      if (result.isIgnored) await setTransactionIgnored(db, txId, true);
      if (result.categoryName) {
        const categoryId = await findOrCreateCategory(db, result.categoryName);
        await setTransactionCategory(db, txId, categoryId, result.amountTiyin);
        const [split] = await db.select<{ id: number }[]>(
          "SELECT id FROM splits WHERE transaction_id = $1",
          [txId],
        );
        if (split) createdEntries.push({ table: "splits", id: split.id });
      }

      undoStack?.pushCreatedMany(`Новая операция: ${result.description}`, createdEntries);
      setCategories(await listCategories(db));
      setManualDialog(null);
      refresh();
      return;
    }

    const row = manualDialog;
    if (!row) return;

    await withUndo(
      undoStack,
      `Операция: ${row.description}`,
      [
        { table: "transactions", whereSql: "id = $1", params: [row.id] },
        { table: "splits", whereSql: "transaction_id = $1", params: [row.id] },
      ],
      async () => {
        if (row.is_manual) {
          await updateManualTransaction(db, row.id, {
            accountId: result.accountId,
            occurredAt: result.occurredAt,
            amountTiyin: result.amountTiyin,
            description: result.description,
            note: result.note || null,
          });
        } else {
          await setTransactionNote(db, row.id, result.note || null);
        }
        await setTransactionIgnored(db, row.id, result.isIgnored);
        if (result.categoryName) {
          const categoryId = await findOrCreateCategory(db, result.categoryName);
          await setTransactionCategory(db, row.id, categoryId, result.amountTiyin);
        }
      },
    );
    setCategories(await listCategories(db));
    setManualDialog(null);
    refresh();
  }

  async function deleteManualRow() {
    if (!manualDialog || manualDialog === "new" || !manualDialog.is_manual) return;
    const row = manualDialog;
    const db = await getDb();
    await withUndo(
      undoStack,
      `Удалить операцию: ${row.description}`,
      [
        { table: "transactions", whereSql: "id = $1", params: [row.id] },
        { table: "splits", whereSql: "transaction_id = $1", params: [row.id] },
        {
          table: "transfer_links",
          whereSql: "from_transaction_id = $1 OR to_transaction_id = $1",
          params: [row.id],
        },
      ],
      () => deleteManualTransaction(db, row.id),
    );
    setManualDialog(null);
    refresh();
  }

  async function toggleIgnored(row: TransactionListItem) {
    const db = await getDb();
    await withUndo(
      undoStack,
      row.is_ignored ? "Учитывать" : "Не учитывать",
      [{ table: "transactions", whereSql: "id = $1", params: [row.id] }],
      () => setTransactionIgnored(db, row.id, !row.is_ignored),
    );
    setContextMenu(null);
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
        <button type="button" onClick={openApplyRules} disabled={readOnly}>
          Применить правила
        </button>
        <button
          type="button"
          className="manual-add-button"
          title="Новая операция (N)"
          disabled={readOnly}
          onClick={() => setManualDialog("new")}
        >
          +
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
            <tr
              key={row.id}
              className={[
                i === activeIndex ? "active-row" : "",
                row.is_ignored ? "ignored-row" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onContextMenu={(e) => openContextMenu(e, row)}
            >
              <td>{formatTransactionDate(row.occurred_at, showYear)}</td>
              <td>{formatTiyin(row.amount_tiyin)}</td>
              <td>
                {!!row.is_manual && (
                  <span className="manual-icon" title="Ручная операция">
                    ●
                  </span>
                )}
                {row.description}
              </td>
              <td
                className="category-cell"
                onClick={() => {
                  if (readOnly) return;
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
          ↑/↓ — выбрать строку, Enter — категория, Ctrl+S — разрез, N — новая операция.
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

      {contextMenu && (
        <div
          className="context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => {
              setManualDialog(contextMenu.row);
              setContextMenu(null);
            }}
          >
            Изменить
          </button>
          <button type="button" onClick={() => toggleIgnored(contextMenu.row)}>
            {contextMenu.row.is_ignored ? "Учитывать" : "Не учитывать"}
          </button>
          <button
            type="button"
            onClick={() => {
              setManualLinkFor(contextMenu.row);
              setContextMenu(null);
            }}
          >
            Связать как перевод с…
          </button>
          {contextMenu.linkId !== null && (
            <button type="button" onClick={() => unlink(contextMenu.linkId!)}>
              Разорвать связь
            </button>
          )}
        </div>
      )}

      {manualDialog && (
        <ManualTransactionDialog
          row={manualDialog === "new" ? undefined : manualDialog}
          accounts={accounts}
          categories={categories}
          onSave={saveManual}
          onDelete={
            manualDialog !== "new" && manualDialog.is_manual ? deleteManualRow : undefined
          }
          onClose={() => setManualDialog(null)}
        />
      )}

      {manualLinkFor && (
        <ManualLinkDialog
          row={manualLinkFor}
          onPick={manualConfirm}
          onClose={() => setManualLinkFor(null)}
        />
      )}
    </div>
  );
}
