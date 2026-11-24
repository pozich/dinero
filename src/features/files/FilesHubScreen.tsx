import { useRef } from "react";
import { FilesScreen } from "./FilesScreen";
import { SettingsScreen } from "../settings/SettingsScreen";
import { DataScreen } from "../data/DataScreen";

type SectionId = "files" | "settings" | "data";

const SECTIONS: { id: SectionId; label: string }[] = [
  { id: "files", label: "Файлы" },
  { id: "settings", label: "Настройки" },
  { id: "data", label: "Данные" },
];

/** Файлы/Настройки/Данные — один экран ("хозяйственная" часть приложения),
 * не три отдельных подэкрана: все секции смонтированы и видны сразу, верхняя
 * навигация — это якоря для прокрутки, а не переключатель контента. */
export function FilesHubScreen() {
  const containerRef = useRef<HTMLDivElement>(null);

  function scrollTo(id: SectionId) {
    containerRef.current
      ?.querySelector(`#hub-section-${id}`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="hub-screen" ref={containerRef}>
      <div className="hub-nav">
        {SECTIONS.map((s) => (
          <button key={s.id} type="button" onClick={() => scrollTo(s.id)}>
            {s.label}
          </button>
        ))}
      </div>
      <div className="hub-section" id="hub-section-files">
        <FilesScreen />
      </div>
      <div className="hub-section" id="hub-section-settings">
        <SettingsScreen />
      </div>
      <div className="hub-section" id="hub-section-data">
        <DataScreen />
      </div>
    </div>
  );
}
