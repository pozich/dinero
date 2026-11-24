import { currentPeriod, shiftPeriod, type Period } from "./period";

export type FloatingPeriodId =
  | "thisMonth"
  | "thisQuarter"
  | "thisYear"
  | "last3Months"
  | "last6Months"
  | "last12Months";

export const FLOATING_PERIOD_LABELS: Record<FloatingPeriodId, string> = {
  thisMonth: "Этот месяц",
  thisQuarter: "Этот квартал",
  thisYear: "Этот год",
  last3Months: "Последние 3 месяца",
  last6Months: "Последние 6 месяцев",
  last12Months: "Последние 12 месяцев",
};

/** A dashboard preset's period is either "плавающий" (re-resolved against
 * `now` every render) or "фиксированный" (an exact stored range) —
 * SPEC-2.md 7. */
export type PeriodSpec = { kind: "floating"; id: FloatingPeriodId } | { kind: "fixed"; start: string; end: string };

/**
 * Resolves a floating period id to an actual calendar Period anchored on
 * `now` — this gets called fresh on every render, so "последние 3 месяца"
 * in a new month always covers the new 3 months, never a range frozen at
 * whenever the preset was created (Ф6's own done-criterion).
 */
export function resolveFloatingPeriod(id: FloatingPeriodId, now: Date = new Date()): Period {
  if (id === "thisMonth") return currentPeriod("month", now);
  if (id === "thisQuarter") return currentPeriod("quarter", now);
  if (id === "thisYear") return currentPeriod("year", now);

  const monthsBack = id === "last3Months" ? 3 : id === "last6Months" ? 6 : 12;
  const end = currentPeriod("month", now).end;
  let start = currentPeriod("month", now);
  for (let i = 1; i < monthsBack; i++) {
    start = shiftPeriod(start, "month", -1);
  }
  return { start: start.start, end };
}

export function resolvePeriodSpec(spec: PeriodSpec, now: Date = new Date()): Period {
  if (spec.kind === "fixed") return { start: spec.start, end: spec.end };
  return resolveFloatingPeriod(spec.id, now);
}
