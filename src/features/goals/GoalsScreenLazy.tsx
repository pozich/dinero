import { lazy, Suspense } from "react";

// Code-split, same reason as AnalyticsScreenLazy/InvestmentsScreenLazy —
// GoalCard's plan/fact chart pulls in ECharts via EChart.tsx, and this
// modal is opened from a plain header button in App.tsx (always mounted),
// so without this ECharts would land in the main bundle.
const GoalsScreen = lazy(() => import("./GoalsScreen").then((m) => ({ default: m.GoalsScreen })));

export function GoalsScreenLazy(props: { onClose: () => void; onCountChange?: (n: number) => void }) {
  return (
    <Suspense fallback={null}>
      <GoalsScreen {...props} />
    </Suspense>
  );
}
