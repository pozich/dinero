import { useCallback, useEffect, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { getDb } from "../../db/client";
import { listStatements, type StatementRow } from "../../db/statements";
import { importStatement, type ImportResult } from "../../import/importStatement";

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

export function FilesScreen() {
  const [statements, setStatements] = useState<StatementRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const db = await getDb();
    setStatements(await listStatements(db));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleImport() {
    const path = await open({
      multiple: false,
      filters: [{ name: "Выписки", extensions: ["pdf"] }],
    });
    if (!path || Array.isArray(path)) return;

    setBusy(true);
    setMessage(null);
    try {
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

  return (
    <div className="screen">
      <h2>Файлы</h2>
      <button type="button" onClick={handleImport} disabled={busy}>
        {busy ? "Импортирую..." : "Импортировать выписку (PDF)"}
      </button>
      {message && <p className="hint">{message}</p>}

      <table>
        <thead>
          <tr>
            <th>Банк</th>
            <th>Файл</th>
            <th>Период</th>
            <th>Загружен</th>
          </tr>
        </thead>
        <tbody>
          {statements.map((s) => (
            <tr key={s.id}>
              <td>{s.bank}</td>
              <td>{s.file_name}</td>
              <td>
                {s.period_start.slice(0, 10)} — {s.period_end.slice(0, 10)}
              </td>
              <td>{s.imported_at.slice(0, 10)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
