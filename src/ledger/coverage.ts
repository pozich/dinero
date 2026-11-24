export type StatementPeriod = { periodStart: string; periodEnd: string };
export type DateRange = { start: string; end: string };

/**
 * Merges overlapping/adjacent statement periods, then reports every gap
 * inside `[rangeStart, rangeEnd]` that none of them cover — SPEC-2.md
 * 6.1's "Kaspi: нет данных 01.03–15.03" is exactly one of these ranges,
 * not a coarser month-by-month yes/no.
 */
export function findCoverageGaps(
  periods: readonly StatementPeriod[],
  rangeStart: string,
  rangeEnd: string,
): DateRange[] {
  const sorted = [...periods].sort((a, b) => a.periodStart.localeCompare(b.periodStart));

  const merged: DateRange[] = [];
  for (const p of sorted) {
    const last = merged[merged.length - 1];
    if (last && p.periodStart <= last.end) {
      if (p.periodEnd > last.end) last.end = p.periodEnd;
    } else {
      merged.push({ start: p.periodStart, end: p.periodEnd });
    }
  }

  const gaps: DateRange[] = [];
  let cursor = rangeStart;
  for (const m of merged) {
    if (m.start > cursor) gaps.push({ start: cursor, end: m.start });
    if (m.end > cursor) cursor = m.end;
  }
  if (cursor < rangeEnd) gaps.push({ start: cursor, end: rangeEnd });

  return gaps.filter((g) => g.start < g.end);
}

/** One entry per calendar month in range, flagged if any gap overlaps it —
 * feeds the visual "полоска по месяцам" strip; `findCoverageGaps`'s own
 * output is what gets shown as the precise "01.03–15.03" text. */
export function monthlyCoverage(
  gaps: readonly DateRange[],
  rangeStart: string,
  rangeEnd: string,
): { month: string; hasGap: boolean }[] {
  const months: { month: string; hasGap: boolean }[] = [];
  let cursor = new Date(`${rangeStart.slice(0, 7)}-01T00:00:00.000Z`);
  const end = new Date(rangeEnd);

  while (cursor <= end) {
    const monthStr = cursor.toISOString().slice(0, 7);
    const monthStart = `${monthStr}-01T00:00:00.000Z`;
    const next = new Date(cursor);
    next.setUTCMonth(next.getUTCMonth() + 1);
    const monthEnd = next.toISOString();

    const hasGap = gaps.some((g) => g.start < monthEnd && g.end > monthStart);
    months.push({ month: monthStr, hasGap });
    cursor = next;
  }

  return months;
}
