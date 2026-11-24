import { describe, expect, it } from "vitest";
import { createTestDb } from "../testDb";
import { createGoal } from "../../src/db/goals";
import { createGoalRule } from "../../src/db/goalRules";
import { listContributions } from "../../src/db/goalContributions";
import { applyGoalRulesToTransactions } from "../../src/import/applyGoalRules";
import { getAccountIdByKind } from "../../src/db/accounts";
import { insertTransaction } from "../../src/db/transactions";
import type { ParsedTransaction } from "../../src/parsers/types";

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

function tx(amountTiyin: number): ParsedTransaction {
  return { occurredAt: "2026-01-01T00:00:00.000Z", amountTiyin, description: "x", rawType: "x" };
}

async function seedTx(db: ReturnType<typeof createTestDb>, accountKind: string, dedupKey: string, amountTiyin: number) {
  const accountId = await getAccountIdByKind(db, accountKind);
  return insertTransaction(db, {
    accountId,
    statementId: null,
    occurredAt: "2026-01-01T00:00:00.000Z",
    amountTiyin,
    description: "x",
    rawType: "x",
    dedupKey,
  });
}

describe("applyGoalRulesToTransactions", () => {
  it("records a contribution for a transaction matching a goal rule", async () => {
    const db = createTestDb();
    const goalId = await seedGoal(db);
    await createGoalRule(db, goalId, { accountKind: "kaspi_deposit", sign: "income", minAmountTiyin: null, maxAmountTiyin: null });
    const id = await seedTx(db, "kaspi_deposit", "t1", 50000);

    await applyGoalRulesToTransactions(db, "kaspi_deposit", [tx(50000)], [id]);

    const contributions = await listContributions(db, goalId);
    expect(contributions).toEqual([{ id: contributions[0].id, goalId, transactionId: id, amountTiyin: 50000, occurredAt: "2026-01-01T00:00:00.000Z" }]);
  });

  it("does nothing when no rule exists", async () => {
    const db = createTestDb();
    const id = await seedTx(db, "kaspi_deposit", "t1", 50000);
    await applyGoalRulesToTransactions(db, "kaspi_deposit", [tx(50000)], [id]);
    // no goal was even created, so just confirming this doesn't throw is the test
  });

  it("skips a transaction that doesn't match any rule", async () => {
    const db = createTestDb();
    const goalId = await seedGoal(db);
    await createGoalRule(db, goalId, { accountKind: "kaspi_deposit", sign: null, minAmountTiyin: null, maxAmountTiyin: null });
    const id = await seedTx(db, "cash", "t1", 50000);
    await applyGoalRulesToTransactions(db, "cash", [tx(50000)], [id]);
    expect(await listContributions(db, goalId)).toHaveLength(0);
  });

  it("is idempotent: calling it twice for the same transaction doesn't duplicate the contribution", async () => {
    const db = createTestDb();
    const goalId = await seedGoal(db);
    await createGoalRule(db, goalId, { accountKind: "kaspi_deposit", sign: null, minAmountTiyin: null, maxAmountTiyin: null });
    const id = await seedTx(db, "kaspi_deposit", "t1", 50000);
    await applyGoalRulesToTransactions(db, "kaspi_deposit", [tx(50000)], [id]);
    await applyGoalRulesToTransactions(db, "kaspi_deposit", [tx(50000)], [id]);
    expect(await listContributions(db, goalId)).toHaveLength(1);
  });
});
