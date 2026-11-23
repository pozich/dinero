export type MatchableRule = {
  pattern: string;
  case_sensitive: number;
  category_id: number;
  priority: number;
  is_active: number;
};

/** A broken/unsupported pattern never matches rather than crashing the
 * "Применить правила" preview. */
export function compileRule(rule: MatchableRule): RegExp | null {
  try {
    return new RegExp(rule.pattern, rule.case_sensitive ? "" : "i");
  } catch {
    return null;
  }
}

export function matchRule(description: string, rule: MatchableRule): boolean {
  const re = compileRule(rule);
  return re ? re.test(description) : false;
}

/** First match wins, in ascending priority order — rules are applied only
 * through the "Применить правила" review dialog, never automatically on
 * import (SPEC.md 6.4). */
export function findMatchingCategory(
  description: string,
  rules: readonly MatchableRule[],
): number | null {
  const active = [...rules].filter((r) => r.is_active).sort((a, b) => a.priority - b.priority);
  for (const rule of active) {
    if (matchRule(description, rule)) return rule.category_id;
  }
  return null;
}
