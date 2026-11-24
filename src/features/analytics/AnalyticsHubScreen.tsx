import { useRef } from "react";
import { AnalyticsScreenLazy } from "./AnalyticsScreenLazy";
import { InvestmentsScreenLazy } from "../investments/InvestmentsScreenLazy";

type SectionId = "analytics" | "investments";

const SECTIONS: { id: SectionId; label: string }[] = [
  { id: "analytics", label: "Аналитика" },
  { id: "investments", label: "Инвестиции" },
];

/** Аналитика/Инвестиции — один экран: обе секции смонтированы и видны сразу,
 * верхняя навигация только прокручивает к секции, не переключает контент. */
export function AnalyticsHubScreen() {
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
      <div className="hub-section" id="hub-section-analytics">
        <AnalyticsScreenLazy />
      </div>
      <div className="hub-section" id="hub-section-investments">
        <InvestmentsScreenLazy />
      </div>
    </div>
  );
}
