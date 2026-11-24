import { useState } from "react";
import { FilesScreen } from "./FilesScreen";
import { SettingsScreen } from "../settings/SettingsScreen";
import { DataScreen } from "../data/DataScreen";

type SubTab = "files" | "settings" | "data";

const SUB_TABS: { id: SubTab; label: string }[] = [
  { id: "files", label: "Файлы" },
  { id: "settings", label: "Настройки" },
  { id: "data", label: "Данные" },
];

/** Объединяет Файлы/Настройки/Данные под одной вкладкой — мелкая,
 * неаналитическая "хозяйственная" часть приложения, нет смысла держать
 * их тремя равноправными верхнеуровневыми вкладками. */
export function FilesHubScreen() {
  const [sub, setSub] = useState<SubTab>("files");

  return (
    <div className="hub-screen">
      <div className="hub-subnav">
        {SUB_TABS.map((t) => (
          <button key={t.id} type="button" className={t.id === sub ? "active" : ""} onClick={() => setSub(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      {sub === "files" && <FilesScreen />}
      {sub === "settings" && <SettingsScreen />}
      {sub === "data" && <DataScreen />}
    </div>
  );
}
