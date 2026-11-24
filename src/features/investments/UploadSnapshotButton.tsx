import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { getDb } from "../../db/client";
import { parseHalykSnapshot } from "../../parsers/halykSnapshot";
import { importSnapshot } from "../../db/securitySnapshots";

/** SPEC-2.md 9.1 — the HTML "Выписка с лицевого счета" snapshot, uploaded
 * on its own (not through FilesScreen's PDF import, a different file
 * kind entirely). Re-uploading the same snapshot just overwrites that
 * date's holdings. */
export function UploadSnapshotButton({ onImported }: { onImported: () => void }) {
  const [message, setMessage] = useState<string | null>(null);

  async function pick() {
    const path = await open({ multiple: false, filters: [{ name: "Снимок (HTML)", extensions: ["html", "htm"] }] });
    if (!path || Array.isArray(path)) return;
    setMessage(null);
    try {
      const bytes = await invoke<number[]>("read_file_bytes", { path });
      const html = new TextDecoder("utf-8").decode(new Uint8Array(bytes));
      const parsed = parseHalykSnapshot(html);
      const db = await getDb();
      await importSnapshot(db, parsed);
      setMessage(`Снимок на ${parsed.snapshotDate.slice(0, 10)}: ${parsed.holdings.length} бумаг.`);
      onImported();
    } catch (e) {
      setMessage(`Не удалось разобрать файл: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return (
    <span className="upload-snapshot">
      <button type="button" onClick={pick}>
        Загрузить снимок...
      </button>
      {message && <span className="hint">{message}</span>}
    </span>
  );
}
