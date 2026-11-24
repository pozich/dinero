import type { StatementSummary } from "../../db/statements";

function formatDate(iso: string): string {
  return iso.slice(0, 10);
}

/** Одностороняя карточка (без флипа — он скрывал кнопки замена/удаления за
 * наведением, что и было непонятно пользователю) — иконки действий всегда
 * видны внизу. */
export function StatementCard({
  statement,
  onDelete,
  onReplace,
}: {
  statement: StatementSummary;
  onDelete?: () => void;
  onReplace?: () => void;
}) {
  return (
    <div className="statement-card">
      <div className="statement-card-body">
        <div className="statement-card-bank">{statement.account_name}</div>
        <div className="statement-card-period">
          {formatDate(statement.period_start)} — {formatDate(statement.period_end)}
        </div>
        <div className="statement-card-count">{statement.transaction_count} операций</div>
        <div className="statement-card-file">{statement.file_name}</div>
      </div>
      <div className="statement-card-actions">
        <button type="button" title="Заменить файл" onClick={onReplace} disabled={!onReplace}>
          ⟲
        </button>
        <button type="button" title="Удалить" onClick={onDelete} disabled={!onDelete}>
          ✕
        </button>
      </div>
    </div>
  );
}
