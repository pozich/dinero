import { CHART_COLORS } from "../analytics/palette";

const TOOLTIP_BASE = {
  backgroundColor: CHART_COLORS.surface,
  borderColor: CHART_COLORS.border,
  textStyle: { color: CHART_COLORS.text },
};

/**
 * SPEC-2.md 10.4's "график план/факт: «как надо», «как есть», прогноз
 * пунктиром". «Как надо» is a straight line from the first contribution
 * (or now, if there isn't one yet) to the target on the deadline; «как
 * есть» is the real cumulative contribution total; the forecast dashes
 * onward from the last real point to the target at the current pace.
 */
export function buildGoalPlanChartOption(
  contributions: readonly { occurredAt: string; amountTiyin: number }[],
  targetTiyin: number,
  deadline: string | null,
  monthlyContributionTiyin: number,
  now: Date,
) {
  const sorted = [...contributions].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
  let running = 0;
  const actualPoints = sorted.map((c) => {
    running += c.amountTiyin;
    return [c.occurredAt.slice(0, 10), running / 100] as [string, number];
  });

  const startDate = (sorted[0]?.occurredAt ?? now.toISOString()).slice(0, 10);
  const endDate = (deadline ?? now.toISOString()).slice(0, 10);
  const planPoints: [string, number][] = deadline ? [[startDate, 0], [endDate, targetTiyin / 100]] : [];

  const lastActual = actualPoints[actualPoints.length - 1] ?? [now.toISOString().slice(0, 10), 0];
  let forecastPoints: [string, number][] = [];
  if (monthlyContributionTiyin > 0) {
    const monthsToGo = Math.max(0, (targetTiyin - running) / monthlyContributionTiyin);
    const forecastEndMs = now.getTime() + monthsToGo * 30.44 * 86_400_000;
    forecastPoints = [lastActual, [new Date(forecastEndMs).toISOString().slice(0, 10), targetTiyin / 100]];
  }

  return {
    tooltip: { trigger: "axis", ...TOOLTIP_BASE },
    legend: { textStyle: { color: CHART_COLORS.textDim }, top: 0 },
    grid: { left: 60, right: 20, top: 36, bottom: 30 },
    xAxis: { type: "time", axisLabel: { color: CHART_COLORS.textDim } },
    yAxis: { type: "value", axisLabel: { color: CHART_COLORS.textDim }, splitLine: { lineStyle: { color: CHART_COLORS.border, opacity: 0.5 } } },
    series: [
      { name: "Как есть", type: "line", data: actualPoints, itemStyle: { color: CHART_COLORS.accent }, lineStyle: { color: CHART_COLORS.accent } },
      planPoints.length > 0 && {
        name: "Как надо",
        type: "line",
        data: planPoints,
        itemStyle: { color: CHART_COLORS.textDim },
        lineStyle: { color: CHART_COLORS.textDim, type: "dotted" },
      },
      forecastPoints.length > 0 && {
        name: "Прогноз",
        type: "line",
        data: forecastPoints,
        itemStyle: { color: CHART_COLORS.income },
        lineStyle: { color: CHART_COLORS.income, type: "dashed" },
      },
    ].filter(Boolean),
  };
}
