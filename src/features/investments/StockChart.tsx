import { EChart } from "../analytics/EChart";
import { buildStockChartOption, type StockDividendPoint, type StockPricePoint, type StockTradePoint } from "./stockChartOption";

export function StockChart({
  prices,
  trades,
  dividends,
  averageCostTiyin,
}: {
  prices: readonly StockPricePoint[];
  trades: readonly StockTradePoint[];
  dividends: readonly StockDividendPoint[];
  averageCostTiyin: number;
}) {
  if (prices.length === 0) {
    return <p className="hint">Нет загруженных цен для этой бумаги — нажмите «Обновить цены».</p>;
  }
  return <EChart option={buildStockChartOption(prices, trades, dividends, averageCostTiyin)} height={360} />;
}
