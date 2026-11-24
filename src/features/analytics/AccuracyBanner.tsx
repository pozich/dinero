import type { AccuracyWarning } from "../../analytics/accuracyWarning";
import { formatAccuracyWarning, isAccuracyWarningEmpty } from "../../analytics/accuracyWarning";

/** SPEC-2.md 6.2's "предупреждение о неточности" — a click leads straight
 * to fixing whichever part is flagged. */
export function AccuracyBanner({
  warning,
  uncategorizedIds,
  onFixUncategorized,
  onOpenReview,
}: {
  warning: AccuracyWarning;
  uncategorizedIds: number[];
  onFixUncategorized: (ids: number[]) => void;
  onOpenReview: () => void;
}) {
  if (isAccuracyWarningEmpty(warning)) return null;

  return (
    <div className="banner banner-warning accuracy-banner">
      <span>⚠ {formatAccuracyWarning(warning)}</span>
      {warning.uncategorizedCount > 0 && (
        <button type="button" onClick={() => onFixUncategorized(uncategorizedIds)}>
          Исправить категории
        </button>
      )}
      {warning.unconfirmedLinksCount > 0 && (
        <button type="button" onClick={onOpenReview}>
          Проверить
        </button>
      )}
    </div>
  );
}
