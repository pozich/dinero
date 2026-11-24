import type { DbClient } from "./types";

/** SPEC-2.md 10.4's "покупку можно связать с целью" — a tag, re-linking a
 * transaction just moves it to the new goal (the UNIQUE(transaction_id)
 * constraint means at most one goal per transaction). */
export async function linkTransactionToGoal(db: DbClient, goalId: number, transactionId: number): Promise<void> {
  await db.execute(
    `INSERT INTO goal_links (goal_id, transaction_id) VALUES ($1, $2)
     ON CONFLICT (transaction_id) DO UPDATE SET goal_id = excluded.goal_id`,
    [goalId, transactionId],
  );
}

export async function unlinkTransaction(db: DbClient, transactionId: number): Promise<void> {
  await db.execute("DELETE FROM goal_links WHERE transaction_id = $1", [transactionId]);
}

export async function listLinkedTransactionIds(db: DbClient, goalId: number): Promise<number[]> {
  const rows = await db.select<{ transaction_id: number }[]>(
    "SELECT transaction_id FROM goal_links WHERE goal_id = $1",
    [goalId],
  );
  return rows.map((r) => r.transaction_id);
}

export async function getGoalIdForTransaction(db: DbClient, transactionId: number): Promise<number | null> {
  const rows = await db.select<{ goal_id: number }[]>(
    "SELECT goal_id FROM goal_links WHERE transaction_id = $1",
    [transactionId],
  );
  return rows[0]?.goal_id ?? null;
}
