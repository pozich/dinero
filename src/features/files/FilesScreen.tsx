import { useCallback, useEffect, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { getDb } from "../../db/client";
import {
  listStatements,
  countCategorizedTransactions,
  deleteStatement,
  type StatementSummary,
} from "../../db/statements";
import { importStatement, type ImportResult } from "../../import/importStatement";
import { peekPeriodStart } from "../../import/peekPeriod";
import { buildReviewCandidates } from "../../review/buildReviewCandidates";
import { formatGoldenMismatch } from "./goldenMismatch";
import { StatementCard } from "./StatementCard";
import { ConfirmDialog } from "./ConfirmDialog";
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

type PendingAction = { statement: StatementSummary; kind: "delete" | "replace"; categorizedCount: number };

export function FilesScreen() {
  const [statements, setStatements] = useState<StatementSummary[]>([]);
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<string[] | null>(null);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const readOnly = useReadOnly();

  const refresh = useCallback(async () => {
    const db = await getDb();
    setStatements(await listStatements(db));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function pickAndImport(): Promise<void> {
    if (readOnly) return;
    const paths = await open({
      multiple: true,
      filters: [{ name: "Выписки", extensions: ["pdf"] }],
    });
    if (!paths) return;
    const pathList = Array.isArray(paths) ? paths : [paths];
    if (pathList.length === 0) return;

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
          const fileName = filePath.split(/[/\\]/).pop() ?? filePath;
          const periodStart = await peekPeriodStart(data.slice()).catch(() => null);
          return { fileName, data, periodStart };
        }),
      );
      files.sort((a, b) => (a.periodStart ?? "").localeCompare(b.periodStart ?? ""));

      const db = await getDb();
      const lines: string[] = [];
      let totalInserted = 0;
      for (const file of files) {
        const result = await importStatement(db, file.data, file.fileName);
        lines.push(resultMessage(result, file.fileName));
        if (result.status === "imported") totalInserted += result.inserted;
      }

      if (files.length > 1) {
        lines.push(`Итого: добавлено ${totalInserted} операций из ${files.length} файлов.`);
      }

      const candidates = await buildReviewCandidates(db);
      const transferCount = candidates.filter((c) => c.kind === "transfer").length;
      const refundCount = candidates.filter((c) => c.kind === "refund").length;
      if (transferCount + refundCount > 0) {
        lines.push(
          `Найдено ${transferCount} кандидатов в переводы, ${refundCount} в возвраты — откройте «Проверить» в шапке.`,
        );
      }

      setReport(lines);
      await refresh();
    } catch (e) {
      setReport([`Ошибка импорта: ${String(e)}`]);
    } finally {
      setBusy(false);
    }
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
    <div className="screen">
      <h2>Файлы</h2>
      <button type="button" onClick={pickAndImport} disabled={busy || readOnly}>
        {busy ? "Работаю..." : "Импортировать выписки (PDF)"}
      </button>
      {report && (
        <ul className="hint import-report">
          {report.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      )}

      <div className="receipt-grid">
        {statements.map((s) => (
          <StatementCard
            key={s.id}
            statement={s}
            onDelete={readOnly ? undefined : () => askAction(s, "delete")}
            onReplace={readOnly ? undefined : () => askAction(s, "replace")}
          />
        ))}
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
    </div>
  );
}
