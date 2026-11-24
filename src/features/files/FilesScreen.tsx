import { useCallback, useEffect, useMemo, useState } from "react";
import { useRegisterCommands } from "../commandPalette/CommandContext";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { getDb } from "../../db/client";
import {
  listStatements,
  countCategorizedTransactions,
  deleteStatement,
  type StatementSummary,
} from "../../db/statements";
import { importStatement, type ImportResult } from "../../import/importStatement";
import { peekPeriodStart } from "../../import/peekPeriod";
import { findMergeCandidates } from "../../import/mergeManualCandidates";
import { buildReviewCandidates } from "../../review/buildReviewCandidates";
import { queryTransactions } from "../../db/transactionsQuery";
import {
  listManualTransactions,
  listTransactionsByIdsMatchable,
  mergeManualIntoImported,
} from "../../db/manualTransactions";
import { parseHalykSnapshot } from "../../parsers/halykSnapshot";
import { importSnapshot } from "../../db/securitySnapshots";
import { formatGoldenMismatch } from "./goldenMismatch";
import { StatementCard } from "./StatementCard";
import { ConfirmDialog } from "./ConfirmDialog";
import { MergeManualDialog, type DisplayMergeCandidate } from "./MergeManualDialog";
import { useReadOnly } from "../../reliability/ReadOnlyContext";
import { backupBefore } from "../../reliability/backups";

function resultMessage(result: ImportResult, fileName: string): string {
  switch (result.status) {
    case "duplicate_file":
      return `${fileName}: уже загружен, пропущено`;
    case "golden_mismatch":
      return `${fileName}: итоги не сошлись (${formatGoldenMismatch(result.golden)}) — импорт отменён`;
    case "imported":
      return `${fileName}: добавлено ${result.inserted} операций (пропущено дублей: ${result.skippedDuplicateRows})`;
  }
}

function baseName(path: string): string {
  return path.split(/[/\\]/).pop() ?? path;
}

type PendingAction = { statement: StatementSummary; kind: "delete" | "replace"; categorizedCount: number };

export function FilesScreen() {
  const [statements, setStatements] = useState<StatementSummary[]>([]);
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<string[] | null>(null);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [mergeCandidates, setMergeCandidates] = useState<DisplayMergeCandidate[] | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const readOnly = useReadOnly();

  useRegisterCommands(
    "files",
    useMemo(
      () => [{ id: "files:import", label: "Импортировать выписки", run: () => pickAndImport() }],
      [],
    ),
  );

  const refresh = useCallback(async () => {
    const db = await getDb();
    setStatements(await listStatements(db));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // SPEC-2.md: перетаскивание файлов PDF-выписок и HTML-снимков прямо в
  // окно. Tauri отдаёт настоящие пути через свой собственный drag-drop
  // API (не HTML5 DataTransfer.files, который в webkit2gtk путей не даёт).
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    getCurrentWebview()
      .onDragDropEvent((event) => {
        if (event.payload.type === "enter" || event.payload.type === "over") {
          setDragActive(true);
        } else if (event.payload.type === "leave") {
          setDragActive(false);
        } else if (event.payload.type === "drop") {
          setDragActive(false);
          handleDroppedPaths(event.payload.paths);
        }
      })
      .then((fn) => {
        unlisten = fn;
      });
    return () => unlisten?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readOnly]);

  async function handleDroppedPaths(paths: string[]): Promise<void> {
    if (readOnly) return;
    const pdfPaths = paths.filter((p) => p.toLowerCase().endsWith(".pdf"));
    const htmlPaths = paths.filter((p) => /\.html?$/i.test(p));
    if (pdfPaths.length > 0) await importFromPaths(pdfPaths);
    if (htmlPaths.length > 0) await importSnapshotsFromPaths(htmlPaths);
  }

  async function importSnapshotsFromPaths(paths: string[]): Promise<void> {
    const db = await getDb();
    const lines: string[] = [];
    for (const path of paths) {
      try {
        const bytes = await invoke<number[]>("read_file_bytes", { path });
        const html = new TextDecoder("utf-8").decode(new Uint8Array(bytes));
        const parsed = parseHalykSnapshot(html);
        await importSnapshot(db, parsed);
        lines.push(`${baseName(path)}: снимок на ${parsed.snapshotDate.slice(0, 10)}, ${parsed.holdings.length} бумаг`);
      } catch (e) {
        lines.push(`${baseName(path)}: не удалось разобрать как снимок (${e instanceof Error ? e.message : String(e)})`);
      }
    }
    setReport((prev) => [...(prev ?? []), ...lines]);
  }

  async function pickAndImport(): Promise<void> {
    if (readOnly) return;
    const paths = await open({
      multiple: true,
      filters: [{ name: "Выписки", extensions: ["pdf"] }],
    });
    if (!paths) return;
    const pathList = Array.isArray(paths) ? paths : [paths];
    if (pathList.length === 0) return;
    await importFromPaths(pathList);
  }

  async function importFromPaths(pathList: string[]): Promise<void> {
    setBusy(true);
    setReport(null);
    try {
      await backupBefore("import");

      // Period order first (SPEC-2.md 3.3) — reading each file into memory
      // and peeking its period before actually importing any of them.
      const files = await Promise.all(
        pathList.map(async (filePath) => {
          const bytes = await invoke<number[]>("read_file_bytes", { path: filePath });
          const data = new Uint8Array(bytes);
          const fileName = baseName(filePath);
          const periodStart = await peekPeriodStart(data.slice()).catch(() => null);
          return { fileName, data, periodStart };
        }),
      );
      files.sort((a, b) => (a.periodStart ?? "").localeCompare(b.periodStart ?? ""));

      const db = await getDb();
      const lines: string[] = [];
      let totalInserted = 0;
      const allInsertedIds: number[] = [];
      for (const file of files) {
        const result = await importStatement(db, file.data, file.fileName);
        lines.push(resultMessage(result, file.fileName));
        if (result.status === "imported") {
          totalInserted += result.inserted;
          allInsertedIds.push(...result.insertedIds);
        }
      }

      if (files.length > 1) {
        lines.push(`Итого: добавлено ${totalInserted} операций из ${files.length} файлов.`);
      }

      const candidates = await buildReviewCandidates(db);
      const transferCount = candidates.filter((c) => c.kind === "transfer").length;
      const refundCount = candidates.filter((c) => c.kind === "refund").length;
      if (transferCount + refundCount > 0) {
        lines.push(
          `Найдено ${transferCount} кандидатов в переводы, ${refundCount} в возвраты — откройте «Проверить» на вкладке «Данные».`,
        );
      }

      // SPEC-2.md 4.1: "это та же операция?" — check the newly-inserted
      // rows against existing manual entries.
      if (allInsertedIds.length > 0) {
        const manualPool = await listManualTransactions(db);
        const importedPool = await listTransactionsByIdsMatchable(db, allInsertedIds);
        const merges = findMergeCandidates(manualPool, importedPool);
        if (merges.length > 0) {
          const displayIds = [...new Set(merges.flatMap((m) => [m.manualId, m.importedId]))];
          const displayRows = await queryTransactions(db, { ids: displayIds });
          const byId = new Map(displayRows.map((r) => [r.id, r]));
          const displayCandidates = merges
            .map((m) => ({
              manualId: m.manualId,
              importedId: m.importedId,
              manual: byId.get(m.manualId),
              imported: byId.get(m.importedId),
            }))
            .filter((c): c is DisplayMergeCandidate => !!c.manual && !!c.imported);
          if (displayCandidates.length > 0) setMergeCandidates(displayCandidates);
        }
      }

      setReport((prev) => [...(prev ?? []), ...lines]);
      await refresh();
    } catch (e) {
      setReport((prev) => [...(prev ?? []), `Ошибка импорта: ${String(e)}`]);
    } finally {
      setBusy(false);
    }
  }

  async function applyMerges(chosen: DisplayMergeCandidate[]) {
    const db = await getDb();
    for (const c of chosen) {
      await mergeManualIntoImported(db, c.manualId, c.importedId);
    }
    setMergeCandidates(null);
    await refresh();
  }

  async function askAction(statement: StatementSummary, kind: "delete" | "replace") {
    if (readOnly) return;
    const db = await getDb();
    const categorizedCount = await countCategorizedTransactions(db, statement.id);
    setPending({ statement, kind, categorizedCount });
  }

  async function confirmPending() {
    if (!pending) return;
    const { statement, kind } = pending;
    setPending(null);
    setBusy(true);
    try {
      await backupBefore("delete_statement");
      const db = await getDb();
      await deleteStatement(db, statement.id);
      await refresh();
      if (kind === "replace") {
        await pickAndImport();
      } else {
        setReport([`${statement.file_name}: удалено`]);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`screen ${dragActive ? "drag-active" : ""}`}>
      <h2>Файлы</h2>
      <p className="hint">
        Перетащите сюда PDF-выписки (можно сразу несколько) или HTML-снимок
        брокерского счёта Halyk — либо нажмите на пустую карточку ниже.
      </p>
      {report && (
        <ul className="hint import-report">
          {report.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      )}

      <div className="statement-grid">
        {statements.map((s) => (
          <StatementCard
            key={s.id}
            statement={s}
            onDelete={readOnly ? undefined : () => askAction(s, "delete")}
            onReplace={readOnly ? undefined : () => askAction(s, "replace")}
          />
        ))}
        <button
          type="button"
          className="statement-card statement-card-add"
          onClick={pickAndImport}
          disabled={busy || readOnly}
        >
          <span className="statement-card-add-icon">+</span>
          <span>{busy ? "Работаю..." : "Добавить выписку"}</span>
        </button>
      </div>

      {pending && (
        <ConfirmDialog
          title={pending.kind === "delete" ? "Удалить выписку?" : "Заменить выписку?"}
          message={
            pending.categorizedCount > 0
              ? `${pending.categorizedCount} операций этой выписки уже разложены по категориям — они тоже будут удалены.`
              : "У операций этой выписки ещё нет категорий."
          }
          confirmLabel={pending.kind === "delete" ? "Удалить" : "Удалить и выбрать новый файл"}
          onConfirm={confirmPending}
          onCancel={() => setPending(null)}
        />
      )}

      {mergeCandidates && (
        <MergeManualDialog
          candidates={mergeCandidates}
          onApply={applyMerges}
          onClose={() => setMergeCandidates(null)}
        />
      )}
    </div>
  );
}
