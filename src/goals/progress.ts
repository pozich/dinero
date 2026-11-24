export type GoalLocation =
  | { type: "account"; accountId: number }
  | { type: "envelope" }
  | { type: "portfolio" };

/**
 * SPEC-2.md 10.2: where a goal's progress number comes from — an
 * account's real balance, the running total of a "конверт"'s own
 * contributions, or the portfolio's current value. Never stored, always
 * read fresh from whichever source applies.
 */
export function computeGoalCurrentTiyin(
  location: GoalLocation,
  data: { accountBalances: ReadonlyMap<number, number>; envelopeContributionsTiyin: number; portfolioValueTiyin: number },
): number {
  if (location.type === "account") return data.accountBalances.get(location.accountId) ?? 0;
  if (location.type === "envelope") return data.envelopeContributionsTiyin;
  return data.portfolioValueTiyin;
}

/** The envelope's own running balance — "забрать обратно" is just a
 * negative contribution, so a simple sum already nets it out. */
export function sumContributions(contributions: readonly { amountTiyin: number }[]): number {
  return contributions.reduce((sum, c) => sum + c.amountTiyin, 0);
}

/** Current pace for the no-deadline branch of the calculator — average
 * net contribution per month over the trailing window, not just "total
 * ever divided by goal age" (a goal that's been dormant for a year
 * shouldn't look like it's still contributing at its original pace). */
export function averageMonthlyContribution(
  contributions: readonly { amountTiyin: number; occurredAt: string }[],
  months: number,
  now: Date = new Date(),
): number {
  if (months <= 0) return 0;
  const cutoff = new Date(now.getTime() - months * 30.44 * 86_400_000).toISOString();
  const recentTotal = contributions.filter((c) => c.occurredAt >= cutoff).reduce((sum, c) => sum + c.amountTiyin, 0);
  return Math.round(recentTotal / months);
}
