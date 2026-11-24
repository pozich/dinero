import { useEffect, useState } from "react";
import { getDb } from "../../db/client";
import { queryTransactions, type TransactionListItem } from "../../db/transactionsQuery";
import { formatTransactionDate } from "./dateFormat";
import { formatTiyin } from "./money";

/** Manual pairing (SPEC-2.md 3.1/Ф4: right-click → "Связать как перевод/
 * возврат с…") for when the automatic matcher didn't find a candidate.
 * A transfer's counterpart is a different account, opposite sign; a
 * refund's is the *same* account, opposite sign. */
export function ManualLinkDialog({
  row,
  kind,
  onPick,
  onClose,
}: {
  row: TransactionListItem;
  kind: "transfer" | "refund";
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
          .filter(
            (r) =>
              r.id !== row.id &&
              Math.sign(r.amount_tiyin) !== Math.sign(row.amount_tiyin) &&
              (kind === "refund" ? r.account_id === row.account_id : r.account_id !== row.account_id),
          )
          .slice(0, 20),
      );
    });
  }, [search, row.id, row.amount_tiyin, row.account_id, kind]);

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h3>Связать как {kind === "refund" ? "возврат" : "перевод"} с…</h3>
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
