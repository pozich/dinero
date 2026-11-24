import type { LedgerRow } from "../db/ledgerQuery";
import type { DateRange } from "../ledger/coverage";
import type { Period } from "./period";

export type AccuracyWarning = {
  uncategorizedCount: number;
  unconfirmedLinksCount: number;
  gapDescriptions: string[];
};

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${pad(d.getUTCDate())}.${pad(d.getUTCMonth() + 1)}`;
}

/** SPEC-2.md 6.2's "14 операций без категории, 2 непроверенных перевода,
 * дыра в выписке Halyk" — every number here must be something clicking the
 * banner can actually lead to fixing, nothing vaguer than that. */
export function buildAccuracyWarning(
  periodRows: readonly LedgerRow[],
  unconfirmedLinksCount: number,
  accounts: readonly { accountName: string; gaps: readonly DateRange[] }[],
  period: Period,
): AccuracyWarning {
  const uncategorizedCount = periodRows.filter((r) => !r.excluded && r.categoryId === null).length;

  const gapDescriptions: string[] = [];
  for (const account of accounts) {
    for (const gap of account.gaps) {
      if (gap.start < period.end && gap.end > period.start) {
        gapDescriptions.push(`${account.accountName}: нет данных ${formatDate(gap.start)}–${formatDate(gap.end)}`);
      }
    }
  }

  return { uncategorizedCount, unconfirmedLinksCount, gapDescriptions };
}

export function isAccuracyWarningEmpty(warning: AccuracyWarning): boolean {
  return (
    warning.uncategorizedCount === 0 &&
    warning.unconfirmedLinksCount === 0 &&
    warning.gapDescriptions.length === 0
  );
}

export function formatAccuracyWarning(warning: AccuracyWarning): string {
  const parts: string[] = [];
  if (warning.uncategorizedCount > 0) parts.push(`${warning.uncategorizedCount} операций без категории`);
  if (warning.unconfirmedLinksCount > 0) parts.push(`${warning.unconfirmedLinksCount} непроверенных переводов/возвратов`);
  parts.push(...warning.gapDescriptions);
  return parts.join(", ");
}
