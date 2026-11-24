import type { DbClient } from "./types";

export type GoalLocationType = "account" | "envelope" | "portfolio";
export type GoalStatus = "active" | "achieved";

export type Goal = {
  id: number;
  name: string;
  amountTiyin: number;
  deadline: string | null;
  icon: string | null;
  priority: number;
  note: string | null;
  locationType: GoalLocationType;
  locationAccountId: number | null;
  depositRatePercent: number | null;
  status: GoalStatus;
};

type GoalDbRow = {
  id: number;
  name: string;
  amount_tiyin: number;
  deadline: string | null;
  icon: string | null;
  priority: number;
  note: string | null;
  location_type: GoalLocationType;
  location_account_id: number | null;
  deposit_rate_percent: number | null;
  status: GoalStatus;
};

function fromRow(row: GoalDbRow): Goal {
  return {
    id: row.id,
    name: row.name,
    amountTiyin: row.amount_tiyin,
    deadline: row.deadline,
    icon: row.icon,
    priority: row.priority,
    note: row.note,
    locationType: row.location_type,
    locationAccountId: row.location_account_id,
    depositRatePercent: row.deposit_rate_percent,
    status: row.status,
  };
}

export async function listGoals(db: DbClient): Promise<Goal[]> {
  const rows = await db.select<GoalDbRow[]>("SELECT * FROM goals ORDER BY priority");
  return rows.map(fromRow);
}

export type CreateGoalInput = {
  name: string;
  amountTiyin: number;
  deadline: string | null;
  icon: string | null;
  note: string | null;
  locationType: GoalLocationType;
  locationAccountId: number | null;
  depositRatePercent: number | null;
};

export async function createGoal(db: DbClient, input: CreateGoalInput): Promise<number> {
  const rows = await db.select<{ maxPriority: number | null }[]>("SELECT MAX(priority) AS maxPriority FROM goals");
  const priority = (rows[0]?.maxPriority ?? -1) + 1;
  const result = await db.execute(
    `INSERT INTO goals (name, amount_tiyin, deadline, icon, priority, note, location_type, location_account_id, deposit_rate_percent)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      input.name,
      input.amountTiyin,
      input.deadline,
      input.icon,
      priority,
      input.note,
      input.locationType,
      input.locationAccountId,
      input.depositRatePercent,
    ],
  );
  return result.lastInsertId!;
}

export type GoalPatch = Partial<Omit<CreateGoalInput, "locationType">>;

export async function updateGoal(db: DbClient, id: number, patch: GoalPatch): Promise<void> {
  const fields: string[] = [];
  const params: unknown[] = [];
  const columnByKey: Record<string, string> = {
    name: "name",
    amountTiyin: "amount_tiyin",
    deadline: "deadline",
    icon: "icon",
    note: "note",
    locationAccountId: "location_account_id",
    depositRatePercent: "deposit_rate_percent",
  };
  for (const [key, column] of Object.entries(columnByKey)) {
    const value = (patch as Record<string, unknown>)[key];
    if (value === undefined) continue;
    params.push(value);
    fields.push(`${column} = $${params.length}`);
  }
  if (fields.length === 0) return;
  params.push(id);
  await db.execute(`UPDATE goals SET ${fields.join(", ")} WHERE id = $${params.length}`, params);
}

export async function setGoalStatus(db: DbClient, id: number, status: GoalStatus): Promise<void> {
  await db.execute("UPDATE goals SET status = $1 WHERE id = $2", [status, id]);
}

export async function deleteGoal(db: DbClient, id: number): Promise<void> {
  await db.execute("DELETE FROM goals WHERE id = $1", [id]);
}

/** Drag-to-reorder priority — lower priority number is allocated first in
 * computeWhyBreakdown's "higher-priority goals" set. */
export async function reorderGoals(db: DbClient, orderedIds: readonly number[]): Promise<void> {
  for (let i = 0; i < orderedIds.length; i++) {
    await db.execute("UPDATE goals SET priority = $1 WHERE id = $2", [i, orderedIds[i]]);
  }
}
