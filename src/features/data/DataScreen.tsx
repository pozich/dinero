import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { getDb } from "../../db/client";
import { listBackups, restoreBackup, type BackupMeta } from "../../reliability/backups";
import { openLogsFolder } from "../../reliability/errorLog";
import { CategoriesScreen } from "../categories/CategoriesScreen";

type Account = {
  id: number;
  name: string;
  kind: string;
  is_transit: number;
};

type Category = {
  id: number;
  name: string;
  parent_id: number | null;
  is_system: number;
};

function vaultFolderFromDbUrl(dbUrl: string): string {
  const path = dbUrl.replace(/^sqlite:/, "");
  return path.replace(/[/\\]dinero\.db$/, "");
}

const REASON_LABELS: Record<string, string> = {
  startup: "запуск",
  import: "перед импортом",
  delete_statement: "перед удалением выписки",
  bulk_action: "перед массовым применением",
  apply_rules: "перед применением правил",
  before_restore: "перед восстановлением",
};

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

export function DataScreen() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [vaultPath, setVaultPath] = useState<string | null>(null);
  const [vaultMessage, setVaultMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [backups, setBackups] = useState<BackupMeta[]>([]);
  const [backupMessage, setBackupMessage] = useState<string | null>(null);
  const [showCategories, setShowCategories] = useState(false);

  const refreshBackups = useCallback(() => {
    listBackups().then(setBackups).catch(() => {});
  }, []);

  const refreshCategories = useCallback(async () => {
    const db = await getDb();
    setCategories(await db.select<Category[]>("SELECT * FROM categories ORDER BY id"));
  }, []);

  useEffect(() => {
    getDb()
      .then(async (db) => {
        setAccounts(await db.select<Account[]>("SELECT * FROM accounts ORDER BY id"));
      })
      .catch((e) => setError(String(e)));
    refreshCategories();
    invoke<string>("get_db_url").then((url) => setVaultPath(vaultFolderFromDbUrl(url)));
    refreshBackups();
  }, [refreshBackups, refreshCategories]);

  async function handleRestore(backup: BackupMeta) {
    const ok = window.confirm(
      `Восстановить базу из бэкапа от ${new Date(backup.created_at).toLocaleString("ru-RU")}? Текущая база будет сначала сама сохранена в бэкапы, но приложение надо перезапустить.`,
    );
    if (!ok) return;
    await restoreBackup(backup.name);
    setBackupMessage("Восстановлено. Перезапустите приложение, чтобы увидеть изменения.");
    refreshBackups();
  }

  async function changeVault() {
    const path = await open({ directory: true, title: "Папка для данных Dinero" });
    if (!path || Array.isArray(path)) return;
    await invoke("set_vault_path", { path });
    setVaultMessage(
      `Новая папка сохранена: ${path}. Перезапустите приложение, чтобы она начала использоваться (файл dinero.db туда нужно перенести/скопировать вручную, если там его ещё нет).`,
    );
  }

  if (error) {
    return (
      <div className="screen">
        <h2>Данные</h2>
        <p className="hint">Ошибка подключения к БД: {error}</p>
      </div>
    );
  }

  return (
    <div className="screen">
      <h2>Данные</h2>

      <p className="hint">
        Папка с данными: {vaultPath ?? "…"} — её можно синхронизировать между
        устройствами через Syncthing. Не открывайте Dinero на двух устройствах
        одновременно с одной и той же папкой: SQLite-файл Syncthing не умеет
        мержить.
      </p>
      <button type="button" onClick={changeVault}>
        Изменить папку...
      </button>
      {vaultMessage && <p className="hint">{vaultMessage}</p>}

      <h3>Бэкапы</h3>
      <p className="hint">
        Делаются сами при запуске (не чаще раза в день) и перед импортом,
        удалением выписки, массовым применением категорий и применением
        правил.{" "}
        <button type="button" onClick={() => openLogsFolder().catch(() => {})}>
          Открыть папку логов
        </button>
      </p>
      {backupMessage && <p className="hint">{backupMessage}</p>}
      {backups.length === 0 ? (
        <p className="hint">Бэкапов пока нет.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Когда</th>
              <th>Причина</th>
              <th>Размер</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {backups.map((b) => (
              <tr key={b.name}>
                <td>{new Date(b.created_at).toLocaleString("ru-RU")}</td>
                <td>{REASON_LABELS[b.reason] ?? b.reason}</td>
                <td>{formatSize(b.size_bytes)}</td>
                <td>
                  <button type="button" onClick={() => handleRestore(b)}>
                    Восстановить
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <table>
        <thead>
          <tr>
            <th>Счёт</th>
            <th>kind</th>
            <th>транзитный</th>
          </tr>
        </thead>
        <tbody>
          {accounts.map((a) => (
            <tr key={a.id}>
              <td>{a.name}</td>
              <td>{a.kind}</td>
              <td>{a.is_transit ? "да" : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h3>Категории</h3>
      <button type="button" onClick={() => setShowCategories(true)}>
        Управление категориями...
      </button>
      <table>
        <thead>
          <tr>
            <th>Категория</th>
            <th>системная</th>
          </tr>
        </thead>
        <tbody>
          {categories.map((c) => (
            <tr key={c.id}>
              <td>{c.name}</td>
              <td>{c.is_system ? "да" : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {showCategories && (
        <CategoriesScreen
          onClose={() => {
            setShowCategories(false);
            refreshCategories();
          }}
        />
      )}
    </div>
  );
}
