import { describe, expect, it } from "vitest";
import { normalizeDescription } from "../../src/transfers/normalizeDescription";

describe("normalizeDescription", () => {
  it("trims, lowercases, and collapses internal whitespace", () => {
    expect(normalizeDescription("  Магазин   Такой ")).toBe("магазин такой");
  });

  it("leaves an already-normalized string unchanged", () => {
    expect(normalizeDescription("ozon.kz")).toBe("ozon.kz");
  });
});
