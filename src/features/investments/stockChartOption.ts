import { CHART_COLORS } from "../analytics/palette";

export type StockPricePoint = { date: string; closeTiyin: number };
export type StockTradePoint = { occurredAt: string; side: "buy" | "sell"; amountTiyin: number; estimatedQuantity: number | null };
export type StockDividendPoint = { occurredAt: string; perShareTiyin: number };

const TOOLTIP_BASE = {
  backgroundColor: CHART_COLORS.surface,
  borderColor: CHART_COLORS.border,
  textStyle: { color: CHART_COLORS.text },
};

/**
 * SPEC-2.md 9.3's "график по акции": цена за период, мои покупки
 * (зелёные)/продажи (красные) точками, пунктир средней цены покупки,
 * отметки дивидендов. A trade/dividend lands on the x-axis only when its
 * own date is also a price date (category axis matches by exact string) —
 * a trade that settled on a weekend with no trading that day just won't
 * show a marker, a known simplification.
 */
export function buildStockChartOption(
  prices: readonly StockPricePoint[],
  trades: readonly StockTradePoint[],
  dividends: readonly StockDividendPoint[],
  averageCostTiyin: number,
) {
  const dates = prices.map((p) => p.date);

  function unitPriceTiyin(t: StockTradePoint): number | null {
    if (!t.estimatedQuantity || t.estimatedQuantity <= 0) return null;
    return Math.round(t.amountTiyin / t.estimatedQuantity);
  }

  const buyPoints = trades
    .filter((t) => t.side === "buy")
    .map((t) => ({ date: t.occurredAt.slice(0, 10), price: unitPriceTiyin(t), quantity: t.estimatedQuantity }))
    .filter((p) => p.price !== null);
  const sellPoints = trades
    .filter((t) => t.side === "sell")
    .map((t) => ({ date: t.occurredAt.slice(0, 10), price: unitPriceTiyin(t), quantity: t.estimatedQuantity }))
    .filter((p) => p.price !== null);

  return {
    tooltip: { trigger: "item", ...TOOLTIP_BASE },
    legend: { textStyle: { color: CHART_COLORS.textDim }, top: 0 },
    grid: { left: 60, right: 20, top: 36, bottom: 30 },
    xAxis: { type: "category", data: dates, axisLabel: { color: CHART_COLORS.textDim } },
    yAxis: { type: "value", axisLabel: { color: CHART_COLORS.textDim }, splitLine: { lineStyle: { color: CHART_COLORS.border, opacity: 0.5 } } },
    series: [
      {
        name: "Цена",
        type: "line",
        data: prices.map((p) => p.closeTiyin / 100),
        showSymbol: false,
        lineStyle: { color: CHART_COLORS.accent },
        markLine: {
          symbol: "none",
          data: [{ yAxis: averageCostTiyin / 100, label: { formatter: "Средняя цена покупки", color: CHART_COLORS.textDim } }],
          lineStyle: { type: "dashed", color: CHART_COLORS.textDim },
        },
      },
      {
        name: "Покупки",
        type: "scatter",
        data: buyPoints.map((p) => ({ value: [p.date, p.price! / 100], quantity: p.quantity })),
        symbolSize: 10,
        itemStyle: { color: CHART_COLORS.income },
      },
      {
        name: "Продажи",
        type: "scatter",
        data: sellPoints.map((p) => ({ value: [p.date, p.price! / 100], quantity: p.quantity })),
        symbolSize: 10,
        itemStyle: { color: CHART_COLORS.expense },
      },
      {
        name: "Дивиденды",
        type: "scatter",
        symbol: "diamond",
        data: dividends.map((d) => ({ value: [d.occurredAt.slice(0, 10), d.perShareTiyin / 100] })),
        symbolSize: 8,
        itemStyle: { color: "#e0c56b" },
      },
    ],
  };
}
