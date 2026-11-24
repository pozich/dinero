-- SPEC-2.md 7: dashboard presets. Widget layout/settings aren't modeled as
-- tables — a defensive JSON parse (unknown fields ignored, missing fields
-- defaulted, see src/dashboard/presetConfig.ts) is robust enough for config
-- that only this app's own code ever writes, unlike a real data schema.
CREATE TABLE dashboard_presets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    icon TEXT,
    sort_order INTEGER NOT NULL,
    is_default INTEGER NOT NULL DEFAULT 0,
    config TEXT NOT NULL
);
