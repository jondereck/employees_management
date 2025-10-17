export type MetricMode = "days" | "minutes";

export const ALL_CHART_IDS = [
  "office-leaderboard",
  "arrival-distribution",
  "calendar-heatmap",
  "top-late-ut",
  "trend-lines",
  "first-last-scatter",
] as const;

export type ChartId = (typeof ALL_CHART_IDS)[number];

export const DEFAULT_VISIBLE_CHARTS: ChartId[] = [...ALL_CHART_IDS];

export type InsightsSettings = {
  selectedOffices?: string[];
  selectedScheduleTypes?: string[];
  showUnmatched?: boolean;
  metricMode?: MetricMode;
  visibleCharts?: ChartId[];
  collapsed?: boolean;
  showNoPunchColumn?: boolean;
};

export const INSIGHTS_SETTINGS_KEY = "biometrics-insights-settings-v1";
