import type { DbClient } from "../db/types";
import type { ParsedTransaction } from "../parsers/types";
import { listGoalRules } from "../db/goalRules";
import { addContribution, contributionExistsForTransaction } from "../db/goalContributions";
import { matchesGoalRule } from "../goals/matchGoalRule";

/**
 * SPEC-2.md 10.2's "по правилу (например, каждый перевод на Kaspi Deposit
 * -> в эту цель)" — applied automatically and deterministically on
 * import, same spirit as category_rules, not a review-and-confirm flow.
 * The contribution keeps the transaction's own sign, so an "expense" rule
 * naturally records a withdrawal and an "income" rule a deposit. Guarded
 * per-transaction (not just per-file), same reason as importInvestments.ts:
 * a re-import reuses an existing transaction's id.
 */
export async function applyGoalRulesToTransactions(
  db: DbClient,
  accountKind: string,
  transactions: readonly ParsedTransaction[],
  transactionIds: readonly number[],
): Promise<void> {
  const rules = await listGoalRules(db);
  if (rules.length === 0) return;

  for (let i = 0; i < transactions.length; i++) {
    const transactionId = transactionIds[i];
    if (await contributionExistsForTransaction(db, transactionId)) continue;

    const matchable = { accountKind, amountTiyin: transactions[i].amountTiyin };
    const rule = rules.find((r) => matchesGoalRule(r, matchable));
    if (!rule) continue;

    await addContribution(db, rule.goalId, transactions[i].amountTiyin, transactions[i].occurredAt, transactionId);
  }
}
