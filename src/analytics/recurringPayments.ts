import { normalizeDescription } from "../transfers/normalizeDescription";
import type { LedgerRow } from "../db/ledgerQuery";

export type RecurringInterval = "week" | "month" | "year";

export type RecurringSeries = {
  key: string;
  label: string;
  interval: RecurringInterval;
  avgAmountTiyin: number;
  occurrences: { transactionId: number; occurredAt: string; amountTiyin: number }[];
  nextExpectedDate: string;
  priceChangePercent: number | null;
  missed: boolean;
};

const DAY_MS = 86_400_000;
const INTERVAL_DAYS: Record<RecurringInterval, number> = { week: 7, month: 30, year: 365 };
const INTERVAL_TOLERANCE_DAYS: Record<RecurringInterval, number> = { week: 2, month: 5, year: 15 };

function detectInterval(gapDays: number): RecurringInterval | null {
  for (const interval of Object.keys(INTERVAL_DAYS) as RecurringInterval[]) {
    if (Math.abs(gapDays - INTERVAL_DAYS[interval]) <= INTERVAL_TOLERANCE_DAYS[interval]) return interval;
  }
  return null;
}

/**
 * SPEC-2.md 6.6: a series needs at least 3 occurrences on the same
 * account with the same sign, amounts within `amountTolerancePercent` of
 * their own average, and a gap between every consecutive pair that lands
 * on the *same* interval (week/month/year) within its own tolerance —
 * entirely deterministic, nothing guessed beyond those fixed rules.
 */
export function findRecurringSeries(
  rows: readonly LedgerRow[],
  options: { amountTolerancePercent?: number; now?: Date } = {},
): RecurringSeries[] {
  const amountTolerancePercent = options.amountTolerancePercent ?? 15;
  const now = options.now ?? new Date();

  const groups = new Map<string, LedgerRow[]>();
  for (const r of rows) {
    if (r.excluded) continue;
    const key = `${r.accountKind}:${normalizeDescription(r.description)}:${r.amountTiyin < 0 ? "expense" : "income"}`;
    const group = groups.get(key) ?? [];
    group.push(r);
    groups.set(key, group);
  }

  const series: RecurringSeries[] = [];
  for (const [key, groupRows] of groups) {
    if (groupRows.length < 3) continue;
    const sorted = [...groupRows].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));

    const avgAmount = sorted.reduce((sum, r) => sum + r.amountTiyin, 0) / sorted.length;
    const amountsConsistent = sorted.every(
      (r) => Math.abs(r.amountTiyin - avgAmount) <= Math.abs(avgAmount) * (amountTolerancePercent / 100),
    );
    if (!amountsConsistent) continue;

    const gapsDays: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      gapsDays.push(
        (new Date(sorted[i].occurredAt).getTime() - new Date(sorted[i - 1].occurredAt).getTime()) / DAY_MS,
      );
    }
    const avgGap = gapsDays.reduce((a, b) => a + b, 0) / gapsDays.length;
    const interval = detectInterval(avgGap);
    if (!interval) continue;
    if (!gapsDays.every((g) => detectInterval(g) === interval)) continue;

    const last = sorted[sorted.length - 1];
    const nextExpectedDate = new Date(
      new Date(last.occurredAt).getTime() + INTERVAL_DAYS[interval] * DAY_MS,
    ).toISOString();
    const missed = now.getTime() - new Date(nextExpectedDate).getTime() > INTERVAL_TOLERANCE_DAYS[interval] * DAY_MS;

    // Compared by *magnitude*, not the raw signed difference — for an
    // expense series, amountTiyin getting more negative means the price
    // went up ("подорожал"), which should read as a positive percent.
    const previousAmount = sorted.length >= 2 ? sorted[sorted.length - 2].amountTiyin : null;
    const priceChangePercent =
      previousAmount !== null && previousAmount !== 0
        ? ((Math.abs(last.amountTiyin) - Math.abs(previousAmount)) / Math.abs(previousAmount)) * 100
        : null;

    series.push({
      key,
      label: last.description,
      interval,
      avgAmountTiyin: Math.round(avgAmount),
      occurrences: sorted.map((r) => ({
        transactionId: r.transactionId,
        occurredAt: r.occurredAt,
        amountTiyin: r.amountTiyin,
      })),
      nextExpectedDate,
      priceChangePercent,
      missed,
    });
  }

  return series;
}
