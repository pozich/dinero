export type GoalRule = {
  accountKind: string | null;
  sign: "income" | "expense" | null;
  minAmountTiyin: number | null;
  maxAmountTiyin: number | null;
};

export type MatchableTransaction = { accountKind: string; amountTiyin: number };

/** SPEC-2.md 10.2's "по правилу (например, каждый перевод на Kaspi
 * Deposit -> в эту цель)" — every set condition is ANDed, same style as
 * category_rules' account/sign/amount extras (4.4), minus the regex: a
 * goal rule has no description to match against. */
export function matchesGoalRule(rule: GoalRule, transaction: MatchableTransaction): boolean {
  if (rule.accountKind !== null && transaction.accountKind !== rule.accountKind) return false;
  if (rule.sign === "income" && transaction.amountTiyin < 0) return false;
  if (rule.sign === "expense" && transaction.amountTiyin >= 0) return false;
  const absAmount = Math.abs(transaction.amountTiyin);
  if (rule.minAmountTiyin !== null && absAmount < rule.minAmountTiyin) return false;
  if (rule.maxAmountTiyin !== null && absAmount > rule.maxAmountTiyin) return false;
  return true;
}
