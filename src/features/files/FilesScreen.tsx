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
import { StatementCard } from "./StatementCard";
import { ConfirmDialog } from "./ConfirmDialog";
import { useReadOnly } from "../../reliability/ReadOnlyContext";
import { backupBefore } from "../../reliability/backups";

function resultMessage(result: ImportResult, fileName: string): string {
  switch (result.status) {
    case "duplicate_file":
      return `${fileName}: уже загружен, пропущено`;
    case "golden_mismatch":
      return `${fileName}: итоги не сошлись (ожидали ${result.golden.expectedDelta}, получили ${result.golden.transactionsDelta}) — импорт отменён`;
    case "imported":
      return `${fileName}: добавлено ${result.inserted} операций (пропущено дублей: ${result.skippedDuplicateRows})`;
  }
}

type PendingAction = { statement: StatementSummary; kind: "delete" | "replace"; categorizedCount: number };

export function FilesScreen() {
  const [statements, setStatements] = useState<StatementSummary[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
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
    const path = await open({
      multiple: false,
      filters: [{ name: "Выписки", extensions: ["pdf"] }],
    });
    if (!path || Array.isArray(path)) return;

    setBusy(true);
    setMessage(null);
    try {
      await backupBefore("import");
      const bytes = await invoke<number[]>("read_file_bytes", { path });
      const data = new Uint8Array(bytes);
      const fileName = path.split(/[/\\]/).pop() ?? path;
      const db = await getDb();
      const result = await importStatement(db, data, fileName);
      setMessage(resultMessage(result, fileName));
      await refresh();
    } catch (e) {
      setMessage(`Ошибка импорта: ${String(e)}`);
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
        setMessage(`${statement.file_name}: удалено`);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="screen">
      <h2>Файлы</h2>
      <button type="button" onClick={pickAndImport} disabled={busy || readOnly}>
        {busy ? "Работаю..." : "Импортировать выписку (PDF)"}
      </button>
      {message && <p className="hint">{message}</p>}

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
