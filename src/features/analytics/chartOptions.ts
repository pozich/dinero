import type { TimeBucket } from "../../analytics/timeSeries";
import { cumulativeNet } from "../../analytics/timeSeries";
import type { GroupBucket, CategoryTreeBucket } from "../../analytics/grouping";
import { BASE_AXIS_LINE, BASE_SPLIT_LINE, BASE_TEXT_STYLE, CHART_COLORS, colorForCategory, colorForIndex } from "./palette";

const TOOLTIP_BASE = {
  backgroundColor: CHART_COLORS.surface,
  borderColor: CHART_COLORS.border,
  textStyle: { color: CHART_COLORS.text },
};

/** SPEC-2.md 6.4 "столбцы по периодам (доход/расход/сальдо)" — one bucket
 * (day or month, picked by the caller) per bar, сальдо overlaid as a line. */
export function buildBarOption(buckets: readonly TimeBucket[]) {
  return {
    tooltip: { trigger: "axis", ...TOOLTIP_BASE },
    legend: { textStyle: BASE_TEXT_STYLE, top: 0 },
    grid: { left: 60, right: 20, top: 36, bottom: 30 },
    xAxis: {
      type: "category",
      data: buckets.map((b) => b.label),
      axisLine: BASE_AXIS_LINE,
      axisLabel: BASE_TEXT_STYLE,
    },
    yAxis: {
      type: "value",
      axisLine: BASE_AXIS_LINE,
      axisLabel: BASE_TEXT_STYLE,
      splitLine: BASE_SPLIT_LINE,
    },
    series: [
      {
        name: "Доход",
        type: "bar",
        itemStyle: { color: CHART_COLORS.income },
        data: buckets.map((b) => ({ value: b.incomeTiyin / 100, transactionIds: b.transactionIds })),
      },
      {
        name: "Расход",
        type: "bar",
        itemStyle: { color: CHART_COLORS.expense },
        data: buckets.map((b) => ({ value: b.expenseTiyin / 100, transactionIds: b.transactionIds })),
      },
      {
        name: "Сальдо",
        type: "line",
        itemStyle: { color: CHART_COLORS.accent },
        lineStyle: { color: CHART_COLORS.accent },
        data: buckets.map((b) => ({ value: b.netTiyin / 100, transactionIds: b.transactionIds })),
      },
    ],
  };
}

/** SPEC-2.md 6.4 "линия: денежный поток и накопительный остаток". */
export function buildLineOption(buckets: readonly TimeBucket[]) {
  const cumulative = cumulativeNet(buckets);
  return {
    tooltip: { trigger: "axis", ...TOOLTIP_BASE },
    legend: { textStyle: BASE_TEXT_STYLE, top: 0 },
    grid: { left: 60, right: 20, top: 36, bottom: 30 },
    xAxis: {
      type: "category",
      data: buckets.map((b) => b.label),
      axisLine: BASE_AXIS_LINE,
      axisLabel: BASE_TEXT_STYLE,
    },
    yAxis: {
      type: "value",
      axisLine: BASE_AXIS_LINE,
      axisLabel: BASE_TEXT_STYLE,
      splitLine: BASE_SPLIT_LINE,
    },
    series: [
      {
        name: "Денежный поток",
        type: "bar",
        itemStyle: { color: CHART_COLORS.textDim },
        data: buckets.map((b) => ({ value: b.netTiyin / 100, transactionIds: b.transactionIds })),
      },
      {
        name: "Накопительный остаток",
        type: "line",
        smooth: true,
        itemStyle: { color: CHART_COLORS.accent },
        lineStyle: { color: CHART_COLORS.accent, width: 2 },
        areaStyle: { color: CHART_COLORS.accent, opacity: 0.08 },
        data: buckets.map((b, i) => ({ value: cumulative[i] / 100, transactionIds: b.transactionIds })),
      },
    ],
  };
}

/** SPEC-2.md 6.4's "пончик" half of "пончик и графоподобный вид". Buckets
 * with a zero or near-zero share are dropped so a long tail of 1-tiyin
 * categories doesn't turn the legend into noise. */
export function buildDonutOption(buckets: readonly GroupBucket[]) {
  const sorted = [...buckets].filter((b) => b.amountTiyin !== 0).sort((a, b) => Math.abs(b.amountTiyin) - Math.abs(a.amountTiyin));
  return {
    tooltip: { trigger: "item", ...TOOLTIP_BASE },
    legend: { type: "scroll", orient: "vertical", right: 10, top: 10, textStyle: BASE_TEXT_STYLE },
    series: [
      {
        type: "pie",
        radius: ["42%", "70%"],
        center: ["38%", "50%"],
        itemStyle: { borderColor: CHART_COLORS.surface, borderWidth: 2 },
        label: { color: BASE_TEXT_STYLE.color },
        data: sorted.map((b, i) => ({
          name: b.label,
          value: Math.abs(b.amountTiyin) / 100,
          transactionIds: b.transactionIds,
          itemStyle: { color: colorForIndex(i) },
        })),
      },
    ],
  };
}

type Circle = { x: number; y: number; r: number };

/** A minimal greedy circle-packing: biggest circle first at the center,
 * every later one placed at the closest non-overlapping point around an
 * already-placed circle — not a real physics layout, just the "circle of
 * circles, size = share" approximation SPEC-2.md 6.4 explicitly asks for
 * in place of a proper packing library. */
function packCircles(radii: number[]): Circle[] {
  const placed: Circle[] = [];
  for (let i = 0; i < radii.length; i++) {
    const r = radii[i];
    if (placed.length === 0) {
      placed.push({ x: 0, y: 0, r });
      continue;
    }
    let best: Circle | null = null;
    let bestDist = Infinity;
    const steps = 48;
    for (const anchor of placed) {
      for (let s = 0; s < steps; s++) {
        const angle = (2 * Math.PI * s) / steps;
        const dist = anchor.r + r;
        const candidate = { x: anchor.x + dist * Math.cos(angle), y: anchor.y + dist * Math.sin(angle), r };
        const overlaps = placed.some((p) => Math.hypot(candidate.x - p.x, candidate.y - p.y) < p.r + r - 0.01);
        if (overlaps) continue;
        const centerDist = Math.hypot(candidate.x, candidate.y);
        if (centerDist < bestDist) {
          bestDist = centerDist;
          best = candidate;
        }
      }
    }
    placed.push(best ?? { x: 0, y: 0, r });
  }
  return placed;
}

/** SPEC-2.md 6.4's "графоподобный вид" — same data as the donut, laid out
 * as packed circles sized by share instead of pie slices. */
export function buildBubbleOption(buckets: readonly GroupBucket[]) {
  const sorted = [...buckets].filter((b) => b.amountTiyin !== 0).sort((a, b) => Math.abs(b.amountTiyin) - Math.abs(a.amountTiyin));
  const total = sorted.reduce((sum, b) => sum + Math.abs(b.amountTiyin), 0) || 1;
  const radii = sorted.map((b) => 10 + 90 * Math.sqrt(Math.abs(b.amountTiyin) / total));
  const circles = packCircles(radii);
  const maxExtent = Math.max(1, ...circles.map((c) => Math.hypot(c.x, c.y) + c.r));

  return {
    tooltip: { trigger: "item", ...TOOLTIP_BASE },
    xAxis: { show: false, min: -maxExtent, max: maxExtent },
    yAxis: { show: false, min: -maxExtent, max: maxExtent },
    series: [
      {
        type: "scatter",
        symbol: "circle",
        data: sorted.map((b, i) => ({
          value: [circles[i].x, circles[i].y],
          symbolSize: circles[i].r * 2,
          name: b.label,
          transactionIds: b.transactionIds,
          itemStyle: { color: colorForIndex(i), opacity: 0.85 },
          label: {
            show: circles[i].r > 18,
            formatter: b.label,
            color: CHART_COLORS.text,
            fontSize: 11,
            position: "inside",
          },
        })),
      },
    ],
  };
}

type TreemapNode = {
  name: string;
  value: number;
  transactionIds: number[];
  itemStyle?: { color: string };
  children?: TreemapNode[];
};

function toTreemapNode(bucket: CategoryTreeBucket, index: number): TreemapNode {
  return {
    name: bucket.name,
    value: Math.abs(bucket.amountTiyin) / 100,
    transactionIds: bucket.transactionIds,
    itemStyle: { color: colorForCategory(null, index) },
    children: bucket.children.length > 0 ? bucket.children.map((c, i) => toTreemapNode(c, i)) : undefined,
  };
}

/** SPEC-2.md 6.4's treemap "для вложенных категорий" — parent rectangles
 * already include their children's totals (groupByCategoryTree rolls that
 * up), zero-value branches are dropped so an empty category doesn't eat a
 * visible rectangle. */
export function buildTreemapOption(buckets: readonly CategoryTreeBucket[]) {
  const nodes = buckets.filter((b) => b.amountTiyin !== 0).map((b, i) => toTreemapNode(b, i));
  return {
    tooltip: { ...TOOLTIP_BASE },
    series: [
      {
        type: "treemap",
        roam: false,
        breadcrumb: { show: true, itemStyle: { color: CHART_COLORS.surface, textStyle: { color: BASE_TEXT_STYLE.color } } },
        label: { color: CHART_COLORS.text },
        itemStyle: { borderColor: CHART_COLORS.bg, borderWidth: 1, gapWidth: 1 },
        data: nodes,
      },
    ],
  };
}

/** SPEC-2.md 6.4's "sankey «доходы → категории расходов»" — a single
 * "Доход" source node fanning out into top-level expense categories, plus
 * a "Остаток" node for whatever income wasn't spent (dropped when the
 * period ran at a loss, since a negative sankey value isn't meaningful). */
export function buildSankeyOption(incomeTiyin: number, expenseBuckets: readonly GroupBucket[]) {
  const positive = expenseBuckets.filter((b) => b.amountTiyin < 0);
  const totalExpense = positive.reduce((sum, b) => sum + Math.abs(b.amountTiyin), 0);
  const surplus = incomeTiyin - totalExpense;

  const nodes = [{ name: "Доход" }, ...positive.map((b) => ({ name: b.label }))];
  if (surplus > 0) nodes.push({ name: "Остаток" });

  const links = positive.map((b, i) => ({
    source: "Доход",
    target: b.label,
    value: Math.abs(b.amountTiyin) / 100,
    transactionIds: b.transactionIds,
    lineStyle: { color: colorForIndex(i) },
  }));
  if (surplus > 0) {
    links.push({ source: "Доход", target: "Остаток", value: surplus / 100, transactionIds: [], lineStyle: { color: CHART_COLORS.accent } });
  }

  return {
    tooltip: { ...TOOLTIP_BASE },
    series: [
      {
        type: "sankey",
        emphasis: { focus: "adjacency" },
        label: { color: CHART_COLORS.text },
        lineStyle: { color: "source", opacity: 0.4 },
        data: nodes,
        links,
      },
    ],
  };
}

/** SPEC-2.md 6.4's "тепловая карта-календарь трат по дням" — one calendar
 * cell per day, colored by that day's expense total. */
export function buildCalendarHeatmapOption(buckets: readonly TimeBucket[], periodStart: string, periodEnd: string) {
  const values = buckets.map((b) => Math.abs(b.expenseTiyin) / 100);
  const max = Math.max(1, ...values);
  const rangeEnd = new Date(new Date(periodEnd).getTime() - 1).toISOString().slice(0, 10);

  return {
    tooltip: { ...TOOLTIP_BASE },
    visualMap: {
      min: 0,
      max,
      show: false,
      inRange: { color: [CHART_COLORS.surface, CHART_COLORS.expense] },
    },
    calendar: {
      range: [periodStart.slice(0, 10), rangeEnd],
      cellSize: ["auto", 16],
      itemStyle: { borderWidth: 1, borderColor: CHART_COLORS.border, color: CHART_COLORS.bg },
      dayLabel: { color: BASE_TEXT_STYLE.color, fontSize: 10 },
      monthLabel: { color: BASE_TEXT_STYLE.color, fontSize: 11 },
      yearLabel: { show: false },
    },
    series: [
      {
        type: "heatmap",
        coordinateSystem: "calendar",
        data: buckets.map((b) => ({
          value: [b.start.slice(0, 10), Math.abs(b.expenseTiyin) / 100],
          transactionIds: b.transactionIds,
        })),
      },
    ],
  };
}
