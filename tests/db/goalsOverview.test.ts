import { describe, expect, it } from "vitest";
import { createTestDb } from "../testDb";
import { createGoal } from "../../src/db/goals";
import { addContribution } from "../../src/db/goalContributions";
import { getAccountIdByKind } from "../../src/db/accounts";
import { insertTransaction, setTransactionCategory } from "../../src/db/transactions";
import { findOrCreateCategory } from "../../src/db/categories";
import { queryGoalsOverview, computeAverageIncomeExpense } from "../../src/db/goalsOverview";

describe("queryGoalsOverview", () => {
  it("computes an envelope goal's progress from its contributions", async () => {
    const db = createTestDb();
    const goalId = await createGoal(db, {
      name: "Отпуск",
      amountTiyin: 1000000,
      deadline: null,
      icon: null,
      note: null,
      locationType: "envelope",
      locationAccountId: null,
      depositRatePercent: null,
    });
    await addContribution(db, goalId, 300000, "2026-01-01T00:00:00.000Z");

    const [item] = await queryGoalsOverview(db, new Date("2026-01-15T00:00:00.000Z"));
    expect(item.currentTiyin).toBe(300000);
    expect(item.plan.kind).toBe("atCurrentPace");
  });

  it("computes an account goal's progress from the account's real balance", async () => {
    const db = createTestDb();
    const accountId = await getAccountIdByKind(db, "kaspi_deposit");
    await insertTransaction(db, {
      accountId,
      statementId: null,
      occurredAt: "2026-01-01T00:00:00.000Z",
      amountTiyin: 500000,
      description: "x",
      rawType: "x",
      dedupKey: "t1",
    });
    const goalId = await createGoal(db, {
      name: "Депозит",
      amountTiyin: 1000000,
      deadline: null,
      icon: null,
      note: null,
      locationType: "account",
      locationAccountId: accountId,
      depositRatePercent: null,
    });

    const [item] = await queryGoalsOverview(db);
    expect(item.goal.id).toBe(goalId);
    expect(item.currentTiyin).toBe(500000);
  });

  it("marks a goal achieved in its plan once contributions reach the target", async () => {
    const db = createTestDb();
    const goalId = await createGoal(db, {
      name: "Done",
      amountTiyin: 100000,
      deadline: null,
      icon: null,
      note: null,
      locationType: "envelope",
      locationAccountId: null,
      depositRatePercent: null,
    });
    await addContribution(db, goalId, 150000, "2026-01-01T00:00:00.000Z");
    const [item] = await queryGoalsOverview(db);
    expect(item.plan.kind).toBe("achieved");
  });
});

describe("computeAverageIncomeExpense", () => {
  it("averages income and expense over the trailing window", async () => {
    const db = createTestDb();
    const accountId = await getAccountIdByKind(db, "kaspi_gold");
    const food = await findOrCreateCategory(db, "Еда");
    const incomeId = await insertTransaction(db, {
      accountId,
      statementId: null,
      occurredAt: "2026-01-15T00:00:00.000Z",
      amountTiyin: 300000,
      description: "Зарплата",
      rawType: "x",
      dedupKey: "i1",
    });
    await setTransactionCategory(db, incomeId, food, 300000);
    const expenseId = await insertTransaction(db, {
      accountId,
      statementId: null,
      occurredAt: "2026-01-20T00:00:00.000Z",
      amountTiyin: -100000,
      description: "Магазин",
      rawType: "x",
      dedupKey: "e1",
    });
    await setTransactionCategory(db, expenseId, food, -100000);

    const result = await computeAverageIncomeExpense(db, 3, new Date("2026-02-01T00:00:00.000Z"));
    expect(result.avgIncomeTiyin).toBe(100000); // 300000 / 3
    expect(result.avgExpenseTiyin).toBe(-33333); // -100000/3 rounded
  });
});
