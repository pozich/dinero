import { useEffect, useState } from "react";
import { getDb } from "../../db/client";
import { queryTransactions, type TransactionListItem } from "../../db/transactionsQuery";
import { formatTransactionDate } from "./dateFormat";
import { formatTiyin } from "./money";

/** Manual pairing (SPEC-2.md 3.1: right-click → "Связать как перевод с…")
 * for when the automatic matcher didn't find a candidate — only shows
 * opposite-sign operations, since a transfer always has one side leaving
 * and one side arriving. */
export function ManualLinkDialog({
  row,
  onPick,
  onClose,
}: {
  row: TransactionListItem;
  onPick: (other: TransactionListItem) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<TransactionListItem[]>([]);

  useEffect(() => {
    if (search.trim().length < 2) {
      setResults([]);
      return;
    }
    getDb().then(async (db) => {
      const found = await queryTransactions(db, { search: search.trim() });
      setResults(
        found
          .filter((r) => r.id !== row.id && Math.sign(r.amount_tiyin) !== Math.sign(row.amount_tiyin))
          .slice(0, 20),
      );
    });
  }, [search, row.id, row.amount_tiyin]);

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h3>Связать как перевод с…</h3>
        <p className="hint">
          {row.description} · {formatTiyin(row.amount_tiyin)} · {formatTransactionDate(row.occurred_at, true)}
        </p>
        <input
          autoFocus
          placeholder="Поиск операции по описанию..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <ul className="similar-list">
          {results.map((r) => (
            <li key={r.id}>
              <button type="button" onClick={() => onPick(r)}>
                {formatTransactionDate(r.occurred_at, true)} · {formatTiyin(r.amount_tiyin)} ·{" "}
                {r.description}
              </button>
            </li>
          ))}
          {search.trim().length >= 2 && results.length === 0 && (
            <li className="hint">Ничего не нашлось.</li>
          )}
        </ul>
        <div className="modal-actions">
          <button type="button" onClick={onClose}>
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}
