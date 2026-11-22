import { useEffect, useState } from "react";
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

export function DataScreen() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
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
  }, []);

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
        Проверка Э1: счета и системные категории должны быть засеяны миграцией
        при первом запуске.
      </p>
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
