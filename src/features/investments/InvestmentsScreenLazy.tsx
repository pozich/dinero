import { lazy, Suspense } from "react";

// Code-split, same reason as AnalyticsScreenLazy — this screen reuses
// EChart (StockChart/PortfolioOverview), which pulls in ECharts; without
// this it would land back in the main bundle.
const InvestmentsScreen = lazy(() => import("./InvestmentsScreen").then((m) => ({ default: m.InvestmentsScreen })));

export function InvestmentsScreenLazy() {
  return (
    <Suspense
      fallback={
        <div className="screen">
          <p className="hint">Загрузка инвестиций...</p>
        </div>
      }
    >
      <InvestmentsScreen />
    </Suspense>
  );
}
