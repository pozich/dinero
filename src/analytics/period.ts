export type PeriodKind = "month" | "quarter" | "year" | "custom";
export type Period = { start: string; end: string };

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

function startOfMonth(year: number, monthIndex0: number): Date {
  return new Date(Date.UTC(year, monthIndex0, 1));
}

/** The current period for a given kind, anchored on `now` — month/quarter/
 * year are always *whole* calendar units, never a rolling window, so
 * "этот месяц"/"прошлый" (SPEC-2.md 6.3) means what it says. */
export function currentPeriod(kind: PeriodKind, now: Date = new Date()): Period {
  const year = now.getUTCFullYear();
  if (kind === "year") {
    return { start: `${year}-01-01T00:00:00.000Z`, end: `${year + 1}-01-01T00:00:00.000Z` };
  }
  if (kind === "quarter") {
    const q = Math.floor(now.getUTCMonth() / 3);
    const start = startOfMonth(year, q * 3);
    const end = startOfMonth(year, q * 3 + 3);
    return { start: start.toISOString(), end: end.toISOString() };
  }
  if (kind === "month") {
    const start = startOfMonth(year, now.getUTCMonth());
    const end = startOfMonth(year, now.getUTCMonth() + 1);
    return { start: start.toISOString(), end: end.toISOString() };
  }
  // "custom" has no well-defined "current" — fall back to the current month.
  const start = startOfMonth(year, now.getUTCMonth());
  const end = startOfMonth(year, now.getUTCMonth() + 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

/** One tick of the mouse wheel / arrow button (SPEC-2.md 6.3's "листание
 * колесом и стрелками") — moves a whole period in that direction, kept the
 * same length in calendar terms (a month stays a month, a custom range
 * keeps its exact day span). */
export function shiftPeriod(period: Period, kind: PeriodKind, direction: 1 | -1): Period {
  const start = new Date(period.start);
  const end = new Date(period.end);

  if (kind === "year") {
    const years = direction;
    return {
      start: new Date(Date.UTC(start.getUTCFullYear() + years, start.getUTCMonth(), start.getUTCDate())).toISOString(),
      end: new Date(Date.UTC(end.getUTCFullYear() + years, end.getUTCMonth(), end.getUTCDate())).toISOString(),
    };
  }
  if (kind === "quarter") {
    const months = direction * 3;
    return {
      start: new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + months, start.getUTCDate())).toISOString(),
      end: new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + months, end.getUTCDate())).toISOString(),
    };
  }
  if (kind === "month") {
    return {
      start: new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + direction, 1)).toISOString(),
      end: new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + direction, 1)).toISOString(),
    };
  }
  // custom: shift by its own exact length
  const lengthMs = end.getTime() - start.getTime();
  const deltaMs = lengthMs * direction;
  return {
    start: new Date(start.getTime() + deltaMs).toISOString(),
    end: new Date(end.getTime() + deltaMs).toISOString(),
  };
}

/** "С предыдущим периодом" / "год назад" (SPEC-2.md 6.3). "previous" reuses
 * shiftPeriod's calendar-aware arithmetic — a plain millisecond subtraction
 * would get this wrong for any month/quarter/year period, since calendar
 * units don't all have the same length (October is 31 days, September 30:
 * "31 days before Oct 1" lands on Aug 31, not Sep 1). */
export function comparisonPeriod(period: Period, kind: PeriodKind, mode: "previous" | "yearAgo"): Period {
  if (mode === "previous") {
    return shiftPeriod(period, kind, -1);
  }
  const start = new Date(period.start);
  const end = new Date(period.end);
  return {
    start: new Date(Date.UTC(start.getUTCFullYear() - 1, start.getUTCMonth(), start.getUTCDate())).toISOString(),
    end: new Date(Date.UTC(end.getUTCFullYear() - 1, end.getUTCMonth(), end.getUTCDate())).toISOString(),
  };
}

export function formatPeriodLabel(period: Period, kind: PeriodKind): string {
  const start = new Date(period.start);
  if (kind === "year") return `${start.getUTCFullYear()}`;
  if (kind === "quarter") return `Q${Math.floor(start.getUTCMonth() / 3) + 1} ${start.getUTCFullYear()}`;
  if (kind === "month") {
    return `${pad(start.getUTCMonth() + 1)}.${start.getUTCFullYear()}`;
  }
  const end = new Date(new Date(period.end).getTime() - 1);
  return `${pad(start.getUTCDate())}.${pad(start.getUTCMonth() + 1)}.${start.getUTCFullYear()} — ${pad(end.getUTCDate())}.${pad(end.getUTCMonth() + 1)}.${end.getUTCFullYear()}`;
}

/** Delta between a period's total and its comparison period's, in tiyin
 * and percent (null % when the comparison total was zero — "infinite"
 * growth from nothing isn't a useful number to show). */
export function periodDelta(
  currentTotal: number,
  comparisonTotal: number,
): { deltaTiyin: number; deltaPercent: number | null } {
  const deltaTiyin = currentTotal - comparisonTotal;
  const deltaPercent = comparisonTotal !== 0 ? (deltaTiyin / Math.abs(comparisonTotal)) * 100 : null;
  return { deltaTiyin, deltaPercent };
}
