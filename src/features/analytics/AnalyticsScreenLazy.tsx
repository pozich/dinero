import { lazy, Suspense } from "react";

// Code-split per SPEC-2.md 6.2 — ECharts (~1 MB) only loads once this tab
// is actually opened, so it never touches the app's cold-start path
// (relevant for the Android target in Ф10).
const AnalyticsScreen = lazy(() => import("./AnalyticsScreen").then((m) => ({ default: m.AnalyticsScreen })));

export function AnalyticsScreenLazy() {
  return (
    <Suspense
      fallback={
        <div className="screen">
          <p className="hint">Загрузка аналитики...</p>
        </div>
      }
    >
      <AnalyticsScreen />
    </Suspense>
  );
}
