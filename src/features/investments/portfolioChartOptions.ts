import { CHART_COLORS, colorForIndex } from "../analytics/palette";

const TOOLTIP_BASE = {
  backgroundColor: CHART_COLORS.surface,
  borderColor: CHART_COLORS.border,
  textStyle: { color: CHART_COLORS.text },
};

/** SPEC-2.md 9.3's "состав (пончик... по бумагам)". */
export function buildCompositionOption(positions: readonly { ticker: string; currentValueTiyin: number | null }[]) {
  const withValue = positions.filter((p) => (p.currentValueTiyin ?? 0) > 0);
  return {
    tooltip: { trigger: "item", ...TOOLTIP_BASE },
    legend: { type: "scroll", orient: "vertical", right: 10, top: 10, textStyle: { color: CHART_COLORS.textDim } },
    series: [
      {
        type: "pie",
        radius: ["42%", "70%"],
        center: ["38%", "50%"],
        itemStyle: { borderColor: CHART_COLORS.surface, borderWidth: 2 },
        label: { color: CHART_COLORS.text },
        data: withValue.map((p, i) => ({ name: p.ticker, value: (p.currentValueTiyin ?? 0) / 100, itemStyle: { color: colorForIndex(i) } })),
      },
    ],
  };
}

/** "Вложения по месяцам" — sum of every buy trade's cash amount, grouped
 * by calendar month, across every security. */
export function buildMonthlyInvestmentOption(buys: readonly { date: string; amountTiyin: number }[]) {
  const byMonth = new Map<string, number>();
  for (const b of buys) {
    const month = b.date.slice(0, 7);
    byMonth.set(month, (byMonth.get(month) ?? 0) + b.amountTiyin);
  }
  const months = [...byMonth.keys()].sort();

  return {
    tooltip: { trigger: "axis", ...TOOLTIP_BASE },
    grid: { left: 60, right: 20, top: 20, bottom: 30 },
    xAxis: { type: "category", data: months, axisLabel: { color: CHART_COLORS.textDim } },
    yAxis: { type: "value", axisLabel: { color: CHART_COLORS.textDim }, splitLine: { lineStyle: { color: CHART_COLORS.border, opacity: 0.5 } } },
    series: [
      {
        name: "Вложено",
        type: "bar",
        itemStyle: { color: CHART_COLORS.accent },
        data: months.map((m) => (byMonth.get(m) ?? 0) / 100),
      },
    ],
  };
}
