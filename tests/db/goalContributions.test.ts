import { describe, expect, it } from "vitest";
import { createTestDb } from "../testDb";
import { createGoal } from "../../src/db/goals";
import {
  listContributions,
  addContribution,
  deleteContribution,
  contributionExistsForTransaction,
} from "../../src/db/goalContributions";
import { getAccountIdByKind } from "../../src/db/accounts";
import { insertTransaction } from "../../src/db/transactions";

async function seedGoal(db: ReturnType<typeof createTestDb>) {
  return createGoal(db, {
    name: "Envelope",
    amountTiyin: 1000000,
    deadline: null,
    icon: null,
    note: null,
    locationType: "envelope",
    locationAccountId: null,
    depositRatePercent: null,
  });
}

describe("goalContributions", () => {
  it("adds and lists manual contributions, ordered by date", async () => {
    const db = createTestDb();
    const goalId = await seedGoal(db);
    await addContribution(db, goalId, 50000, "2026-02-01T00:00:00.000Z");
    await addContribution(db, goalId, 30000, "2026-01-01T00:00:00.000Z");
    const contributions = await listContributions(db, goalId);
    expect(contributions.map((c) => c.amountTiyin)).toEqual([30000, 50000]);
  });

  it("supports a negative amount as a withdrawal", async () => {
    const db = createTestDb();
    const goalId = await seedGoal(db);
    await addContribution(db, goalId, -10000, "2026-01-01T00:00:00.000Z");
    expect((await listContributions(db, goalId))[0].amountTiyin).toBe(-10000);
  });

  it("deletes a contribution", async () => {
    const db = createTestDb();
    const goalId = await seedGoal(db);
    const id = await addContribution(db, goalId, 10000, "2026-01-01T00:00:00.000Z");
    await deleteContribution(db, id);
    expect(await listContributions(db, goalId)).toHaveLength(0);
  });

  it("links a contribution to a real transaction and can check it exists", async () => {
    const db = createTestDb();
    const goalId = await seedGoal(db);
    const accountId = await getAccountIdByKind(db, "kaspi_deposit");
    const transactionId = await insertTransaction(db, {
      accountId,
      statementId: null,
      occurredAt: "2026-01-01T00:00:00.000Z",
      amountTiyin: 50000,
      description: "x",
      rawType: "x",
      dedupKey: "g1",
    });
    expect(await contributionExistsForTransaction(db, transactionId)).toBe(false);
    await addContribution(db, goalId, 50000, "2026-01-01T00:00:00.000Z", transactionId);
    expect(await contributionExistsForTransaction(db, transactionId)).toBe(true);
  });
});
