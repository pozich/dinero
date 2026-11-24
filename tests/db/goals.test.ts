import { describe, expect, it } from "vitest";
import { createTestDb } from "../testDb";
import { listGoals, createGoal, updateGoal, setGoalStatus, deleteGoal, reorderGoals } from "../../src/db/goals";

async function seedGoal(db: ReturnType<typeof createTestDb>, name: string) {
  return createGoal(db, {
    name,
    amountTiyin: 1000000,
    deadline: null,
    icon: null,
    note: null,
    locationType: "envelope",
    locationAccountId: null,
    depositRatePercent: null,
  });
}

describe("goals", () => {
  it("creates and lists goals ordered by priority", async () => {
    const db = createTestDb();
    await seedGoal(db, "A");
    await seedGoal(db, "B");
    const goals = await listGoals(db);
    expect(goals.map((g) => g.name)).toEqual(["A", "B"]);
    expect(goals.map((g) => g.priority)).toEqual([0, 1]);
    expect(goals[0].status).toBe("active");
  });

  it("updates only the given fields", async () => {
    const db = createTestDb();
    const id = await seedGoal(db, "A");
    await updateGoal(db, id, { amountTiyin: 2000000 });
    const [goal] = await listGoals(db);
    expect(goal.amountTiyin).toBe(2000000);
    expect(goal.name).toBe("A");
  });

  it("marks a goal achieved", async () => {
    const db = createTestDb();
    const id = await seedGoal(db, "A");
    await setGoalStatus(db, id, "achieved");
    expect((await listGoals(db))[0].status).toBe("achieved");
  });

  it("deletes a goal", async () => {
    const db = createTestDb();
    const id = await seedGoal(db, "A");
    await deleteGoal(db, id);
    expect(await listGoals(db)).toHaveLength(0);
  });

  it("reorders goals by priority", async () => {
    const db = createTestDb();
    const a = await seedGoal(db, "A");
    const b = await seedGoal(db, "B");
    const c = await seedGoal(db, "C");
    await reorderGoals(db, [c, a, b]);
    expect((await listGoals(db)).map((g) => g.name)).toEqual(["C", "A", "B"]);
  });
});
