import { useState } from "react";
import type { RecurringSeries } from "../../analytics/recurringPayments";
import type { RecurringSeriesState } from "../../db/recurringSeriesState";
import { formatTiyin } from "../operations/money";

const INTERVAL_LABELS: Record<RecurringSeries["interval"], string> = {
  week: "в неделю",
  month: "в месяц",
  year: "в год",
};

/** SPEC-2.md 6.6: сумма в месяц/год, дата следующего ожидаемого платежа,
 * «подорожал на N%», «пропущен», плюс ручное подтвердить/скрыть. */
export function RecurringPaymentsPanel({
  series,
  state,
  onSetHidden,
  onSetConfirmed,
  onDrillDown,
}: {
  series: RecurringSeries[];
  state: Map<string, RecurringSeriesState>;
  onSetHidden: (key: string, hidden: boolean) => void;
  onSetConfirmed: (key: string, confirmed: boolean) => void;
  onDrillDown: (title: string, transactionIds: number[]) => void;
}) {
  const [showHidden, setShowHidden] = useState(false);

  const visible = series.filter((s) => showHidden || !state.get(s.key)?.hidden);

  return (
    <div className="recurring-panel">
      <div className="recurring-panel-head">
        <h3>Регулярные платежи</h3>
        <label>
          <input type="checkbox" checked={showHidden} onChange={(e) => setShowHidden(e.target.checked)} />
          показать скрытые
        </label>
      </div>
      {visible.length === 0 && <p className="hint">Серий не найдено.</p>}
      <ul className="recurring-list">
        {visible.map((s) => {
          const st = state.get(s.key);
          return (
            <li key={s.key} className={st?.hidden ? "recurring-hidden" : ""}>
              <button
                type="button"
                className="recurring-label"
                onClick={() => onDrillDown(s.label, s.occurrences.map((o) => o.transactionId))}
              >
                {s.label}
              </button>
              <span className="recurring-amount">
                {formatTiyin(s.avgAmountTiyin)} {INTERVAL_LABELS[s.interval]}
              </span>
              <span className="hint">следующий: {s.nextExpectedDate.slice(0, 10)}</span>
              {s.priceChangePercent !== null && Math.abs(s.priceChangePercent) >= 1 && (
                <span className={s.priceChangePercent > 0 ? "recurring-up" : "recurring-down"}>
                  {s.priceChangePercent > 0 ? "подорожал" : "подешевел"} на {Math.abs(s.priceChangePercent).toFixed(0)}%
                </span>
              )}
              {s.missed && <span className="recurring-missed">пропущен</span>}
              {st?.confirmed && <span className="hint">подтверждено</span>}
              <span className="recurring-actions">
                <button type="button" onClick={() => onSetConfirmed(s.key, !st?.confirmed)}>
                  {st?.confirmed ? "Снять подтверждение" : "Подтвердить"}
                </button>
                <button type="button" onClick={() => onSetHidden(s.key, !st?.hidden)}>
                  {st?.hidden ? "Показать" : "Скрыть"}
                </button>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
