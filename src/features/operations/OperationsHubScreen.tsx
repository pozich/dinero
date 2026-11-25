import { useRef } from "react";
import { OperationsScreen } from "./OperationsScreen";
import { CategoriesScreen } from "../categories/CategoriesScreen";

type SectionId = "categories" | "operations";

const SECTIONS: { id: SectionId; label: string }[] = [
  { id: "categories", label: "Категории" },
  { id: "operations", label: "Операции" },
];

/** Категории/Операции — один экран: обе секции смонтированы и видны сразу,
 * верхняя навигация только прокручивает к секции, не переключает контент
 * (см. FilesHubScreen/AnalyticsHubScreen — тот же принцип). Категории
 * теперь живут здесь постоянно, а не во всплывающем окне из вкладки
 * «Данные». */
export function OperationsHubScreen() {
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
      <div className="hub-section" id="hub-section-categories">
        <div className="screen">
          <CategoriesScreen />
        </div>
      </div>
      <div className="hub-section" id="hub-section-operations">
        <OperationsScreen />
      </div>
    </div>
  );
}
