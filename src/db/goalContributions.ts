import type { DbClient } from "./types";

export type GoalContribution = { id: number; goalId: number; transactionId: number | null; amountTiyin: number; occurredAt: string };

type ContributionDbRow = { id: number; goal_id: number; transaction_id: number | null; amount_tiyin: number; occurred_at: string };

function fromRow(row: ContributionDbRow): GoalContribution {
  return { id: row.id, goalId: row.goal_id, transactionId: row.transaction_id, amountTiyin: row.amount_tiyin, occurredAt: row.occurred_at };
}

export async function listContributions(db: DbClient, goalId: number): Promise<GoalContribution[]> {
  const rows = await db.select<ContributionDbRow[]>(
    "SELECT * FROM goal_contributions WHERE goal_id = $1 ORDER BY occurred_at",
    [goalId],
  );
  return rows.map(fromRow);
}

/** `transactionId` null for a manual deposit/withdrawal — a negative
 * `amountTiyin` is SPEC-2.md 10.2's "забрать обратно". */
export async function addContribution(
  db: DbClient,
  goalId: number,
  amountTiyin: number,
  occurredAt: string,
  transactionId: number | null = null,
): Promise<number> {
  const result = await db.execute(
    "INSERT INTO goal_contributions (goal_id, transaction_id, amount_tiyin, occurred_at) VALUES ($1, $2, $3, $4)",
    [goalId, transactionId, amountTiyin, occurredAt],
  );
  return result.lastInsertId!;
}

export async function deleteContribution(db: DbClient, id: number): Promise<void> {
  await db.execute("DELETE FROM goal_contributions WHERE id = $1", [id]);
}

export async function contributionExistsForTransaction(db: DbClient, transactionId: number): Promise<boolean> {
  const rows = await db.select<{ id: number }[]>(
    "SELECT id FROM goal_contributions WHERE transaction_id = $1",
    [transactionId],
  );
  return rows.length > 0;
}
