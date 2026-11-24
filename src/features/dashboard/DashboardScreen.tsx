import { useCallback, useEffect, useMemo, useState } from "react";
import { WidthProvider } from "react-grid-layout/legacy";
import type { Layout as RglLayout } from "react-grid-layout/legacy";
import ReactGridLayout from "react-grid-layout/legacy";
import "react-grid-layout/css/styles.css";
import { getDb } from "../../db/client";
import type { Account } from "../../db/accounts";
import type { Category } from "../../db/categories";
import type { LedgerRow } from "../../db/ledgerQuery";
import type { AccountOverview } from "../../db/accountOverview";
import type { RecurringSeries } from "../../analytics/recurringPayments";
import type { RecurringSeriesState } from "../../db/recurringSeriesState";
import {
  listPresets,
  createPreset,
  updatePresetConfig,
  renamePreset,
  deletePreset,
  duplicatePreset,
  reorderPresets,
  setDefaultPreset,
  ensureStarterPresets,
  type DashboardPreset,
} from "../../db/dashboardPresets";
import {
  defaultPresetConfig,
  type PresetConfig,
  type WidgetConfig,
  type WidgetType,
} from "../../dashboard/presetConfig";
import { FLOATING_PERIOD_LABELS, resolvePeriodSpec, type FloatingPeriodId } from "../../analytics/floatingPeriod";
import type { GroupMode } from "../../analytics/grouping";
import { selectPeriodRows } from "../../analytics/selectPeriodRows";
import { renderWidget, DEFAULT_WIDGET_LAYOUT } from "./widgetRegistry";
import { WidgetFrame } from "./WidgetFrame";
import { PresetChips } from "./PresetChips";
import { PresetNameDialog } from "./PresetNameDialog";
import { AddWidgetMenu } from "./AddWidgetMenu";

const GridLayout = WidthProvider(ReactGridLayout);

const GROUP_LABELS: Record<GroupMode, string> = {
  category: "Категории",
  account: "Счета",
  counterparty: "Контрагенты",
  weekday: "Дни недели",
  month: "Месяцы",
};

function isMobile(): boolean {
  return typeof window !== "undefined" && window.innerWidth <= 768;
}

export function DashboardScreen({
  allRows,
  categories,
  accounts,
  accountOverviews,
  recurringSeries,
  recurringState,
  onDrillDown,
  onSetHidden,
  onSetConfirmed,
}: {
  allRows: LedgerRow[];
  categories: Category[];
  accounts: Account[];
  accountOverviews: AccountOverview[];
  recurringSeries: RecurringSeries[];
  recurringState: Map<string, RecurringSeriesState>;
  onDrillDown: (title: string, transactionIds: number[]) => void;
  onSetHidden: (key: string, hidden: boolean) => void;
  onSetConfirmed: (key: string, confirmed: boolean) => void;
}) {
  const [presets, setPresets] = useState<DashboardPreset[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [config, setConfig] = useState<PresetConfig>(defaultPresetConfig());
  const [overrides, setOverrides] = useState<Partial<Pick<PresetConfig, "period" | "groupMode" | "filters">>>({});
  const [mobile, setMobile] = useState(isMobile());
  const [nameDialog, setNameDialog] = useState<"new" | DashboardPreset | null>(null);

  const refreshPresets = useCallback(async () => {
    const db = await getDb();
    await ensureStarterPresets(db);
    const list = await listPresets(db);
    setPresets(list);
    return list;
  }, []);

  useEffect(() => {
    refreshPresets().then((list) => {
      const initial = list.find((p) => p.isDefault) ?? list[0];
      if (initial) setActiveId(initial.id);
    });
  }, [refreshPresets]);

  useEffect(() => {
    const onResize = () => setMobile(isMobile());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    const active = presets.find((p) => p.id === activeId);
    if (active) setConfig(active.config);
    setOverrides({});
  }, [activeId, presets]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLElement && (e.target.tagName === "INPUT" || e.target.tagName === "SELECT")) return;
      const n = Number(e.key);
      if (n >= 1 && n <= 9 && presets[n - 1]) setActiveId(presets[n - 1].id);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [presets]);

  function persist(nextConfig: PresetConfig) {
    setConfig(nextConfig);
    if (activeId === null) return;
    getDb().then((db) => updatePresetConfig(db, activeId, nextConfig));
  }

  const effective = { ...config, ...overrides };
  const hasOverrides = Object.keys(overrides).length > 0;

  async function updateFromView() {
    if (activeId === null) return;
    const db = await getDb();
    await updatePresetConfig(db, activeId, effective);
    setConfig(effective);
    setOverrides({});
  }

  async function saveAsNewPreset(name: string, icon: string | null) {
    const db = await getDb();
    const id = await createPreset(db, name, icon, effective);
    setPresets(await listPresets(db));
    setActiveId(id);
    setNameDialog(null);
  }

  function addWidget(type: WidgetType) {
    const maxY = config.widgets.reduce((m, w) => Math.max(m, w.layout.y + w.layout.h), 0);
    const widget: WidgetConfig = {
      id: crypto.randomUUID(),
      type,
      layout: { ...DEFAULT_WIDGET_LAYOUT, y: maxY },
      ownSettings: false,
    };
    persist({ ...config, widgets: [...config.widgets, widget] });
  }

  function duplicateWidget(widget: WidgetConfig) {
    const maxY = config.widgets.reduce((m, w) => Math.max(m, w.layout.y + w.layout.h), 0);
    const copy: WidgetConfig = { ...widget, id: crypto.randomUUID(), layout: { ...widget.layout, y: maxY } };
    persist({ ...config, widgets: [...config.widgets, copy] });
  }

  function removeWidget(id: string) {
    persist({ ...config, widgets: config.widgets.filter((w) => w.id !== id) });
  }

  function updateWidget(next: WidgetConfig) {
    persist({ ...config, widgets: config.widgets.map((w) => (w.id === next.id ? next : w)) });
  }

  function applyLayout(layout: RglLayout) {
    const next = {
      ...config,
      widgets: config.widgets.map((w) => {
        const item = layout.find((l) => l.i === w.id);
        return item ? { ...w, layout: { x: item.x, y: item.y, w: item.w, h: item.h } } : w;
      }),
    };
    persist(next);
  }

  const widgetContexts = useMemo(
    () =>
      config.widgets.map((widget) => {
        const period = resolvePeriodSpec(widget.ownSettings ? widget.period ?? effective.period : effective.period);
        const groupMode = widget.ownSettings ? widget.groupMode ?? effective.groupMode : effective.groupMode;
        const filters = widget.ownSettings ? widget.filters ?? effective.filters : effective.filters;
        const periodRows = selectPeriodRows(allRows, period, filters);
        return {
          widget,
          ctx: {
            periodRows,
            allRows: allRows as LedgerRow[],
            period,
            groupMode,
            categories,
            accountOverviews,
            recurringSeries,
            recurringState,
            onDrillDown,
            onSetHidden,
            onSetConfirmed,
          },
        };
      }),
    [config.widgets, effective, allRows, categories, accountOverviews, recurringSeries, recurringState, onDrillDown, onSetHidden, onSetConfirmed],
  );

  const activePreset = presets.find((p) => p.id === activeId) ?? null;

  const layout: RglLayout = config.widgets.map((w) => ({ i: w.id, x: w.layout.x, y: w.layout.y, w: w.layout.w, h: w.layout.h }));

  return (
    <div className="dashboard-screen">
      <div className="dashboard-toolbar">
        <PresetChips
          presets={presets}
          activeId={activeId}
          onSelect={setActiveId}
          onReorder={async (ids) => {
            const db = await getDb();
            await reorderPresets(db, ids);
            setPresets(await listPresets(db));
          }}
          onRename={(preset) => setNameDialog(preset)}
          onDuplicate={async (id) => {
            const db = await getDb();
            const newId = await duplicatePreset(db, id);
            setPresets(await listPresets(db));
            setActiveId(newId);
          }}
          onDelete={async (preset) => {
            if (!window.confirm(`Удалить пресет «${preset.name}»?`)) return;
            const db = await getDb();
            await deletePreset(db, preset.id);
            const list = await listPresets(db);
            setPresets(list);
            if (activeId === preset.id) setActiveId(list[0]?.id ?? null);
          }}
          onSetDefault={async (id) => {
            const db = await getDb();
            await setDefaultPreset(db, id);
            setPresets(await listPresets(db));
          }}
        />
        <button type="button" onClick={() => setNameDialog("new")}>
          Сохранить как пресет
        </button>
        <button type="button" disabled={!hasOverrides} onClick={updateFromView}>
          Обновить текущим видом
        </button>
      </div>

      <div className="filters dashboard-settings">
        <select
          value={effective.period.kind === "floating" ? effective.period.id : "fixed"}
          onChange={(e) =>
            setOverrides((o) => ({
              ...o,
              period:
                e.target.value === "fixed"
                  ? { kind: "fixed", start: new Date().toISOString(), end: new Date().toISOString() }
                  : { kind: "floating", id: e.target.value as FloatingPeriodId },
            }))
          }
        >
          {Object.entries(FLOATING_PERIOD_LABELS).map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
          <option value="fixed">Фиксированный диапазон</option>
        </select>
        {effective.period.kind === "fixed" && (
          <>
            <input
              type="date"
              value={effective.period.start.slice(0, 10)}
              onChange={(e) =>
                setOverrides((o) => ({
                  ...o,
                  period: { kind: "fixed", start: `${e.target.value}T00:00:00.000Z`, end: effective.period.kind === "fixed" ? effective.period.end : new Date().toISOString() },
                }))
              }
            />
            <span>—</span>
            <input
              type="date"
              value={effective.period.kind === "fixed" ? effective.period.end.slice(0, 10) : ""}
              onChange={(e) =>
                setOverrides((o) => ({
                  ...o,
                  period: { kind: "fixed", start: effective.period.kind === "fixed" ? effective.period.start : new Date().toISOString(), end: `${e.target.value}T00:00:00.000Z` },
                }))
              }
            />
          </>
        )}
        <select value={effective.groupMode} onChange={(e) => setOverrides((o) => ({ ...o, groupMode: e.target.value as GroupMode }))}>
          {Object.entries(GROUP_LABELS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
        <AddWidgetMenu onAdd={addWidget} />
      </div>

      {!activePreset ? (
        <p className="hint">Загрузка дашборда...</p>
      ) : config.widgets.length === 0 ? (
        <p className="hint">Пустой пресет — добавьте виджет.</p>
      ) : mobile ? (
        <div className="dashboard-mobile-stack">
          {widgetContexts.map(({ widget, ctx }) => (
            <WidgetFrame
              key={widget.id}
              config={widget}
              accounts={accounts}
              onUpdate={updateWidget}
              onDuplicate={() => duplicateWidget(widget)}
              onRemove={() => removeWidget(widget.id)}
            >
              {renderWidget(widget, ctx)}
            </WidgetFrame>
          ))}
        </div>
      ) : (
        <GridLayout
          layout={layout}
          cols={12}
          rowHeight={40}
          margin={[10, 10]}
          draggableHandle=".widget-drag-handle"
          onDragStop={(l) => applyLayout(l)}
          onResizeStop={(l) => applyLayout(l)}
        >
          {config.widgets.map((widget) => {
            const entry = widgetContexts.find((w) => w.widget.id === widget.id)!;
            return (
              <div key={widget.id}>
                <WidgetFrame
                  config={widget}
                  accounts={accounts}
                  onUpdate={updateWidget}
                  onDuplicate={() => duplicateWidget(widget)}
                  onRemove={() => removeWidget(widget.id)}
                >
                  {renderWidget(widget, entry.ctx)}
                </WidgetFrame>
              </div>
            );
          })}
        </GridLayout>
      )}

      {nameDialog && (
        <PresetNameDialog
          title={nameDialog === "new" ? "Сохранить как пресет" : "Переименовать пресет"}
          initialName={nameDialog === "new" ? "Новый пресет" : nameDialog.name}
          initialIcon={nameDialog === "new" ? null : nameDialog.icon}
          onClose={() => setNameDialog(null)}
          onSave={async (name, icon) => {
            if (nameDialog === "new") {
              await saveAsNewPreset(name, icon);
            } else {
              const db = await getDb();
              await renamePreset(db, nameDialog.id, name, icon);
              setPresets(await listPresets(db));
              setNameDialog(null);
            }
          }}
        />
      )}
    </div>
  );
}
