import type { Position } from "../../investments/computePositions";
import type { TradeRow } from "../../db/trades";
import { EChart } from "../analytics/EChart";
import { buildCompositionOption, buildMonthlyInvestmentOption } from "./portfolioChartOptions";
import { formatTiyin } from "../operations/money";

/** SPEC-2.md 9.3's "Портфель": состав по бумагам, вложения по месяцам,
 * итоги. The invested/value-over-time curve itself isn't built — it would
 * need reconstructing the whole portfolio's value day by day across
 * history, deferred, see HANDOFF.md. */
export function PortfolioOverview({ positions, trades }: { positions: readonly Position[]; trades: readonly TradeRow[] }) {
  const totalInvestedTiyin = positions.reduce((sum, p) => sum + p.investedTiyin, 0);
  const totalValueTiyin = positions.reduce((sum, p) => sum + (p.currentValueTiyin ?? 0), 0);
  const totalPnlTiyin = positions.reduce((sum, p) => sum + (p.pnlTiyin ?? 0), 0);
  const buys = trades.filter((t) => t.side === "buy").map((t) => ({ date: t.occurredAt, amountTiyin: t.amountTiyin }));

  return (
    <div className="portfolio-overview">
      <div className="metric-cards">
        <div className="metric-card">
          <div className="metric-label">Вложено</div>
          <div className="metric-value">{formatTiyin(totalInvestedTiyin)}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Текущая стоимость</div>
          <div className="metric-value">{formatTiyin(totalValueTiyin)}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">P&L</div>
          <div className={`metric-value ${totalPnlTiyin < 0 ? "metric-expense" : "metric-income"}`}>
            {formatTiyin(totalPnlTiyin)}
          </div>
        </div>
      </div>

      <h4>Состав портфеля</h4>
      <EChart option={buildCompositionOption(positions)} height={280} />

      <h4>Вложения по месяцам</h4>
      <EChart option={buildMonthlyInvestmentOption(buys)} height={240} />
    </div>
  );
}
