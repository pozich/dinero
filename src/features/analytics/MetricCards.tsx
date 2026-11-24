import type { Metrics } from "../../analytics/metrics";
import { periodDelta } from "../../analytics/period";
import { formatTiyin } from "../operations/money";

function formatDelta(currentTotal: number, comparisonTotal: number): string {
  const { deltaTiyin, deltaPercent } = periodDelta(currentTotal, comparisonTotal);
  const sign = deltaTiyin >= 0 ? "+" : "";
  const pct = deltaPercent !== null ? ` (${sign}${deltaPercent.toFixed(0)}%)` : "";
  return `${sign}${(deltaTiyin / 100).toFixed(0)} ₸${pct}`;
}

/** SPEC-2.md 6.5. `comparison`/`comparisonLabel` are omitted on first paint
 * (while the comparison period hasn't loaded yet) rather than ever showing
 * a stale delta. */
export function MetricCards({
  metrics,
  comparison,
  comparisonLabel,
  onDrillDown,
}: {
  metrics: Metrics;
  comparison: Metrics | null;
  comparisonLabel: string;
  onDrillDown: (title: string, transactionIds: number[]) => void;
}) {
  return (
    <div className="metric-cards">
      <div className="metric-card">
        <div className="metric-label">Доход</div>
        <div className="metric-value metric-income">{formatTiyin(metrics.incomeTiyin)}</div>
        {comparison && (
          <div className="metric-delta">
            {comparisonLabel}: {formatDelta(metrics.incomeTiyin, comparison.incomeTiyin)}
          </div>
        )}
      </div>
      <div className="metric-card">
        <div className="metric-label">Расход</div>
        <div className="metric-value metric-expense">{formatTiyin(metrics.expenseTiyin)}</div>
        {comparison && (
          <div className="metric-delta">
            {comparisonLabel}: {formatDelta(metrics.expenseTiyin, comparison.expenseTiyin)}
          </div>
        )}
      </div>
      <div className="metric-card">
        <div className="metric-label">Сальдо</div>
        <div className="metric-value">{formatTiyin(metrics.netTiyin)}</div>
        {comparison && (
          <div className="metric-delta">
            {comparisonLabel}: {formatDelta(metrics.netTiyin, comparison.netTiyin)}
          </div>
        )}
      </div>
      <div className="metric-card">
        <div className="metric-label">Норма сбережений</div>
        <div className="metric-value">
          {metrics.savingsRatePercent !== null ? `${metrics.savingsRatePercent.toFixed(0)}%` : "—"}
        </div>
      </div>
      <div className="metric-card">
        <div className="metric-label">Расход в день / месяц</div>
        <div className="metric-value">
          {formatTiyin(metrics.avgPerDayTiyin)} / {formatTiyin(metrics.avgPerMonthTiyin)}
        </div>
      </div>
      <div className="metric-card metric-card-wide">
        <div className="metric-label">Крупнейшие траты</div>
        <ul className="metric-list">
          {metrics.topSpends.slice(0, 5).map((s) => (
            <li key={s.transactionId}>
              <button type="button" onClick={() => onDrillDown(s.description, [s.transactionId])}>
                {s.description} · {formatTiyin(s.amountTiyin)}
              </button>
            </li>
          ))}
          {metrics.topSpends.length === 0 && <li className="hint">Нет данных</li>}
        </ul>
      </div>
      <div className="metric-card metric-card-wide">
        <div className="metric-label">Топ контрагентов</div>
        <ul className="metric-list">
          {metrics.topCounterparties.slice(0, 5).map((c) => (
            <li key={c.label}>
              {c.label} · {formatTiyin(c.amountTiyin)}
            </li>
          ))}
          {metrics.topCounterparties.length === 0 && <li className="hint">Нет данных</li>}
        </ul>
      </div>
    </div>
  );
}
