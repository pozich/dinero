/**
 * SPEC-2.md Ф4/Android: swipe left on a row = edit category, swipe right =
 * toggle "не учитывать". A swipe only counts once it's clearly horizontal
 * and past a minimum distance, so an ordinary vertical scroll or a tap
 * never gets mistaken for one.
 */
export function detectSwipe(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  { minDistance = 50, maxVerticalRatio = 0.5 }: { minDistance?: number; maxVerticalRatio?: number } = {},
): "left" | "right" | null {
  const dx = endX - startX;
  const dy = endY - startY;
  if (Math.abs(dx) < minDistance) return null;
  if (Math.abs(dy) > Math.abs(dx) * maxVerticalRatio) return null;
  return dx < 0 ? "left" : "right";
}
