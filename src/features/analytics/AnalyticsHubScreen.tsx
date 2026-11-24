import { useState } from "react";
import { AnalyticsScreenLazy } from "./AnalyticsScreenLazy";
import { InvestmentsScreenLazy } from "../investments/InvestmentsScreenLazy";

type SubTab = "analytics" | "investments";

const SUB_TABS: { id: SubTab; label: string }[] = [
  { id: "analytics", label: "Аналитика" },
  { id: "investments", label: "Инвестиции" },
];

export function AnalyticsHubScreen() {
  const [sub, setSub] = useState<SubTab>("analytics");

  return (
    <div className="hub-screen">
      <div className="hub-subnav">
        {SUB_TABS.map((t) => (
          <button key={t.id} type="button" className={t.id === sub ? "active" : ""} onClick={() => setSub(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      {sub === "analytics" && <AnalyticsScreenLazy />}
      {sub === "investments" && <InvestmentsScreenLazy />}
    </div>
  );
}
