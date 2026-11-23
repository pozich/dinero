import type { GoldenResult } from "../../parsers/goldenCheck";
import { formatTiyin } from "../operations/money";

/** Shows which check failed and by how much, instead of just "error" —
 * SPEC-2.md 3.3 asks for the size of the mismatch; page/month localization
 * isn't possible with what the parsers currently track, so this is the
 * honest "if possible" fallback. */
export function formatGoldenMismatch(golden: GoldenResult): string {
  const parts: string[] = [];
  if (golden.summaryDelta !== golden.expectedDelta) {
    parts.push(`итоговый блок расходится на ${formatTiyin(golden.summaryDelta - golden.expectedDelta)}`);
  }
  if (golden.transactionsDelta !== golden.expectedDelta) {
    parts.push(
      `сумма операций расходится на ${formatTiyin(golden.transactionsDelta - golden.expectedDelta)}`,
    );
  }
  return parts.join("; ");
}
