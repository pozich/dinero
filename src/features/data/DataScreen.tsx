import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { getDb } from "../../db/client";

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

export function DataScreen() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [vaultPath, setVaultPath] = useState<string | null>(null);
  const [vaultMessage, setVaultMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getDb()
      .then(async (db) => {
        setAccounts(await db.select<Account[]>("SELECT * FROM accounts ORDER BY id"));
        setCategories(
          await db.select<Category[]>("SELECT * FROM categories ORDER BY id"),
        );
      })
      .catch((e) => setError(String(e)));
    invoke<string>("get_db_url").then((url) => setVaultPath(vaultFolderFromDbUrl(url)));
  }, []);

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
    </div>
  );
}
