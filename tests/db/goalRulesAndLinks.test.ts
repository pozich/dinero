import { describe, expect, it } from "vitest";
import { createTestDb } from "../testDb";
import { createGoal } from "../../src/db/goals";
import { listGoalRules, createGoalRule, deleteGoalRule } from "../../src/db/goalRules";
import {
  linkTransactionToGoal,
  unlinkTransaction,
  listLinkedTransactionIds,
  getGoalIdForTransaction,
} from "../../src/db/goalLinks";
import { getAccountIdByKind } from "../../src/db/accounts";
import { insertTransaction } from "../../src/db/transactions";

async function seedGoal(db: ReturnType<typeof createTestDb>) {
  return createGoal(db, {
    name: "G",
    amountTiyin: 1000000,
    deadline: null,
    icon: null,
    note: null,
    locationType: "envelope",
    locationAccountId: null,
    depositRatePercent: null,
  });
}

describe("goalRules", () => {
  it("creates and lists rules for a goal", async () => {
    const db = createTestDb();
    const goalId = await seedGoal(db);
    await createGoalRule(db, goalId, { accountKind: "kaspi_deposit", sign: "income", minAmountTiyin: null, maxAmountTiyin: null });
    const rules = await listGoalRules(db, goalId);
    expect(rules).toHaveLength(1);
    expect(rules[0]).toMatchObject({ goalId, accountKind: "kaspi_deposit", sign: "income" });
  });

  it("deletes a rule", async () => {
    const db = createTestDb();
    const goalId = await seedGoal(db);
    const id = await createGoalRule(db, goalId, { accountKind: null, sign: null, minAmountTiyin: null, maxAmountTiyin: null });
    await deleteGoalRule(db, id);
    expect(await listGoalRules(db, goalId)).toHaveLength(0);
  });
});

describe("goalLinks", () => {
  async function seedTransaction(db: ReturnType<typeof createTestDb>, dedupKey: string) {
    const accountId = await getAccountIdByKind(db, "kaspi_gold");
    return insertTransaction(db, {
      accountId,
      statementId: null,
      occurredAt: "2026-01-01T00:00:00.000Z",
      amountTiyin: -50000,
      description: "x",
      rawType: "x",
      dedupKey,
    });
  }

  it("links a transaction to a goal", async () => {
    const db = createTestDb();
    const goalId = await seedGoal(db);
    const transactionId = await seedTransaction(db, "t1");
    await linkTransactionToGoal(db, goalId, transactionId);
    expect(await listLinkedTransactionIds(db, goalId)).toEqual([transactionId]);
    expect(await getGoalIdForTransaction(db, transactionId)).toBe(goalId);
  });

  it("re-linking a transaction moves it to the new goal instead of erroring", async () => {
    const db = createTestDb();
    const goalA = await seedGoal(db);
    const goalB = await seedGoal(db);
    const transactionId = await seedTransaction(db, "t1");
    await linkTransactionToGoal(db, goalA, transactionId);
    await linkTransactionToGoal(db, goalB, transactionId);
    expect(await getGoalIdForTransaction(db, transactionId)).toBe(goalB);
    expect(await listLinkedTransactionIds(db, goalA)).toHaveLength(0);
  });

  it("unlinks a transaction", async () => {
    const db = createTestDb();
    const goalId = await seedGoal(db);
    const transactionId = await seedTransaction(db, "t1");
    await linkTransactionToGoal(db, goalId, transactionId);
    await unlinkTransaction(db, transactionId);
    expect(await getGoalIdForTransaction(db, transactionId)).toBeNull();
  });
});
