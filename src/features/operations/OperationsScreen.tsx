import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { getDb } from "../../db/client";
import { buildCsv } from "../../export/exportCsv";
import { listAccounts, type Account } from "../../db/accounts";
import { listCategories, findOrCreateCategory, type Category } from "../../db/categories";
import {
  queryTransactions,
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
import { spansMultipleYears } from "./dateFormat";
import { findMatchingCategory } from "./categoryRuleMatch";
import { SplitDialog } from "./SplitDialog";
import { ApplyToSimilarDialog } from "./ApplyToSimilarDialog";
import { RulesDialog, type NewRuleInput } from "./RulesDialog";
import { ApplyRulesDialog, type RuleMatch } from "./ApplyRulesDialog";
import { ManualLinkDialog } from "./ManualLinkDialog";
import { ManualTransactionDialog, type ManualFormResult } from "./ManualTransactionDialog";
import { OperationsTable } from "./OperationsTable";
import { BulkActionBar } from "./BulkActionBar";
import { CategorySidebar } from "./CategorySidebar";
import { selectAll } from "./selection";
import { DEFAULT_COLUMNS, mergeWithDefaults, reorderColumns, toggleColumnVisibility, type ColumnConfig } from "./tableColumns";
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

type SimilarPrompt = {
  categoryId: number;
  categoryName: string;
  description: string;
  candidates: TransactionListItem[];
};

function escapeForRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

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
  const [editingId, setEditingId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [columns, setColumns] = useState<ColumnConfig[]>(() => {
    try {
      const saved = localStorage.getItem("dinero.operationsColumns");
      return saved ? mergeWithDefaults(JSON.parse(saved)) : DEFAULT_COLUMNS;
    } catch {
      return DEFAULT_COLUMNS;
    }
  });
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
  const [manualLinkFor, setManualLinkFor] = useState<{
    row: TransactionListItem;
    kind: "transfer" | "refund";
  } | null>(null);
  const [manualDialog, setManualDialog] = useState<TransactionListItem | "new" | null>(null);
  const [rulePrefill, setRulePrefill] = useState<{ pattern: string; categoryName: string } | null>(
    null,
  );
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

  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem("dinero.categorySidebarCollapsed") === "1";
    } catch {
      return false;
    }
  });
  const [sidebarRefreshToken, setSidebarRefreshToken] = useState(0);

  const refresh = useCallback(async () => {
    const db = await getDb();
    setRows(await queryTransactions(db, filters, sort));
    setSidebarRefreshToken((t) => t + 1);
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
    try {
      localStorage.setItem("dinero.operationsColumns", JSON.stringify(columns));
    } catch {
      // per-viewer convenience only — fine to lose on a private window etc.
    }
  }, [columns]);

  useEffect(() => {
    try {
      localStorage.setItem("dinero.categorySidebarCollapsed", sidebarCollapsed ? "1" : "0");
    } catch {
      // same as above — per-viewer convenience only
    }
  }, [sidebarCollapsed]);

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
          setEditingId(null);
          setSplitFor(rows[activeIndex]);
        }
        return;
      }
      const isSelectAllChord = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a";
      if (isSelectAllChord && !editingId && !splitFor && !similarPrompt && !manualDialog) {
        if (isTypingTarget(e.target)) return;
        e.preventDefault();
        setSelectedIds(selectAll(rows));
        return;
      }
      if (editingId !== null || splitFor || similarPrompt || manualDialog) return;
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
          setEditingId(rows[0].id);
        } else if (activeIndex !== null) {
          e.preventDefault();
          setEditingId(rows[activeIndex].id);
        }
      } else if (e.key.toLowerCase() === "n" && !readOnly) {
        e.preventDefault();
        setManualDialog("new");
      } else if (e.key === "Escape") {
        setSelectedIds(new Set());
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeIndex, editingId, rows, splitFor, similarPrompt, manualDialog, readOnly]);

  async function commitCategory(name: string) {
    const row = rows.find((r) => r.id === editingId);
    setEditingId(null);
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
      setSimilarPrompt({ categoryId, categoryName: name, description: row.description, candidates });
    }
    refresh();
  }

  function createRuleFromSimilar() {
    if (!similarPrompt) return;
    setRulePrefill({
      pattern: escapeForRegex(similarPrompt.description),
      categoryName: similarPrompt.categoryName,
    });
    setSimilarPrompt(null);
    setShowRules(true);
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

  async function createRule(input: NewRuleInput) {
    if (readOnly) return;
    const db = await getDb();
    const categoryId = await findOrCreateCategory(db, input.categoryName);
    await withUndo(undoStack, `Новое правило: ${input.pattern}`, RULES_TABLE_SPEC, () =>
      createCategoryRule(db, {
        pattern: input.pattern,
        caseSensitive: input.caseSensitive,
        categoryId,
        accountKinds: input.accountKinds,
        sign: input.sign,
        minAmountTiyin: input.minAmountTiyin,
        maxAmountTiyin: input.maxAmountTiyin,
      }).then(() => undefined),
    );
    setCategories(await listCategories(db));
    setRulePrefill(null);
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
      const categoryId = findMatchingCategory(
        {
          description: transaction.description,
          accountKind: transaction.account_kind,
          amountTiyin: transaction.amount_tiyin,
        },
        rules,
      );
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
    const { row, kind } = manualLinkFor;
    const db = await getDb();
    const [from, to] = row.amount_tiyin < 0 ? [row, other] : [other, row];
    const id = await confirmTransferLink(db, from.id, to.id, kind);
    const label = kind === "refund" ? "Возврат" : "Перевод";
    undoStack?.pushCreated(`${label}: ${from.description} → ${to.description}`, "transfer_links", id);
    setManualLinkFor(null);
    refresh();
  }

  function createRuleFromRow(row: TransactionListItem) {
    setRulePrefill({ pattern: escapeForRegex(row.description), categoryName: "" });
    setContextMenu(null);
    setShowRules(true);
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

  async function exportCsv(rowsToExport: TransactionListItem[] = rows) {
    const path = await save({
      defaultPath: "dinero.csv",
      filters: [{ name: "CSV", extensions: ["csv"] }],
    });
    if (!path) return;
    const csv = buildCsv(rowsToExport, categories);
    // A UTF-8 BOM so Excel on Windows detects the encoding and shows
    // Cyrillic text correctly instead of mangling it.
    const bytes = Array.from(new TextEncoder().encode("﻿" + csv));
    await invoke("write_file_bytes", { path, contents: bytes });
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

  const selectedRows = rows.filter((r) => selectedIds.has(r.id));
  const allSelectedIgnored = selectedRows.length > 0 && selectedRows.every((r) => r.is_ignored);
  const canBulkLink =
    selectedRows.length === 2 && Math.sign(selectedRows[0].amount_tiyin) !== Math.sign(selectedRows[1].amount_tiyin);

  async function bulkSetCategory(name: string) {
    if (readOnly || selectedRows.length === 0) return;
    await backupBefore("bulk_action");
    const db = await getDb();
    const categoryId = await findOrCreateCategory(db, name);
    const specs = selectedRows.map((r) => ({
      table: "splits",
      whereSql: "transaction_id = $1",
      params: [r.id],
    }));
    await withUndo(undoStack, `Категория «${name}» на ${selectedRows.length} операций`, specs, async () => {
      for (const r of selectedRows) {
        await setTransactionCategory(db, r.id, categoryId, r.amount_tiyin);
      }
    });
    setCategories(await listCategories(db));
    refresh();
  }

  async function bulkToggleIgnored() {
    if (readOnly || selectedRows.length === 0) return;
    const nextIgnored = !allSelectedIgnored;
    const db = await getDb();
    const specs = selectedRows.map((r) => ({
      table: "transactions",
      whereSql: "id = $1",
      params: [r.id],
    }));
    await withUndo(
      undoStack,
      nextIgnored ? "Не учитывать выбранное" : "Учитывать выбранное",
      specs,
      async () => {
        for (const r of selectedRows) await setTransactionIgnored(db, r.id, nextIgnored);
      },
    );
    refresh();
  }

  async function bulkLink(kind: "transfer" | "refund") {
    if (readOnly || !canBulkLink) return;
    const [a, b] = selectedRows;
    const [from, to] = a.amount_tiyin < 0 ? [a, b] : [b, a];
    const db = await getDb();
    const id = await confirmTransferLink(db, from.id, to.id, kind);
    const label = kind === "refund" ? "Возврат" : "Перевод";
    undoStack?.pushCreated(`${label}: ${from.description} → ${to.description}`, "transfer_links", id);
    setSelectedIds(new Set());
    refresh();
  }

  // SPEC-2.md Ф4: "перетащить операции на категорию = проставить" — if the
  // dragged row is part of the current multi-selection, the whole
  // selection moves with it; otherwise just that one row.
  async function handleSidebarAssign(categoryName: string, draggedId: number) {
    if (readOnly) return;
    const ids = selectedIds.has(draggedId) ? [...selectedIds] : [draggedId];
    const targetRows = rows.filter((r) => ids.includes(r.id));
    if (targetRows.length === 0) return;
    if (targetRows.length > 1) await backupBefore("bulk_action");

    const db = await getDb();
    const categoryId = await findOrCreateCategory(db, categoryName);
    const specs = targetRows.map((r) => ({
      table: "splits",
      whereSql: "transaction_id = $1",
      params: [r.id],
    }));
    await withUndo(
      undoStack,
      `Категория «${categoryName}» (перетаскивание, ${targetRows.length})`,
      specs,
      async () => {
        for (const r of targetRows) await setTransactionCategory(db, r.id, categoryId, r.amount_tiyin);
      },
    );
    setCategories(await listCategories(db));
    refresh();
  }

  const showYear = spansMultipleYears(rows.map((r) => r.occurred_at));

  return (
    <div className="screen operations-screen" ref={containerRef}>
      <h2>Категории + Операции</h2>

      <div className="operations-layout">
        <CategorySidebar
          collapsed={sidebarCollapsed}
          onToggleCollapsed={() => setSidebarCollapsed((c) => !c)}
          onAssign={handleSidebarAssign}
          refreshToken={sidebarRefreshToken}
        />
        <div className="operations-main">
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
        <button type="button" onClick={() => exportCsv()} title="Экспортирует то, что сейчас показано — с учётом фильтров">
          Экспорт CSV
        </button>
        <div className="column-toggle">
          <button type="button" title="Какие колонки показывать">
            Колонки
          </button>
          <div className="column-toggle-menu">
            {columns.map((c) => (
              <label key={c.key}>
                <input
                  type="checkbox"
                  checked={c.visible}
                  onChange={() => setColumns((cols) => toggleColumnVisibility(cols, c.key))}
                />
                {c.key === "occurred_at" && "Дата"}
                {c.key === "amount_tiyin" && "Сумма"}
                {c.key === "description" && "Описание"}
                {c.key === "category_name" && "Категория"}
              </label>
            ))}
          </div>
        </div>
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

      <OperationsTable
        rows={rows}
        categories={categories}
        columns={columns}
        onColumnsChange={setColumns}
        onReorderColumn={(from, to) => setColumns((cols) => reorderColumns(cols, from, to))}
        sort={sort}
        onSortChange={setSort}
        activeIndex={activeIndex}
        onActiveIndexChange={setActiveIndex}
        selectedIds={selectedIds}
        onSelectedIdsChange={setSelectedIds}
        editingId={editingId}
        onStartEdit={(row) => setEditingId(row.id)}
        onCommitCategory={commitCategory}
        onCancelEdit={() => setEditingId(null)}
        onContextMenu={openContextMenu}
        onSwipeLeft={(row) => setEditingId(row.id)}
        onSwipeRight={toggleIgnored}
        showYear={showYear}
        readOnly={readOnly}
      />

      {selectedIds.size > 0 && (
        <BulkActionBar
          count={selectedIds.size}
          categories={categories}
          allIgnored={allSelectedIgnored}
          canLink={canBulkLink}
          onApplyCategory={bulkSetCategory}
          onToggleIgnored={bulkToggleIgnored}
          onLink={bulkLink}
          onExport={() => exportCsv(selectedRows)}
          onClear={() => setSelectedIds(new Set())}
        />
      )}

      <p className="hint">
        {rows.length} операций.{" "}
        <span className="keyboard-hint">
          ↑/↓ — выбрать строку, Enter/двойной клик — категория, Ctrl+S — разрез, N — новая
          операция, Ctrl+A — выбрать все, Shift/Ctrl+клик — выделение, рамка мышью.
        </span>
      </p>
        </div>
      </div>

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
          onCreateRule={createRuleFromSimilar}
        />
      )}

      {showRules && (
        <RulesDialog
          rules={rules}
          categories={categories}
          accounts={accounts}
          initialPattern={rulePrefill?.pattern}
          initialCategoryName={rulePrefill?.categoryName}
          onCreate={createRule}
          onUpdate={updateRule}
          onDelete={deleteRule}
          onMove={moveRule}
          onClose={() => {
            setShowRules(false);
            setRulePrefill(null);
          }}
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
          <button
            type="button"
            onClick={() => {
              setEditingId(null);
              setSplitFor(contextMenu.row);
              setContextMenu(null);
            }}
          >
            Разрезать
          </button>
          <button type="button" onClick={() => toggleIgnored(contextMenu.row)}>
            {contextMenu.row.is_ignored ? "Учитывать" : "Не учитывать"}
          </button>
          <button
            type="button"
            onClick={() => {
              setManualLinkFor({ row: contextMenu.row, kind: "transfer" });
              setContextMenu(null);
            }}
          >
            Связать как перевод с…
          </button>
          <button
            type="button"
            onClick={() => {
              setManualLinkFor({ row: contextMenu.row, kind: "refund" });
              setContextMenu(null);
            }}
          >
            Связать как возврат с…
          </button>
          {contextMenu.linkId !== null && (
            <button type="button" onClick={() => unlink(contextMenu.linkId!)}>
              Разорвать связь
            </button>
          )}
          <button type="button" onClick={() => createRuleFromRow(contextMenu.row)}>
            Создать правило
          </button>
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
          row={manualLinkFor.row}
          kind={manualLinkFor.kind}
          onPick={manualConfirm}
          onClose={() => setManualLinkFor(null)}
        />
      )}
    </div>
  );
}
