export type RuleSign = "income" | "expense";

export type MatchableRule = {
  pattern: string;
  case_sensitive: number;
  category_id: number;
  priority: number;
  is_active: number;
  account_kinds: string | null;
  sign: RuleSign | null;
  min_amount_tiyin: number | null;
  max_amount_tiyin: number | null;
};

export type MatchableTransaction = {
  description: string;
  accountKind: string;
  amountTiyin: number;
};

/** A broken/unsupported pattern never matches rather than crashing the
 * "Применить правила" preview. */
export function compileRule(rule: { pattern: string; case_sensitive: number }): RegExp | null {
  try {
    return new RegExp(rule.pattern, rule.case_sensitive ? "" : "i");
  } catch {
    return null;
  }
}

/** Regex only — used by the rule editor's live tester (RulesDialog), which
 * has no transaction to check account/sign/amount against, just an example
 * description typed in while learning regex syntax. */
export function testPattern(description: string, rule: { pattern: string; case_sensitive: number }): boolean {
  const re = compileRule(rule);
  return re ? re.test(description) : false;
}

/** SPEC-2.md 4.4: account(s)/sign/amount range are optional extra
 * conditions, all ANDed with the regex when present. */
function extraConditionsMatch(rule: MatchableRule, t: MatchableTransaction): boolean {
  if (rule.account_kinds) {
    const allowed = rule.account_kinds.split(",");
    if (!allowed.includes(t.accountKind)) return false;
  }
  if (rule.sign) {
    const txSign: RuleSign = t.amountTiyin < 0 ? "expense" : "income";
    if (rule.sign !== txSign) return false;
  }
  const absAmount = Math.abs(t.amountTiyin);
  if (rule.min_amount_tiyin !== null && absAmount < rule.min_amount_tiyin) return false;
  if (rule.max_amount_tiyin !== null && absAmount > rule.max_amount_tiyin) return false;
  return true;
}

export function matchRule(t: MatchableTransaction, rule: MatchableRule): boolean {
  return testPattern(t.description, rule) && extraConditionsMatch(rule, t);
}

/** First match wins, in ascending priority order — rules are applied only
 * through the "Применить правила" review dialog, never automatically on
 * import (SPEC.md 6.4). */
export function findMatchingCategory(
  t: MatchableTransaction,
  rules: readonly MatchableRule[],
): number | null {
  const active = [...rules].filter((r) => r.is_active).sort((a, b) => a.priority - b.priority);
  for (const rule of active) {
    if (matchRule(t, rule)) return rule.category_id;
  }
  return null;
}
