import { describe, expect, it } from "vitest";
import { createTestDb } from "../testDb";
import { listSecurities, getSecurity, upsertSecurity, deleteSecurity } from "../../src/db/securities";

describe("securities", () => {
  it("lists the seeded dictionary, ordered by ticker", async () => {
    const db = createTestDb();
    const securities = await listSecurities(db);
    expect(securities.length).toBe(7);
    expect(securities.map((s) => s.ticker)).toEqual([...securities.map((s) => s.ticker)].sort());
  });

  it("gets a single security by isin", async () => {
    const db = createTestDb();
    expect(await getSecurity(db, "KZ1C00001536")).toMatchObject({ ticker: "KSPI" });
    expect(await getSecurity(db, "nope")).toBeNull();
  });

  it("upserts a new security", async () => {
    const db = createTestDb();
    await upsertSecurity(db, { isin: "KZTEST0000X1", ticker: "TEST", name: "Test Co", industry: "Прочее" });
    expect(await getSecurity(db, "KZTEST0000X1")).toEqual({
      isin: "KZTEST0000X1",
      ticker: "TEST",
      name: "Test Co",
      industry: "Прочее",
    });
  });

  it("upserting an existing isin edits it in place instead of duplicating", async () => {
    const db = createTestDb();
    await upsertSecurity(db, { isin: "KZ1C00001536", ticker: "KSPI", name: "Renamed", industry: null });
    const security = await getSecurity(db, "KZ1C00001536");
    expect(security?.name).toBe("Renamed");
    expect((await listSecurities(db)).length).toBe(7);
  });

  it("deletes a security", async () => {
    const db = createTestDb();
    await deleteSecurity(db, "KZ1C00001536");
    expect(await getSecurity(db, "KZ1C00001536")).toBeNull();
  });
});
