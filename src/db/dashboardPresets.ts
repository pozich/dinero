import type { DbClient } from "./types";
import {
  parsePresetConfig,
  serializePresetConfig,
  defaultPresetConfig,
  type PresetConfig,
} from "../dashboard/presetConfig";

export type DashboardPreset = {
  id: number;
  name: string;
  icon: string | null;
  sortOrder: number;
  isDefault: boolean;
  config: PresetConfig;
};

type PresetRow = {
  id: number;
  name: string;
  icon: string | null;
  sort_order: number;
  is_default: number;
  config: string;
};

function fromRow(row: PresetRow): DashboardPreset {
  return {
    id: row.id,
    name: row.name,
    icon: row.icon,
    sortOrder: row.sort_order,
    isDefault: row.is_default === 1,
    config: parsePresetConfig(row.config),
  };
}

export async function listPresets(db: DbClient): Promise<DashboardPreset[]> {
  const rows = await db.select<PresetRow[]>("SELECT * FROM dashboard_presets ORDER BY sort_order");
  return rows.map(fromRow);
}

export async function createPreset(
  db: DbClient,
  name: string,
  icon: string | null,
  config: PresetConfig = defaultPresetConfig(),
): Promise<number> {
  const rows = await db.select<{ maxOrder: number | null }[]>(
    "SELECT MAX(sort_order) AS maxOrder FROM dashboard_presets",
  );
  const sortOrder = (rows[0]?.maxOrder ?? -1) + 1;
  const result = await db.execute(
    "INSERT INTO dashboard_presets (name, icon, sort_order, is_default, config) VALUES ($1, $2, $3, 0, $4)",
    [name, icon, sortOrder, serializePresetConfig(config)],
  );
  return result.lastInsertId!;
}

export async function updatePresetConfig(db: DbClient, id: number, config: PresetConfig): Promise<void> {
  await db.execute("UPDATE dashboard_presets SET config = $1 WHERE id = $2", [serializePresetConfig(config), id]);
}

export async function renamePreset(db: DbClient, id: number, name: string, icon: string | null): Promise<void> {
  await db.execute("UPDATE dashboard_presets SET name = $1, icon = $2 WHERE id = $3", [name, icon, id]);
}

export async function deletePreset(db: DbClient, id: number): Promise<void> {
  await db.execute("DELETE FROM dashboard_presets WHERE id = $1", [id]);
}

export async function duplicatePreset(db: DbClient, id: number): Promise<number> {
  const rows = await db.select<PresetRow[]>("SELECT * FROM dashboard_presets WHERE id = $1", [id]);
  const original = rows[0];
  if (!original) throw new Error(`Preset ${id} not found`);
  return createPreset(db, `${original.name} (копия)`, original.icon, parsePresetConfig(original.config));
}

/** Drag-to-reorder (SPEC-2.md 7) — `orderedIds` is the whole new order, one
 * UPDATE per row rather than a single batched statement (presets are a
 * handful at a time, not worth the complexity of a bulk upsert). */
export async function reorderPresets(db: DbClient, orderedIds: readonly number[]): Promise<void> {
  for (let i = 0; i < orderedIds.length; i++) {
    await db.execute("UPDATE dashboard_presets SET sort_order = $1 WHERE id = $2", [i, orderedIds[i]]);
  }
}

export async function setDefaultPreset(db: DbClient, id: number): Promise<void> {
  await db.execute("UPDATE dashboard_presets SET is_default = 0", []);
  await db.execute("UPDATE dashboard_presets SET is_default = 1 WHERE id = $1", [id]);
}

/** 2–3 стартовых встроенных пресета (SPEC-2.md 7) — created in code the
 * first time the dashboard loads into an empty table, not via a seed
 * migration, since the user is free to rename/replace/delete them
 * afterward exactly like any preset they made themselves. */
export async function ensureStarterPresets(db: DbClient): Promise<void> {
  const existing = await listPresets(db);
  if (existing.length > 0) return;

  const thisMonthId = await createPreset(db, "Этот месяц", "📅", {
    period: { kind: "floating", id: "thisMonth" },
    groupMode: "category",
    filters: {},
    widgets: [
      { id: "w-bar", type: "bar", layout: { x: 0, y: 0, w: 8, h: 5 }, ownSettings: false },
      { id: "w-donut", type: "donut", layout: { x: 8, y: 0, w: 4, h: 5 }, ownSettings: false },
      { id: "w-metrics", type: "metricCards", layout: { x: 0, y: 5, w: 12, h: 3 }, ownSettings: false },
    ],
  });
  await createPreset(db, "Последние 3 месяца", "📈", {
    period: { kind: "floating", id: "last3Months" },
    groupMode: "category",
    filters: {},
    widgets: [
      { id: "w-line", type: "line", layout: { x: 0, y: 0, w: 8, h: 5 }, ownSettings: false },
      { id: "w-table", type: "table", layout: { x: 8, y: 0, w: 4, h: 5 }, ownSettings: false },
    ],
  });
  await createPreset(db, "Этот год", "🗓", {
    period: { kind: "floating", id: "thisYear" },
    groupMode: "category",
    filters: {},
    widgets: [
      { id: "w-treemap", type: "treemap", layout: { x: 0, y: 0, w: 6, h: 6 }, ownSettings: false },
      { id: "w-recurring", type: "recurringPayments", layout: { x: 6, y: 0, w: 6, h: 6 }, ownSettings: false },
    ],
  });
  await setDefaultPreset(db, thisMonthId);
}
