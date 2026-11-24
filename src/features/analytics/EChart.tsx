import { useEffect, useRef } from "react";
import * as echarts from "echarts";

/** Every chart's data items carry their own `transactionIds` field (echarts
 * preserves arbitrary custom fields on a data item, object-form), so a
 * click always resolves to "which operations made up this number" without
 * each chart type needing its own index-to-ids lookup. */
export type EChartClickInfo = { transactionIds: number[]; name?: string };

/**
 * Thin wrapper around a raw ECharts instance — this module (and everything
 * it imports) only ever gets loaded as part of the Analytics screen's own
 * lazy chunk (see `AnalyticsScreen.tsx`'s `React.lazy`), so the ~1 MB
 * ECharts bundle never touches the app's cold-start path (SPEC-2.md 6.2).
 */
export function EChart({
  option,
  onClick,
  exportRef,
  height = 360,
}: {
  option: echarts.EChartsCoreOption;
  onClick?: (info: EChartClickInfo) => void;
  exportRef?: React.MutableRefObject<(() => string) | null>;
  height?: number | string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);
  const onClickRef = useRef(onClick);
  onClickRef.current = onClick;

  useEffect(() => {
    if (!containerRef.current) return;
    const chart = echarts.init(containerRef.current, null, { renderer: "canvas" });
    chartRef.current = chart;

    chart.on("click", (params) => {
      const data = params.data as { transactionIds?: number[] } | undefined;
      onClickRef.current?.({
        transactionIds: data?.transactionIds ?? [],
        name: typeof params.name === "string" ? params.name : undefined,
      });
    });

    const resizeObserver = new ResizeObserver(() => chart.resize());
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.dispose();
      chartRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    chartRef.current?.setOption(option, true);
  }, [option]);

  useEffect(() => {
    if (!exportRef) return;
    exportRef.current = () => chartRef.current?.getDataURL({ pixelRatio: 2, backgroundColor: "#121212" }) ?? "";
    return () => {
      exportRef.current = null;
    };
  }, [exportRef]);

  return <div ref={containerRef} style={{ width: "100%", height }} />;
}
