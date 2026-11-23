import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { getLockConflict, resolveLockConflict, type LockInfo } from "./lock";
import { useSetReadOnly } from "./ReadOnlyContext";

function formatSince(iso: string): string {
  try {
    return new Date(iso).toLocaleString("ru-RU");
  } catch {
    return iso;
  }
}

export function LockConflictDialog() {
  const [conflict, setConflict] = useState<LockInfo | null>(null);
  const setReadOnly = useSetReadOnly();

  useEffect(() => {
    getLockConflict()
      .then(setConflict)
      .catch(() => {});
  }, []);

  if (!conflict) return null;

  async function choose(choice: "readonly" | "anyway" | "exit") {
    await resolveLockConflict(choice);
    if (choice === "exit") {
      await getCurrentWindow().close();
      return;
    }
    if (choice === "readonly") {
      setReadOnly(true);
    }
    setConflict(null);
  }

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h3>База уже открыта в другом месте</h3>
        <p className="hint">
          Открыта на «{conflict.device}» с {formatSince(conflict.started_at)}. Запись
          с двух мест одновременно может повредить файл — Syncthing не умеет
          мержить SQLite.
        </p>
        <div className="modal-actions">
          <button type="button" onClick={() => choose("exit")}>
            Выйти
          </button>
          <button type="button" onClick={() => choose("readonly")}>
            Только чтение
          </button>
          <button type="button" onClick={() => choose("anyway")}>
            Всё равно открыть
          </button>
        </div>
      </div>
    </div>
  );
}
