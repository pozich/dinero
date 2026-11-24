import { describe, expect, it } from "vitest";
import { createTestDb } from "../testDb";
import { listSnapshots, importSnapshot } from "../../src/db/securitySnapshots";

describe("securitySnapshots", () => {
  it("imports a parsed snapshot's holdings", async () => {
    const db = createTestDb();
    await importSnapshot(db, {
      snapshotDate: "2025-11-30T00:00:00.000Z",
      holdings: [
        { isin: "KZ1C00001536", quantity: 3 },
        { isin: "KZ000A0LE0S4", quantity: 155 },
      ],
    });
    const snapshots = await listSnapshots(db);
    expect(snapshots).toEqual([
      { isin: "KZ1C00001536", date: "2025-11-30T00:00:00.000Z", quantity: 3 },
      { isin: "KZ000A0LE0S4", date: "2025-11-30T00:00:00.000Z", quantity: 155 },
    ]);
  });

  it("re-importing the same snapshot overwrites instead of duplicating", async () => {
    const db = createTestDb();
    await importSnapshot(db, { snapshotDate: "2025-11-30T00:00:00.000Z", holdings: [{ isin: "KZ1C00001536", quantity: 3 }] });
    await importSnapshot(db, { snapshotDate: "2025-11-30T00:00:00.000Z", holdings: [{ isin: "KZ1C00001536", quantity: 5 }] });
    const snapshots = await listSnapshots(db);
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0].quantity).toBe(5);
  });

  it("filters to one security", async () => {
    const db = createTestDb();
    await importSnapshot(db, {
      snapshotDate: "2025-11-30T00:00:00.000Z",
      holdings: [
        { isin: "KZ1C00001536", quantity: 3 },
        { isin: "KZ000A0LE0S4", quantity: 155 },
      ],
    });
    expect(await listSnapshots(db, "KZ1C00001536")).toHaveLength(1);
  });
});
