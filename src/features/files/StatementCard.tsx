import type { StatementSummary } from "../../db/statements";

function formatDate(iso: string): string {
  return iso.slice(0, 10);
}

export function StatementCard({
  statement,
  onDelete,
  onReplace,
}: {
  statement: StatementSummary;
  onDelete: () => void;
  onReplace: () => void;
}) {
  return (
    <div className="receipt-flip">
      <div className="receipt-inner">
        <div className="receipt-face receipt-front">
          <div className="receipt-bank">{statement.account_name}</div>
          <div className="receipt-period">
            {formatDate(statement.period_start)} — {formatDate(statement.period_end)}
          </div>
          <div className="receipt-count">{statement.transaction_count} операций</div>
          <div className="receipt-file">{statement.file_name}</div>
        </div>
        <div className="receipt-face receipt-back">
          <button type="button" onClick={onReplace}>
            Заменить
          </button>
          <button type="button" onClick={onDelete}>
            Удалить
          </button>
        </div>
      </div>
    </div>
  );
}
