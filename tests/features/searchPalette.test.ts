import { describe, expect, it } from "vitest";
import { searchPalette } from "../../src/features/commandPalette/searchPalette";

const items = [{ label: "Импортировать выписки" }, { label: "Новая операция" }, { label: "Экспорт CSV" }];

describe("searchPalette", () => {
  it("returns everything (capped) for an empty query", () => {
    expect(searchPalette(items, "")).toHaveLength(3);
  });

  it("matches a substring, case-insensitively", () => {
    expect(searchPalette(items, "ЭКСПОРТ")).toEqual([{ label: "Экспорт CSV" }]);
  });

  it("returns nothing when nothing matches", () => {
    expect(searchPalette(items, "zzz")).toHaveLength(0);
  });

  it("caps results at 20", () => {
    const many = Array.from({ length: 30 }, (_, i) => ({ label: `item ${i}` }));
    expect(searchPalette(many, "item")).toHaveLength(20);
  });
});
