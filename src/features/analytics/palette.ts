// Matches src/app/theme.css's AMOLED palette (SPEC.md п.8 / SPEC-2.md 6.2) —
// charts have no access to CSS variables, so the same values are repeated
// here deliberately rather than invented separately.
export const CHART_COLORS = {
  bg: "#000000",
  text: "#e8e8e8",
  textDim: "#8a8a8a",
  accent: "#7dd3c0",
  border: "#242424",
  surface: "#121212",
  income: "#7dd3c0",
  expense: "#e0806b",
};

/** A small, deterministic palette for category/account series — derived
 * from a category's own `color` when it has one (SPEC-2.md 6.2), falling
 * back to this rotation otherwise so charts stay readable without forcing
 * every category to be colored first. */
export const SERIES_PALETTE = [
  "#7dd3c0",
  "#e0c56b",
  "#e0806b",
  "#8ab4e0",
  "#c08ae0",
  "#8ae0a3",
  "#e08ac0",
  "#b4a98a",
];

export function colorForIndex(index: number): string {
  return SERIES_PALETTE[index % SERIES_PALETTE.length];
}

export function colorForCategory(categoryColor: string | null | undefined, fallbackIndex: number): string {
  return categoryColor ?? colorForIndex(fallbackIndex);
}

/** Shared textStyle/axis defaults merged into every chart option so none of
 * them has to repeat the dark-theme boilerplate by hand. */
export const BASE_TEXT_STYLE = { color: CHART_COLORS.textDim, fontSize: 12 };
export const BASE_AXIS_LINE = { lineStyle: { color: CHART_COLORS.border } };
export const BASE_SPLIT_LINE = { lineStyle: { color: CHART_COLORS.border, opacity: 0.5 } };
