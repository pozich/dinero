import { FLOATING_PERIOD_LABELS, type FloatingPeriodId, type PeriodSpec } from "../analytics/floatingPeriod";
import type { GroupMode } from "../analytics/grouping";
import type { AnalyticsFilters } from "../analytics/filters";

export const WIDGET_TYPES = [
  "bar",
  "line",
  "donut",
  "bubble",
  "treemap",
  "sankey",
  "calendar",
  "table",
  "metricCards",
  "accountsOverview",
  "recurringPayments",
  "investmentPositions",
  "investmentComposition",
  "goals",
] as const;
export type WidgetType = (typeof WIDGET_TYPES)[number];

const GROUP_MODES: readonly GroupMode[] = ["category", "account", "counterparty", "weekday", "month"];
const FLOATING_PERIOD_IDS = Object.keys(FLOATING_PERIOD_LABELS) as FloatingPeriodId[];

export type WidgetLayout = { x: number; y: number; w: number; h: number };

export type WidgetConfig = {
  id: string;
  type: WidgetType;
  layout: WidgetLayout;
  ownSettings: boolean;
  period?: PeriodSpec;
  groupMode?: GroupMode;
  filters?: AnalyticsFilters;
};

export type PresetConfig = {
  period: PeriodSpec;
  groupMode: GroupMode;
  filters: AnalyticsFilters;
  widgets: WidgetConfig[];
};

function defaultPeriodSpec(): PeriodSpec {
  return { kind: "floating", id: "thisMonth" };
}

export function defaultPresetConfig(): PresetConfig {
  return { period: defaultPeriodSpec(), groupMode: "category", filters: {}, widgets: [] };
}

function parsePeriodSpec(value: unknown): PeriodSpec {
  if (value && typeof value === "object") {
    const v = value as Record<string, unknown>;
    if (v.kind === "fixed" && typeof v.start === "string" && typeof v.end === "string") {
      return { kind: "fixed", start: v.start, end: v.end };
    }
    if (v.kind === "floating" && typeof v.id === "string" && FLOATING_PERIOD_IDS.includes(v.id as FloatingPeriodId)) {
      return { kind: "floating", id: v.id as FloatingPeriodId };
    }
  }
  return defaultPeriodSpec();
}

function parseGroupMode(value: unknown): GroupMode {
  return typeof value === "string" && GROUP_MODES.includes(value as GroupMode) ? (value as GroupMode) : "category";
}

function isNumberArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((v) => typeof v === "number");
}

/** Only known, type-checked fields survive — anything else in the stored
 * JSON (an old field from a future version, a typo) is silently dropped
 * rather than carried through or causing a crash. */
function parseFilters(value: unknown): AnalyticsFilters {
  if (!value || typeof value !== "object") return {};
  const v = value as Record<string, unknown>;
  const filters: AnalyticsFilters = {};
  if (isNumberArray(v.accountIds)) filters.accountIds = v.accountIds;
  if (isNumberArray(v.categoryIds)) filters.categoryIds = v.categoryIds;
  if (v.sign === "income" || v.sign === "expense") filters.sign = v.sign;
  if (typeof v.minAmountTiyin === "number") filters.minAmountTiyin = v.minAmountTiyin;
  if (typeof v.maxAmountTiyin === "number") filters.maxAmountTiyin = v.maxAmountTiyin;
  if (typeof v.search === "string") filters.search = v.search;
  return filters;
}

function parseLayout(value: unknown, fallback: WidgetLayout): WidgetLayout {
  if (!value || typeof value !== "object") return fallback;
  const v = value as Record<string, unknown>;
  const { x, y, w, h } = v;
  if (typeof x === "number" && typeof y === "number" && typeof w === "number" && typeof h === "number") {
    return { x, y, w, h };
  }
  return fallback;
}

let widgetIdCounter = 0;
function generateWidgetId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  widgetIdCounter += 1;
  return `widget-${Date.now()}-${widgetIdCounter}`;
}

/** Returns null for anything that isn't a recognizable widget (unknown
 * type, not an object) — the caller drops those instead of ever rendering
 * a broken widget. */
function parseWidgetConfig(value: unknown): WidgetConfig | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (typeof v.type !== "string" || !WIDGET_TYPES.includes(v.type as WidgetType)) return null;

  const config: WidgetConfig = {
    id: typeof v.id === "string" && v.id.length > 0 ? v.id : generateWidgetId(),
    type: v.type as WidgetType,
    layout: parseLayout(v.layout, { x: 0, y: 0, w: 4, h: 4 }),
    ownSettings: v.ownSettings === true,
  };
  if (config.ownSettings) {
    config.period = parsePeriodSpec(v.period);
    config.groupMode = parseGroupMode(v.groupMode);
    config.filters = parseFilters(v.filters);
  }
  return config;
}

/** Defensive parse per SPEC-2.md 7's own decision: a corrupt or
 * unparseable blob never crashes the dashboard — it degrades to an empty
 * preset instead, and every widget inside is validated on its own so one
 * bad entry doesn't take down the rest. */
export function parsePresetConfig(raw: string): PresetConfig {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return defaultPresetConfig();
  }
  if (!parsed || typeof parsed !== "object") return defaultPresetConfig();
  const v = parsed as Record<string, unknown>;

  const widgets = Array.isArray(v.widgets)
    ? v.widgets.map(parseWidgetConfig).filter((w): w is WidgetConfig => w !== null)
    : [];

  return {
    period: parsePeriodSpec(v.period),
    groupMode: parseGroupMode(v.groupMode),
    filters: parseFilters(v.filters),
    widgets,
  };
}

export function serializePresetConfig(config: PresetConfig): string {
  return JSON.stringify(config);
}
