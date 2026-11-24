import { describe, expect, it } from "vitest";
import { createTestDb } from "../testDb";
import {
  listRecurringSeriesState,
  setSeriesHidden,
  setSeriesConfirmed,
} from "../../src/db/recurringSeriesState";

describe("recurringSeriesState", () => {
  it("has no state for a series nobody has touched yet", async () => {
    const db = createTestDb();
    expect(await listRecurringSeriesState(db)).toEqual(new Map());
  });

  it("persists hiding a series", async () => {
    const db = createTestDb();
    await setSeriesHidden(db, "kaspi_gold:anthropic claude sub:expense", true);
    const state = await listRecurringSeriesState(db);
    expect(state.get("kaspi_gold:anthropic claude sub:expense")).toEqual({
      hidden: true,
      confirmed: false,
    });
  });

  it("persists confirming a series without disturbing its hidden flag", async () => {
    const db = createTestDb();
    const key = "kaspi_gold:anthropic claude sub:expense";
    await setSeriesHidden(db, key, true);
    await setSeriesConfirmed(db, key, true);
    expect(await listRecurringSeriesState(db)).toEqual(
      new Map([[key, { hidden: true, confirmed: true }]]),
    );
  });

  it("can un-hide a previously hidden series", async () => {
    const db = createTestDb();
    const key = "halyk_salary:netflix:expense";
    await setSeriesHidden(db, key, true);
    await setSeriesHidden(db, key, false);
    expect((await listRecurringSeriesState(db)).get(key)).toEqual({ hidden: false, confirmed: false });
  });
});
