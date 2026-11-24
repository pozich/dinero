import { describe, expect, it } from "vitest";
import { createTestDb } from "../testDb";
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
} from "../../src/db/dashboardPresets";
import { defaultPresetConfig } from "../../src/dashboard/presetConfig";

describe("dashboardPresets", () => {
  it("creates and lists presets ordered by sort_order", async () => {
    const db = createTestDb();
    await createPreset(db, "A", "📅");
    await createPreset(db, "B", "📈");
    const presets = await listPresets(db);
    expect(presets.map((p) => p.name)).toEqual(["A", "B"]);
    expect(presets.map((p) => p.sortOrder)).toEqual([0, 1]);
  });

  it("stores and round-trips a preset's config", async () => {
    const db = createTestDb();
    const config = { ...defaultPresetConfig(), groupMode: "weekday" as const };
    const id = await createPreset(db, "Custom", null, config);
    const [preset] = await listPresets(db);
    expect(preset.id).toBe(id);
    expect(preset.config.groupMode).toBe("weekday");
  });

  it("updates just the config, leaving name/icon untouched", async () => {
    const db = createTestDb();
    const id = await createPreset(db, "A", "📅");
    await updatePresetConfig(db, id, { ...defaultPresetConfig(), groupMode: "account" });
    const [preset] = await listPresets(db);
    expect(preset.name).toBe("A");
    expect(preset.config.groupMode).toBe("account");
  });

  it("renames a preset", async () => {
    const db = createTestDb();
    const id = await createPreset(db, "Old", "📅");
    await renamePreset(db, id, "New", "📈");
    const [preset] = await listPresets(db);
    expect(preset.name).toBe("New");
    expect(preset.icon).toBe("📈");
  });

  it("deletes a preset", async () => {
    const db = createTestDb();
    const id = await createPreset(db, "A", null);
    await deletePreset(db, id);
    expect(await listPresets(db)).toHaveLength(0);
  });

  it("duplicates a preset with its config and a '(копия)' suffix, appended at the end", async () => {
    const db = createTestDb();
    const config = { ...defaultPresetConfig(), groupMode: "month" as const };
    const id = await createPreset(db, "Original", "📅", config);
    await duplicatePreset(db, id);
    const presets = await listPresets(db);
    expect(presets).toHaveLength(2);
    expect(presets[1].name).toBe("Original (копия)");
    expect(presets[1].config.groupMode).toBe("month");
  });

  it("reorders presets by the given id order", async () => {
    const db = createTestDb();
    const a = await createPreset(db, "A", null);
    const b = await createPreset(db, "B", null);
    const c = await createPreset(db, "C", null);
    await reorderPresets(db, [c, a, b]);
    const presets = await listPresets(db);
    expect(presets.map((p) => p.name)).toEqual(["C", "A", "B"]);
  });

  it("sets exactly one preset as default at a time", async () => {
    const db = createTestDb();
    const a = await createPreset(db, "A", null);
    const b = await createPreset(db, "B", null);
    await setDefaultPreset(db, a);
    await setDefaultPreset(db, b);
    const presets = await listPresets(db);
    expect(presets.find((p) => p.id === a)?.isDefault).toBe(false);
    expect(presets.find((p) => p.id === b)?.isDefault).toBe(true);
  });

  it("creates starter presets only when the table is empty", async () => {
    const db = createTestDb();
    await ensureStarterPresets(db);
    const presets = await listPresets(db);
    expect(presets.length).toBeGreaterThanOrEqual(2);
    expect(presets.some((p) => p.isDefault)).toBe(true);

    await ensureStarterPresets(db);
    expect(await listPresets(db)).toHaveLength(presets.length);
  });
});
