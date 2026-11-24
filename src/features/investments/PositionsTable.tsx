import type { Position } from "../../investments/computePositions";
import { formatTiyin } from "../operations/money";

function formatPercent(value: number | null): string {
  if (value === null) return "—";
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

/** SPEC-2.md 9.3's "Позиции": тикер, количество, средняя цена, вложено,
 * текущая стоимость, PnL ₸/%, доля в портфеле, комиссии, дивиденды. */
export function PositionsTable({
  positions,
  selectedIsin,
  onSelect,
}: {
  positions: readonly Position[];
  selectedIsin: string | null;
  onSelect: (isin: string) => void;
}) {
  if (positions.length === 0) {
    return <p className="hint">Позиций пока нет — импортируйте выписку Halyk «Стандарт».</p>;
  }

  return (
    <table className="positions-table">
      <thead>
        <tr>
          <th>Бумага</th>
          <th>Кол-во</th>
          <th>Средняя цена</th>
          <th>Вложено</th>
          <th>Текущая стоимость</th>
          <th>P&L</th>
          <th>Доля</th>
          <th>Комиссии</th>
          <th>Дивиденды</th>
        </tr>
      </thead>
      <tbody>
        {positions.map((p) => (
          <tr key={p.isin} className={p.isin === selectedIsin ? "active-row" : ""} onClick={() => onSelect(p.isin)}>
            <td>
              {p.ticker} <span className="hint">{p.name}</span>
            </td>
            <td>{p.quantity}</td>
            <td>{formatTiyin(p.averageCostTiyin)}</td>
            <td>{formatTiyin(p.investedTiyin)}</td>
            <td>{p.currentValueTiyin !== null ? formatTiyin(p.currentValueTiyin) : "—"}</td>
            <td className={p.pnlTiyin !== null && p.pnlTiyin < 0 ? "metric-expense" : "metric-income"}>
              {p.pnlTiyin !== null ? `${formatTiyin(p.pnlTiyin)} (${formatPercent(p.pnlPercent)})` : "—"}
            </td>
            <td>{p.portfolioSharePercent !== null ? `${p.portfolioSharePercent.toFixed(1)}%` : "—"}</td>
            <td>{formatTiyin(-p.commissionPaidTiyin)}</td>
            <td>{formatTiyin(p.dividendsReceivedTiyin)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
