"use client";

import dynamic from "next/dynamic";

function ChartSkeleton({ height = "h-64" }: { height?: string }) {
  return (
    <div
      className={`${height} w-full animate-pulse rounded-xl bg-slate-900/60`}
      role="status"
      aria-label="Loading chart"
    />
  );
}

export const LazyWeeklyChart = dynamic(
  () => import("./weekly-chart").then((m) => ({ default: m.WeeklyChart })),
  { ssr: false, loading: () => <ChartSkeleton /> }
);

export const LazyTrendSparkline = dynamic(
  () => import("./trend-sparkline").then((m) => ({ default: m.TrendSparkline })),
  { ssr: false, loading: () => <ChartSkeleton height="h-24" /> }
);

export const LazyCompareChart = dynamic(
  () => import("./compare-chart").then((m) => ({ default: m.CompareChart })),
  { ssr: false, loading: () => <ChartSkeleton /> }
);
