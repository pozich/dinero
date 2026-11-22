import { useEffect, useState } from "react";
import { getDb } from "../../db/client";

export function FilesScreen() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    getDb().then(async (db) => {
      const rows = await db.select<{ n: number }[]>(
        "SELECT count(*) as n FROM statements",
      );
      setCount(rows[0]?.n ?? 0);
    });
  }, []);

  return (
    <div className="screen">
      <h2>Файлы</h2>
      <p className="hint">
        Загруженных выписок: {count === null ? "…" : count}. Импорт появится в
        Э2.
      </p>
    </div>
  );
}
