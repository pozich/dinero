import type { DividendRow } from "../../db/dividends";
import type { Position } from "../../investments/computePositions";
import { formatTiyin } from "../operations/money";

/** SPEC-2.md 9.3's "Дивиденды": суммы по бумагам и годам, доходность на
 * вложенное. A literal calendar view isn't built — a table by year x
 * ticker carries the same information with far less code, see
 * HANDOFF.md. */
export function DividendsCalendar({ dividends, positions }: { dividends: readonly DividendRow[]; positions: readonly Position[] }) {
  const years = [...new Set(dividends.map((d) => d.occurredAt.slice(0, 4)))].sort();
  const tickers = [...new Set(dividends.map((d) => d.ticker ?? d.isin))].sort();

  function sumFor(ticker: string, year: string): number {
    return dividends
      .filter((d) => (d.ticker ?? d.isin) === ticker && d.occurredAt.slice(0, 4) === year)
      .reduce((sum, d) => sum + d.amountTiyin, 0);
  }

  if (dividends.length === 0) return <p className="hint">Дивидендов пока нет.</p>;

  return (
    <div className="dividends-calendar">
      <table>
        <thead>
          <tr>
            <th>Бумага</th>
            {years.map((y) => (
              <th key={y}>{y}</th>
            ))}
            <th>Доходность на вложенное</th>
          </tr>
        </thead>
        <tbody>
          {tickers.map((ticker) => {
            const position = positions.find((p) => p.ticker === ticker);
            const yieldOnCost =
              position && position.investedTiyin > 0 ? (position.dividendsReceivedTiyin / position.investedTiyin) * 100 : null;
            return (
              <tr key={ticker}>
                <td>{ticker}</td>
                {years.map((y) => (
                  <td key={y}>{sumFor(ticker, y) > 0 ? formatTiyin(sumFor(ticker, y)) : "—"}</td>
                ))}
                <td>{yieldOnCost !== null ? `${yieldOnCost.toFixed(1)}%` : "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
