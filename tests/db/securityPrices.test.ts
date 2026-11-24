import { describe, expect, it } from "vitest";
import { createTestDb } from "../testDb";
import {
  listPrices,
  getPriceOnOrBefore,
  getLatestPriceDate,
  upsertPrices,
  refreshPrices,
} from "../../src/db/securityPrices";
import type { PriceSource, PriceSourceResult } from "../../src/investments/PriceSource";

function fakeSource(byTicker: Record<string, PriceSourceResult>): PriceSource {
  return {
    async fetchHistory(ticker) {
      return byTicker[ticker] ?? { ok: true, prices: [] };
    },
  };
}

describe("security price cache", () => {
  it("upserts and lists prices in date order", async () => {
    const db = createTestDb();
    await upsertPrices(db, "KZ1C00001536", [
      { date: "2026-01-02", closeTiyin: 100 },
      { date: "2026-01-01", closeTiyin: 90 },
    ]);
    expect(await listPrices(db, "KZ1C00001536")).toEqual([
      { date: "2026-01-01", closeTiyin: 90 },
      { date: "2026-01-02", closeTiyin: 100 },
    ]);
  });

  it("overwrites an existing day's price instead of duplicating it", async () => {
    const db = createTestDb();
    await upsertPrices(db, "X", [{ date: "2026-01-01", closeTiyin: 100 }]);
    await upsertPrices(db, "X", [{ date: "2026-01-01", closeTiyin: 150 }]);
    expect(await listPrices(db, "X")).toEqual([{ date: "2026-01-01", closeTiyin: 150 }]);
  });

  it("finds the nearest price on or before a date with no price of its own", async () => {
    const db = createTestDb();
    await upsertPrices(db, "X", [
      { date: "2026-01-02", closeTiyin: 100 },
      { date: "2026-01-05", closeTiyin: 120 },
    ]);
    expect(await getPriceOnOrBefore(db, "X", "2026-01-04")).toBe(100); // weekend, no price that day
    expect(await getPriceOnOrBefore(db, "X", "2026-01-05")).toBe(120);
    expect(await getPriceOnOrBefore(db, "X", "2026-01-01")).toBeNull();
  });

  it("reports no latest date for a security with no cached prices", async () => {
    const db = createTestDb();
    expect(await getLatestPriceDate(db, "X")).toBeNull();
  });
});

describe("refreshPrices", () => {
  it("fetches from scratch for a security with nothing cached yet", async () => {
    const db = createTestDb();
    const source = fakeSource({ KSPI: { ok: true, prices: [{ date: "2026-01-01", closeTiyin: 100 }] } });
    const results = await refreshPrices(db, source, [{ isin: "KZ1C00001536", ticker: "KSPI" }]);
    expect(results).toEqual([{ isin: "KZ1C00001536", ticker: "KSPI", fetched: 1, error: null }]);
    expect(await listPrices(db, "KZ1C00001536")).toHaveLength(1);
  });

  it("only re-fetches days after what's already cached", async () => {
    const db = createTestDb();
    await upsertPrices(db, "KZ1C00001536", [{ date: "2026-01-05", closeTiyin: 100 }]);

    const captured: { from: Date | null } = { from: null };
    const source: PriceSource = {
      async fetchHistory(_ticker, from) {
        captured.from = from;
        return { ok: true, prices: [] };
      },
    };
    await refreshPrices(db, source, [{ isin: "KZ1C00001536", ticker: "KSPI" }], new Date("2026-01-10T00:00:00.000Z"));
    expect(captured.from?.toISOString().slice(0, 10)).toBe("2026-01-06");
  });

  it("skips the fetch entirely once already up to date", async () => {
    const db = createTestDb();
    await upsertPrices(db, "KZ1C00001536", [{ date: "2026-01-10", closeTiyin: 100 }]);

    let called = false;
    const source: PriceSource = {
      async fetchHistory() {
        called = true;
        return { ok: true, prices: [] };
      },
    };
    await refreshPrices(db, source, [{ isin: "KZ1C00001536", ticker: "KSPI" }], new Date("2026-01-10T00:00:00.000Z"));
    expect(called).toBe(false);
  });

  it("keeps going for other securities after one fails", async () => {
    const db = createTestDb();
    const source = fakeSource({
      KSPI: { ok: false, error: { kind: "network", message: "timeout" } },
      HSBK: { ok: true, prices: [{ date: "2026-01-01", closeTiyin: 50 }] },
    });
    const results = await refreshPrices(db, source, [
      { isin: "KZ1C00001536", ticker: "KSPI" },
      { isin: "KZ000A0LE0S4", ticker: "HSBK" },
    ]);
    expect(results[0]).toMatchObject({ ticker: "KSPI", error: "timeout" });
    expect(results[1]).toMatchObject({ ticker: "HSBK", fetched: 1, error: null });
  });
});
