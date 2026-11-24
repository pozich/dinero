import { useState } from "react";
import type { ReactNode } from "react";
import type { Account } from "../../db/accounts";
import type { WidgetConfig } from "../../dashboard/presetConfig";
import type { GroupMode } from "../../analytics/grouping";
import { FLOATING_PERIOD_LABELS, type FloatingPeriodId } from "../../analytics/floatingPeriod";
import { WIDGET_LABELS } from "./widgetRegistry";

const GROUP_LABELS: Record<GroupMode, string> = {
  category: "Категории",
  account: "Счета",
  counterparty: "Контрагенты",
  weekday: "Дни недели",
  month: "Месяцы",
};

/** SPEC-2.md 7: "каждый виджет со своими настройками... или наследует
 * общие настройки дашборда (тумблер «свои настройки»)". Per-widget period
 * override is floating-only (not a custom fixed range) — kept simple on
 * purpose, see HANDOFF.md. */
export function WidgetFrame({
  config,
  accounts,
  onUpdate,
  onDuplicate,
  onRemove,
  children,
}: {
  config: WidgetConfig;
  accounts: Account[];
  onUpdate: (next: WidgetConfig) => void;
  onDuplicate: () => void;
  onRemove: () => void;
  children: ReactNode;
}) {
  const [showSettings, setShowSettings] = useState(false);

  function toggleOwnSettings(own: boolean) {
    onUpdate({
      ...config,
      ownSettings: own,
      period: own ? config.period ?? { kind: "floating", id: "thisMonth" } : undefined,
      groupMode: own ? config.groupMode ?? "category" : undefined,
      filters: own ? config.filters ?? {} : undefined,
    });
  }

  return (
    <div className="widget-frame">
      <div className="widget-frame-head widget-drag-handle">
        <span className="widget-frame-title">{WIDGET_LABELS[config.type]}</span>
        <span className="widget-frame-actions">
          <button type="button" title="Настройки виджета" onClick={() => setShowSettings((v) => !v)}>
            ⚙
          </button>
          <button type="button" title="Дублировать" onClick={onDuplicate}>
            ⧉
          </button>
          <button type="button" title="Удалить" onClick={onRemove}>
            ✕
          </button>
        </span>
      </div>
      {showSettings && (
        <div className="widget-settings">
          <label>
            <input type="checkbox" checked={config.ownSettings} onChange={(e) => toggleOwnSettings(e.target.checked)} />
            свои настройки
          </label>
          {config.ownSettings && (
            <>
              <select
                value={config.period?.kind === "floating" ? config.period.id : "thisMonth"}
                onChange={(e) => onUpdate({ ...config, period: { kind: "floating", id: e.target.value as FloatingPeriodId } })}
              >
                {Object.entries(FLOATING_PERIOD_LABELS).map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
              {(config.type === "donut" || config.type === "bubble") && (
                <select
                  value={config.groupMode ?? "category"}
                  onChange={(e) => onUpdate({ ...config, groupMode: e.target.value as GroupMode })}
                >
                  {Object.entries(GROUP_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              )}
              <select
                value={config.filters?.accountIds?.[0] ?? ""}
                onChange={(e) =>
                  onUpdate({
                    ...config,
                    filters: { ...config.filters, accountIds: e.target.value ? [Number(e.target.value)] : undefined },
                  })
                }
              >
                <option value="">Все счета</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </>
          )}
        </div>
      )}
      <div className="widget-frame-body">{children}</div>
    </div>
  );
}
