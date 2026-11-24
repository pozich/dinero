import { describe, expect, it } from "vitest";
import {
  defaultPresetConfig,
  parsePresetConfig,
  serializePresetConfig,
  type PresetConfig,
} from "../../src/dashboard/presetConfig";

describe("parsePresetConfig", () => {
  it("falls back to a default config for invalid JSON", () => {
    expect(parsePresetConfig("not json")).toEqual(defaultPresetConfig());
  });

  it("falls back to a default config for a JSON value that isn't an object", () => {
    expect(parsePresetConfig("42")).toEqual(defaultPresetConfig());
    expect(parsePresetConfig("[1,2,3]")).toEqual(defaultPresetConfig());
  });

  it("round-trips a fully valid config through serialize/parse", () => {
    const config: PresetConfig = {
      period: { kind: "fixed", start: "2025-01-01T00:00:00.000Z", end: "2025-02-01T00:00:00.000Z" },
      groupMode: "account",
      filters: { accountIds: [1, 2], sign: "expense", search: "магнум" },
      widgets: [
        {
          id: "w1",
          type: "bar",
          layout: { x: 0, y: 0, w: 6, h: 4 },
          ownSettings: false,
        },
      ],
    };
    expect(parsePresetConfig(serializePresetConfig(config))).toEqual(config);
  });

  it("defaults a missing top-level field instead of dropping the rest", () => {
    const raw = JSON.stringify({ groupMode: "weekday", widgets: [] });
    const parsed = parsePresetConfig(raw);
    expect(parsed.groupMode).toBe("weekday");
    expect(parsed.period).toEqual(defaultPresetConfig().period);
    expect(parsed.filters).toEqual({});
  });

  it("ignores unknown fields anywhere in the blob", () => {
    const raw = JSON.stringify({
      groupMode: "category",
      somethingFromTheFuture: true,
      widgets: [{ id: "w1", type: "bar", layout: { x: 0, y: 0, w: 4, h: 4 }, ownSettings: false, extra: 123 }],
    });
    const parsed = parsePresetConfig(raw);
    expect(parsed).not.toHaveProperty("somethingFromTheFuture");
    expect(parsed.widgets[0]).not.toHaveProperty("extra");
  });

  it("drops a widget with an unrecognized type instead of keeping a broken entry", () => {
    const raw = JSON.stringify({
      widgets: [
        { id: "w1", type: "bar", layout: { x: 0, y: 0, w: 4, h: 4 }, ownSettings: false },
        { id: "w2", type: "not-a-real-widget", layout: { x: 0, y: 0, w: 4, h: 4 }, ownSettings: false },
      ],
    });
    const parsed = parsePresetConfig(raw);
    expect(parsed.widgets).toHaveLength(1);
    expect(parsed.widgets[0].id).toBe("w1");
  });

  it("generates an id for a widget missing one", () => {
    const raw = JSON.stringify({ widgets: [{ type: "donut", layout: { x: 0, y: 0, w: 4, h: 4 }, ownSettings: false }] });
    expect(parsePresetConfig(raw).widgets[0].id).toBeTruthy();
  });

  it("falls back to a default layout for a malformed one", () => {
    const raw = JSON.stringify({ widgets: [{ id: "w1", type: "table", layout: "nope", ownSettings: false }] });
    expect(parsePresetConfig(raw).widgets[0].layout).toEqual({ x: 0, y: 0, w: 4, h: 4 });
  });

  it("only parses a widget's own period/groupMode/filters when ownSettings is true", () => {
    const raw = JSON.stringify({
      widgets: [
        {
          id: "w1",
          type: "bar",
          layout: { x: 0, y: 0, w: 4, h: 4 },
          ownSettings: false,
          period: { kind: "floating", id: "thisYear" },
        },
      ],
    });
    expect(parsePresetConfig(raw).widgets[0].period).toBeUndefined();
  });

  it("rejects an invalid floating period id and falls back to the default period", () => {
    const raw = JSON.stringify({ period: { kind: "floating", id: "nextCentury" } });
    expect(parsePresetConfig(raw).period).toEqual(defaultPresetConfig().period);
  });
});
