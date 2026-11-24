export type ThemeId = "amoled" | "dim" | "slate";

export const THEME_LABELS: Record<ThemeId, string> = {
  dim: "Тёмно-серая (по умолчанию)",
  amoled: "AMOLED (чёрный)",
  slate: "Спокойная (сине-серая)",
};

export const THEME_ORDER: ThemeId[] = ["dim", "amoled", "slate"];

const STORAGE_KEY = "dinero.theme";
const DEFAULT_THEME: ThemeId = "dim";

function isThemeId(value: string | null): value is ThemeId {
  return value === "amoled" || value === "dim" || value === "slate";
}

/** A UI preference, same category as the table-column settings already
 * kept in localStorage elsewhere — not app data, never synced via the
 * vault. */
export function getStoredTheme(): ThemeId {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (isThemeId(stored)) return stored;
  } catch {
    // localStorage can throw (private window, blocked storage) — fall back silently
  }
  return DEFAULT_THEME;
}

export function applyTheme(theme: ThemeId): void {
  document.documentElement.setAttribute("data-theme", theme);
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // best-effort persistence only
  }
}
