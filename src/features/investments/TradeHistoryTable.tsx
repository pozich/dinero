import { useMemo, useState } from "react";
import type { TradeRow } from "../../db/trades";
import { formatTiyin } from "../operations/money";

/** SPEC-2.md 9.3's "История сделок с фильтрами". */
export function TradeHistoryTable({ trades }: { trades: readonly TradeRow[] }) {
  const [ticker, setTicker] = useState("");
  const [side, setSide] = useState<"" | "buy" | "sell">("");

  const tickers = useMemo(() => [...new Set(trades.map((t) => t.ticker))].sort(), [trades]);
  const filtered = trades.filter((t) => (!ticker || t.ticker === ticker) && (!side || t.side === side));

  return (
    <div className="trade-history">
      <div className="filters">
        <select value={ticker} onChange={(e) => setTicker(e.target.value)}>
          <option value="">Все бумаги</option>
          {tickers.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <select value={side} onChange={(e) => setSide(e.target.value as typeof side)}>
          <option value="">Покупка и продажа</option>
          <option value="buy">Покупка</option>
          <option value="sell">Продажа</option>
        </select>
      </div>
      <table>
        <thead>
          <tr>
            <th>Дата</th>
            <th>Бумага</th>
            <th>Сторона</th>
            <th>Сумма</th>
            <th>Кол-во (оценка)</th>
            <th>Комиссия</th>
            <th>Заявка</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((t) => (
            <tr key={t.id}>
              <td>{t.occurredAt.slice(0, 10)}</td>
              <td>{t.ticker}</td>
              <td>{t.side === "buy" ? "Покупка" : "Продажа"}</td>
              <td>{formatTiyin(t.side === "buy" ? -t.amountTiyin : t.amountTiyin)}</td>
              <td>{t.estimatedQuantity ?? "—"}</td>
              <td>{formatTiyin(-t.commissionTiyin)}</td>
              <td className="hint">{t.orderNumber ?? "—"}</td>
            </tr>
          ))}
          {filtered.length === 0 && (
            <tr>
              <td colSpan={7} className="hint">
                Нет сделок.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
