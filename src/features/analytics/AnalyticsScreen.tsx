import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { getDb } from "../../db/client";
import { listAccounts, type Account } from "../../db/accounts";
import { listCategories, type Category } from "../../db/categories";
import { queryLedger, type LedgerRow } from "../../db/ledgerQuery";
import { queryAccountOverview, type AccountOverview } from "../../db/accountOverview";
import { queryTransactions } from "../../db/transactionsQuery";
import {
  listRecurringSeriesState,
  setSeriesHidden,
  setSeriesConfirmed,
  type RecurringSeriesState,
} from "../../db/recurringSeriesState";
import { buildReviewCandidates } from "../../review/buildReviewCandidates";
import { buildCsv } from "../../export/exportCsv";
import {
  currentPeriod,
  shiftPeriod,
  comparisonPeriod,
  formatPeriodLabel,
  type Period,
  type PeriodKind,
} from "../../analytics/period";
import { groupLedgerRows, groupByCategoryTree, type GroupMode } from "../../analytics/grouping";
import { computeMetrics } from "../../analytics/metrics";
import { findRecurringSeries } from "../../analytics/recurringPayments";
import { buildAccuracyWarning } from "../../analytics/accuracyWarning";
import { applyAnalyticsFilters, type AnalyticsFilters } from "../../analytics/filters";
import { bucketLedgerRows, chooseBucketGranularity } from "../../analytics/timeSeries";
import { EChart, type EChartClickInfo } from "./EChart";
import {
  buildBarOption,
  buildLineOption,
  buildDonutOption,
  buildBubbleOption,
  buildTreemapOption,
  buildSankeyOption,
  buildCalendarHeatmapOption,
} from "./chartOptions";
import { ChartTypeSwitcher, type ChartType } from "./ChartTypeSwitcher";
import { MetricCards } from "./MetricCards";
import { AccuracyBanner } from "./AccuracyBanner";
import { AccountsOverview } from "./AccountsOverview";
import { RecurringPaymentsPanel } from "./RecurringPaymentsPanel";
import { CategoryTreeTable } from "./CategoryTreeTable";
import { DrillDownDialog } from "./DrillDownDialog";
import { ReviewScreen } from "../review/ReviewScreen";

const GROUP_LABELS: Record<GroupMode, string> = {
  category: "Категории",
  account: "Счета",
  counterparty: "Контрагенты",
  weekday: "Дни недели",
  month: "Месяцы",
};

function periodDaysOf(period: Period): number {
  return Math.max(1, Math.round((new Date(period.end).getTime() - new Date(period.start).getTime()) / 86_400_000));
}

export function AnalyticsScreen() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [allRows, setAllRows] = useState<LedgerRow[]>([]);
  const [accountOverviews, setAccountOverviews] = useState<AccountOverview[]>([]);
  const [unconfirmedCount, setUnconfirmedCount] = useState(0);
  const [recurringState, setRecurringState] = useState<Map<string, RecurringSeriesState>>(new Map());
  const [loading, setLoading] = useState(true);

  const [periodKind, setPeriodKind] = useState<PeriodKind>("month");
  const [period, setPeriod] = useState<Period>(() => currentPeriod("month"));
  const [comparisonMode, setComparisonMode] = useState<"none" | "previous" | "yearAgo">("none");
  const [groupMode, setGroupMode] = useState<GroupMode>("category");
  const [chartType, setChartType] = useState<ChartType>("bar");
  const [includeDividends, setIncludeDividends] = useState(true);
  const [filters, setFilters] = useState<AnalyticsFilters>({});
  const [search, setSearch] = useState("");

  const [drillDown, setDrillDown] = useState<{ title: string; transactionIds: number[] } | null>(null);
  const [showReview, setShowReview] = useState(false);
  const exportRef = useRef<(() => string) | null>(null);

  const refresh = useCallback(async () => {
    const db = await getDb();
    const [rows, overviews, candidates, recState, cats, accs] = await Promise.all([
      queryLedger(db),
      queryAccountOverview(db),
      buildReviewCandidates(db),
      listRecurringSeriesState(db),
      listCategories(db),
      listAccounts(db),
    ]);
    setAllRows(rows);
    setAccountOverviews(overviews);
    setUnconfirmedCount(candidates.length);
    setRecurringState(recState);
    setCategories(cats);
    setAccounts(accs);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const t = setTimeout(() => setFilters((f) => ({ ...f, search: search || undefined })), 250);
    return () => clearTimeout(t);
  }, [search]);

  function navigatePeriod(direction: 1 | -1) {
    setPeriod((p) => shiftPeriod(p, periodKind, direction));
  }

  function setQuickPeriod(kind: PeriodKind) {
    setPeriodKind(kind);
    setPeriod(currentPeriod(kind));
  }

  const periodRows = useMemo(
    () =>
      applyAnalyticsFilters(
        allRows.filter((r) => r.occurredAt >= period.start && r.occurredAt < period.end),
        filters,
      ),
    [allRows, period, filters],
  );

  const comparisonRows = useMemo(() => {
    if (comparisonMode === "none") return null;
    const cmpPeriod = comparisonPeriod(period, periodKind, comparisonMode);
    return applyAnalyticsFilters(
      allRows.filter((r) => r.occurredAt >= cmpPeriod.start && r.occurredAt < cmpPeriod.end),
      filters,
    );
  }, [allRows, period, periodKind, comparisonMode, filters]);

  const metrics = useMemo(
    () => computeMetrics(periodRows, { periodDays: periodDaysOf(period), includeDividends }),
    [periodRows, period, includeDividends],
  );
  const comparisonMetrics = useMemo(
    () =>
      comparisonRows
        ? computeMetrics(comparisonRows, { periodDays: periodDaysOf(period), includeDividends })
        : null,
    [comparisonRows, period, includeDividends],
  );

  const uncategorizedIds = useMemo(
    () => periodRows.filter((r) => !r.excluded && r.categoryId === null).map((r) => r.transactionId),
    [periodRows],
  );

  const accuracy = useMemo(
    () => buildAccuracyWarning(periodRows, unconfirmedCount, accountOverviews, period),
    [periodRows, unconfirmedCount, accountOverviews, period],
  );

  const granularity = chooseBucketGranularity(period);
  const timeBuckets = useMemo(() => bucketLedgerRows(periodRows, period, granularity), [periodRows, period, granularity]);
  const groupBuckets = useMemo(() => groupLedgerRows(periodRows, groupMode, categories), [periodRows, groupMode, categories]);
  const categoryTreeBuckets = useMemo(() => groupByCategoryTree(periodRows, categories), [periodRows, categories]);
  const expenseByCategory = useMemo(
    () => groupLedgerRows(periodRows, "category", categories),
    [periodRows, categories],
  );

  const recurringSeries = useMemo(() => findRecurringSeries(allRows), [allRows]);

  const comparisonLabel = comparisonMode === "previous" ? "к прошлому периоду" : comparisonMode === "yearAgo" ? "год назад" : "";

  function onChartClick(info: EChartClickInfo) {
    if (info.transactionIds.length === 0) return;
    setDrillDown({ title: info.name ?? "Операции", transactionIds: info.transactionIds });
  }

  async function exportPng() {
    const dataUrl = exportRef.current?.();
    if (!dataUrl) return;
    const path = await save({ defaultPath: "dinero-chart.png", filters: [{ name: "PNG", extensions: ["png"] }] });
    if (!path) return;
    const base64 = dataUrl.split(",")[1];
    const bytes = Array.from(atob(base64), (c) => c.charCodeAt(0));
    await invoke("write_file_bytes", { path, contents: bytes });
  }

  async function exportCurrentViewCsv() {
    const ids = [...new Set(periodRows.filter((r) => !r.excluded).map((r) => r.transactionId))];
    const path = await save({ defaultPath: "dinero-analytics.csv", filters: [{ name: "CSV", extensions: ["csv"] }] });
    if (!path) return;
    const db = await getDb();
    const rows = await queryTransactions(db, { ids });
    const csv = buildCsv(rows, categories);
    const bytes = Array.from(new TextEncoder().encode("﻿" + csv));
    await invoke("write_file_bytes", { path, contents: bytes });
  }

  async function handleSetHidden(key: string, hidden: boolean) {
    const db = await getDb();
    await setSeriesHidden(db, key, hidden);
    setRecurringState(await listRecurringSeriesState(db));
  }

  async function handleSetConfirmed(key: string, confirmed: boolean) {
    const db = await getDb();
    await setSeriesConfirmed(db, key, confirmed);
    setRecurringState(await listRecurringSeriesState(db));
  }

  if (loading) {
    return (
      <div className="screen">
        <p className="hint">Загрузка аналитики...</p>
      </div>
    );
  }

  return (
    <div className="screen analytics-screen">
      <h2>Аналитика</h2>

      <AccuracyBanner
        warning={accuracy}
        uncategorizedIds={uncategorizedIds}
        onFixUncategorized={(ids) => setDrillDown({ title: "Без категории", transactionIds: ids })}
        onOpenReview={() => setShowReview(true)}
      />

      <div className="filters analytics-period-bar">
        <select value={periodKind} onChange={(e) => setQuickPeriod(e.target.value as PeriodKind)}>
          <option value="month">Месяц</option>
          <option value="quarter">Квартал</option>
          <option value="year">Год</option>
          <option value="custom">Свой диапазон</option>
        </select>
        {periodKind === "custom" ? (
          <>
            <input
              type="date"
              value={period.start.slice(0, 10)}
              onChange={(e) => setPeriod((p) => ({ ...p, start: `${e.target.value}T00:00:00.000Z` }))}
            />
            <span>—</span>
            <input
              type="date"
              value={period.end.slice(0, 10)}
              onChange={(e) => setPeriod((p) => ({ ...p, end: `${e.target.value}T00:00:00.000Z` }))}
            />
          </>
        ) : (
          <span className="analytics-period-label" onWheel={(e) => navigatePeriod(e.deltaY > 0 ? 1 : -1)}>
            <button type="button" onClick={() => navigatePeriod(-1)} title="Предыдущий период">
              ‹
            </button>
            {formatPeriodLabel(period, periodKind)}
            <button type="button" onClick={() => navigatePeriod(1)} title="Следующий период">
              ›
            </button>
          </span>
        )}
        <select value={comparisonMode} onChange={(e) => setComparisonMode(e.target.value as typeof comparisonMode)}>
          <option value="none">Без сравнения</option>
          <option value="previous">С предыдущим периодом</option>
          <option value="yearAgo">Год назад</option>
        </select>
      </div>

      <div className="filters">
        <select value={accounts.length > 0 && filters.accountIds?.[0] ? filters.accountIds[0] : ""} onChange={(e) => setFilters((f) => ({ ...f, accountIds: e.target.value ? [Number(e.target.value)] : undefined }))}>
          <option value="">Все счета</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        <select
          value={filters.categoryIds?.[0] ?? ""}
          onChange={(e) => setFilters((f) => ({ ...f, categoryIds: e.target.value ? [Number(e.target.value)] : undefined }))}
        >
          <option value="">Все категории</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select value={filters.sign ?? ""} onChange={(e) => setFilters((f) => ({ ...f, sign: (e.target.value || undefined) as AnalyticsFilters["sign"] }))}>
          <option value="">Доход и расход</option>
          <option value="income">Только доход</option>
          <option value="expense">Только расход</option>
        </select>
        <input placeholder="Поиск по описанию/заметке..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <label>
          <input type="checkbox" checked={includeDividends} onChange={(e) => setIncludeDividends(e.target.checked)} />
          дивиденды в доходах
        </label>
      </div>

      <MetricCards
        metrics={metrics}
        comparison={comparisonMetrics}
        comparisonLabel={comparisonLabel}
        onDrillDown={(title, ids) => setDrillDown({ title, transactionIds: ids })}
      />

      <div className="analytics-chart-head">
        <ChartTypeSwitcher value={chartType} onChange={setChartType} />
        {(chartType === "donut" || chartType === "bubble") && (
          <select value={groupMode} onChange={(e) => setGroupMode(e.target.value as GroupMode)}>
            {Object.entries(GROUP_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        )}
        <span className="analytics-export">
          {chartType !== "table" && <button type="button" onClick={exportPng}>PNG</button>}
          <button type="button" onClick={exportCurrentViewCsv}>CSV</button>
        </span>
      </div>

      {chartType === "bar" && <EChart option={buildBarOption(timeBuckets)} onClick={onChartClick} exportRef={exportRef} />}
      {chartType === "line" && <EChart option={buildLineOption(timeBuckets)} onClick={onChartClick} exportRef={exportRef} />}
      {chartType === "donut" && <EChart option={buildDonutOption(groupBuckets)} onClick={onChartClick} exportRef={exportRef} />}
      {chartType === "bubble" && <EChart option={buildBubbleOption(groupBuckets)} onClick={onChartClick} exportRef={exportRef} />}
      {chartType === "treemap" && (
        <EChart option={buildTreemapOption(categoryTreeBuckets)} onClick={onChartClick} exportRef={exportRef} />
      )}
      {chartType === "sankey" && (
        <EChart
          option={buildSankeyOption(metrics.incomeTiyin, expenseByCategory)}
          onClick={onChartClick}
          exportRef={exportRef}
        />
      )}
      {chartType === "calendar" && (
        <EChart
          option={buildCalendarHeatmapOption(timeBuckets, period.start, period.end)}
          onClick={onChartClick}
          exportRef={exportRef}
          height={200}
        />
      )}
      {chartType === "table" && (
        <CategoryTreeTable buckets={categoryTreeBuckets} onDrillDown={(title, ids) => setDrillDown({ title, transactionIds: ids })} />
      )}

      <AccountsOverview accounts={accountOverviews} />

      <RecurringPaymentsPanel
        series={recurringSeries}
        state={recurringState}
        onSetHidden={handleSetHidden}
        onSetConfirmed={handleSetConfirmed}
        onDrillDown={(title, ids) => setDrillDown({ title, transactionIds: ids })}
      />

      {drillDown && (
        <DrillDownDialog
          title={drillDown.title}
          transactionIds={drillDown.transactionIds}
          categories={categories}
          onClose={() => setDrillDown(null)}
          onChanged={refresh}
        />
      )}

      {showReview && (
        <ReviewScreen
          onClose={() => {
            setShowReview(false);
            refresh();
          }}
          onCountChange={setUnconfirmedCount}
        />
      )}
    </div>
  );
}
