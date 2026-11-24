import { useState } from "react";
import { applyTheme, getStoredTheme, THEME_LABELS, THEME_ORDER, type ThemeId } from "../../app/theme";

/** Общие настройки приложения — пока только тема (SPEC.md п.8: AMOLED
 * плюс более спокойные варианты, чтобы не упираться в один
 * вырвиглазный чёрно-белый контраст). */
export function SettingsScreen() {
  const [theme, setTheme] = useState<ThemeId>(getStoredTheme());

  function choose(next: ThemeId) {
    setTheme(next);
    applyTheme(next);
  }

  return (
    <div className="screen">
      <h2>Настройки</h2>
      <h3>Тема</h3>
      <div className="theme-picker">
        {THEME_ORDER.map((id) => (
          <button
            key={id}
            type="button"
            className={`theme-option ${id === theme ? "active" : ""}`}
            onClick={() => choose(id)}
          >
            <span className={`theme-swatch theme-swatch-${id}`} />
            {THEME_LABELS[id]}
          </button>
        ))}
      </div>
    </div>
  );
}
