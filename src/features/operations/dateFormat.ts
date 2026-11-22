const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** "Oct 25" normally, "Oct 25, 2026" when the visible set spans several years
 * (SPEC.md 6.4). */
export function formatTransactionDate(isoDate: string, showYear: boolean): string {
  const d = new Date(isoDate);
  const month = MONTHS[d.getUTCMonth()];
  const day = d.getUTCDate();
  return showYear ? `${month} ${day}, ${d.getUTCFullYear()}` : `${month} ${day}`;
}

export function spansMultipleYears(isoDates: readonly string[]): boolean {
  const years = new Set(isoDates.map((d) => new Date(d).getUTCFullYear()));
  return years.size > 1;
}
