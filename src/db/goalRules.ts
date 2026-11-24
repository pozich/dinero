import type { DbClient } from "./types";
import type { GoalRule } from "../goals/matchGoalRule";

export type GoalRuleRow = GoalRule & { id: number; goalId: number };

type GoalRuleDbRow = {
  id: number;
  goal_id: number;
  account_kind: string | null;
  sign: "income" | "expense" | null;
  min_amount_tiyin: number | null;
  max_amount_tiyin: number | null;
};

function fromRow(row: GoalRuleDbRow): GoalRuleRow {
  return {
    id: row.id,
    goalId: row.goal_id,
    accountKind: row.account_kind,
    sign: row.sign,
    minAmountTiyin: row.min_amount_tiyin,
    maxAmountTiyin: row.max_amount_tiyin,
  };
}

export async function listGoalRules(db: DbClient, goalId?: number): Promise<GoalRuleRow[]> {
  const rows = goalId !== undefined
    ? await db.select<GoalRuleDbRow[]>("SELECT * FROM goal_rules WHERE goal_id = $1", [goalId])
    : await db.select<GoalRuleDbRow[]>("SELECT * FROM goal_rules");
  return rows.map(fromRow);
}

export async function createGoalRule(db: DbClient, goalId: number, rule: GoalRule): Promise<number> {
  const result = await db.execute(
    "INSERT INTO goal_rules (goal_id, account_kind, sign, min_amount_tiyin, max_amount_tiyin) VALUES ($1, $2, $3, $4, $5)",
    [goalId, rule.accountKind, rule.sign, rule.minAmountTiyin, rule.maxAmountTiyin],
  );
  return result.lastInsertId!;
}

export async function deleteGoalRule(db: DbClient, id: number): Promise<void> {
  await db.execute("DELETE FROM goal_rules WHERE id = $1", [id]);
}
