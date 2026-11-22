import { useEffect, useState } from "react";
import { getDb } from "../../db/client";

export function OperationsScreen() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    getDb().then(async (db) => {
      const rows = await db.select<{ n: number }[]>(
        "SELECT count(*) as n FROM transactions",
      );
      setCount(rows[0]?.n ?? 0);
    });
  }, []);

  return (
    <div className="screen">
      <h2>Категории + Операции</h2>
      <p className="hint">
        Операций в базе: {count === null ? "…" : count}. Таблица операций и
        категоризация появятся в Э5.
      </p>
    </div>
  );
}
