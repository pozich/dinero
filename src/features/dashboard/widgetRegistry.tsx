import type { ReactNode } from "react";
import type { LedgerRow } from "../../db/ledgerQuery";
import type { Category } from "../../db/categories";
import type { AccountOverview } from "../../db/accountOverview";
import type { RecurringSeries } from "../../analytics/recurringPayments";
import type { RecurringSeriesState } from "../../db/recurringSeriesState";
import type { Period } from "../../analytics/period";
import type { GroupMode } from "../../analytics/grouping";
import { groupLedgerRows, groupByCategoryTree } from "../../analytics/grouping";
import { computeMetrics } from "../../analytics/metrics";
import { bucketLedgerRows, chooseBucketGranularity } from "../../analytics/timeSeries";
import { EChart } from "../analytics/EChart";
import {
  buildBarOption,
  buildLineOption,
  buildDonutOption,
  buildBubbleOption,
  buildTreemapOption,
  buildSankeyOption,
  buildCalendarHeatmapOption,
} from "../analytics/chartOptions";
import { MetricCards } from "../analytics/MetricCards";
import { AccountsOverview } from "../analytics/AccountsOverview";
import { RecurringPaymentsPanel } from "../analytics/RecurringPaymentsPanel";
import { CategoryTreeTable } from "../analytics/CategoryTreeTable";
import type { WidgetConfig, WidgetLayout, WidgetType } from "../../dashboard/presetConfig";
import type { InvestmentsOverview } from "../../db/investmentsOverview";
import { PositionsTable } from "../investments/PositionsTable";
import { buildCompositionOption } from "../investments/portfolioChartOptions";

export type WidgetContext = {
  periodRows: LedgerRow[];
  allRows: LedgerRow[];
  period: Period;
  groupMode: GroupMode;
  categories: Category[];
  accountOverviews: AccountOverview[];
  recurringSeries: RecurringSeries[];
  recurringState: Map<string, RecurringSeriesState>;
  investmentsOverview: InvestmentsOverview | null;
  onDrillDown: (title: string, transactionIds: number[]) => void;
  onSetHidden: (key: string, hidden: boolean) => void;
  onSetConfirmed: (key: string, confirmed: boolean) => void;
};

function periodDaysOf(period: Period): number {
  return Math.max(1, Math.round((new Date(period.end).getTime() - new Date(period.start).getTime()) / 86_400_000));
}

/** Every widget type the dashboard can place (SPEC-2.md 7: "любой график/
 * карточка/таблица из раздела 6") — rendering is delegated straight to the
 * building blocks the Аналитика tab already uses, so a widget and its
 * full-screen counterpart never drift apart visually. */
export const WIDGET_LABELS: Record<WidgetType, string> = {
  bar: "Столбцы по периодам",
  line: "Денежный поток и остаток",
  donut: "Пончик по категориям",
  bubble: "Круги по категориям",
  treemap: "Treemap категорий",
  sankey: "Доходы → расходы",
  calendar: "Календарь трат",
  table: "Таблица с подытогами",
  metricCards: "Карточки метрик",
  accountsOverview: "Балансы и покрытие",
  recurringPayments: "Регулярные платежи",
  investmentPositions: "Позиции (инвестиции)",
  investmentComposition: "Состав портфеля",
};

export const DEFAULT_WIDGET_LAYOUT: WidgetLayout = { x: 0, y: 0, w: 6, h: 5 };

export function renderWidget(config: WidgetConfig, ctx: WidgetContext): ReactNode {
  const granularity = chooseBucketGranularity(ctx.period);

  switch (config.type) {
    case "bar":
      return (
        <EChart
          option={buildBarOption(bucketLedgerRows(ctx.periodRows, ctx.period, granularity))}
          onClick={(info) => ctx.onDrillDown("Операции за период", info.transactionIds)}
          height="100%"
        />
      );
    case "line":
      return <EChart option={buildLineOption(bucketLedgerRows(ctx.periodRows, ctx.period, granularity))} onClick={(info) => ctx.onDrillDown("Денежный поток", info.transactionIds)} height="100%" />;
    case "donut":
      return (
        <EChart
          option={buildDonutOption(groupLedgerRows(ctx.periodRows, ctx.groupMode, ctx.categories))}
          onClick={(info) => ctx.onDrillDown(info.name ?? "Операции", info.transactionIds)}
          height="100%"
        />
      );
    case "bubble":
      return (
        <EChart
          option={buildBubbleOption(groupLedgerRows(ctx.periodRows, ctx.groupMode, ctx.categories))}
          onClick={(info) => ctx.onDrillDown(info.name ?? "Операции", info.transactionIds)}
          height="100%"
        />
      );
    case "treemap":
      return (
        <EChart
          option={buildTreemapOption(groupByCategoryTree(ctx.periodRows, ctx.categories))}
          onClick={(info) => ctx.onDrillDown(info.name ?? "Операции", info.transactionIds)}
          height="100%"
        />
      );
    case "sankey": {
      const metrics = computeMetrics(ctx.periodRows, { periodDays: periodDaysOf(ctx.period), includeDividends: true });
      return (
        <EChart
          option={buildSankeyOption(metrics.incomeTiyin, groupLedgerRows(ctx.periodRows, "category", ctx.categories))}
          onClick={(info) => ctx.onDrillDown(info.name ?? "Операции", info.transactionIds)}
          height="100%"
        />
      );
    }
    case "calendar":
      return (
        <EChart
          option={buildCalendarHeatmapOption(bucketLedgerRows(ctx.periodRows, ctx.period, granularity), ctx.period.start, ctx.period.end)}
          onClick={(info) => ctx.onDrillDown("Траты за день", info.transactionIds)}
          height="100%"
        />
      );
    case "table":
      return <CategoryTreeTable buckets={groupByCategoryTree(ctx.periodRows, ctx.categories)} onDrillDown={ctx.onDrillDown} />;
    case "metricCards": {
      const metrics = computeMetrics(ctx.periodRows, { periodDays: periodDaysOf(ctx.period), includeDividends: true });
      return <MetricCards metrics={metrics} comparison={null} comparisonLabel="" onDrillDown={ctx.onDrillDown} />;
    }
    case "accountsOverview":
      return <AccountsOverview accounts={ctx.accountOverviews} />;
    case "recurringPayments":
      return (
        <RecurringPaymentsPanel
          series={ctx.recurringSeries}
          state={ctx.recurringState}
          onSetHidden={ctx.onSetHidden}
          onSetConfirmed={ctx.onSetConfirmed}
          onDrillDown={ctx.onDrillDown}
        />
      );
    case "investmentPositions":
      return ctx.investmentsOverview ? (
        <PositionsTable positions={ctx.investmentsOverview.positions} selectedIsin={null} onSelect={() => {}} />
      ) : (
        <p className="hint">Нет данных по инвестициям.</p>
      );
    case "investmentComposition":
      return ctx.investmentsOverview ? (
        <EChart option={buildCompositionOption(ctx.investmentsOverview.positions)} height="100%" />
      ) : (
        <p className="hint">Нет данных по инвестициям.</p>
      );
  }
}
