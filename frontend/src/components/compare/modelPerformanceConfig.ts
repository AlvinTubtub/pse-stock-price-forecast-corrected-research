import type { FormalModelId } from "@/lib/types";
import type { MetricKey, SortKey } from "./modelPerformanceTypes";

export const MODELS: FormalModelId[] = ["lag_reg", "arima", "lstm", "naive"];
export const PRINCIPAL_MODELS: Exclude<FormalModelId, "naive">[] = ["lag_reg", "arima", "lstm"];

export const MODEL_CONFIG: Record<
  FormalModelId,
  {
    label: string;
    shortLabel: string;
    color: string;
    bgBadge: string;
    borderBadge: string;
    textBadge: string;
  }
> = {
  lag_reg: {
    label: "Lag-Informed Regression",
    shortLabel: "Lag Regression",
    color: "#10b981", // emerald-500
    bgBadge: "bg-emerald-500/10 dark:bg-emerald-500/15",
    borderBadge: "border-emerald-500/30",
    textBadge: "text-emerald-700 dark:text-emerald-400",
  },
  arima: {
    label: "ARIMA",
    shortLabel: "ARIMA",
    color: "#06b6d4", // cyan-500
    bgBadge: "bg-cyan-500/10 dark:bg-cyan-500/15",
    borderBadge: "border-cyan-500/30",
    textBadge: "text-cyan-700 dark:text-cyan-400",
  },
  lstm: {
    label: "LSTM",
    shortLabel: "LSTM",
    color: "#8b5cf6", // purple-500
    bgBadge: "bg-purple-500/10 dark:bg-purple-500/15",
    borderBadge: "border-purple-500/30",
    textBadge: "text-purple-700 dark:text-purple-400",
  },
  naive: {
    label: "Naive Baseline",
    shortLabel: "Naive Persistence",
    color: "#94a3b8", // slate-400
    bgBadge: "bg-slate-500/10 dark:bg-slate-500/15",
    borderBadge: "border-slate-500/30",
    textBadge: "text-slate-700 dark:text-slate-400",
  },
};

export interface MetricDefinition {
  name: string;
  shortName: string;
  fullName: string;
  unit: string;
  direction: "lower" | "higher";
  betterText: string;
  description: string;
  interpretation: string;
  medianExplanation: string;
  formatValue: (val: number | null | undefined, digits?: number) => string;
}

export const METRIC_CONFIG: Record<MetricKey, MetricDefinition> = {
  rmse: {
    name: "RMSE",
    shortName: "RMSE",
    fullName: "Root Mean Squared Error",
    unit: "₱",
    direction: "lower",
    betterText: "Lower is better",
    description: "Measures error magnitude in Philippine Pesos (₱), penalizing large outliers through quadratic squaring.",
    interpretation: "Root Mean Squared Error (₱): Quadratic penalty for price misses. Lower value indicates tighter tracking of actual close prices.",
    medianExplanation: "Median summarizes the filtered companies, but peso-denominated errors remain affected by company price scale.",
    formatValue: (val, digits = 4) =>
      val == null || !Number.isFinite(val) ? "—" : `₱${val.toFixed(digits)}`,
  },
  mae: {
    name: "MAE",
    shortName: "MAE",
    fullName: "Mean Absolute Error",
    unit: "₱",
    direction: "lower",
    betterText: "Lower is better",
    description: "Calculates the average absolute miss linearly in Philippine Pesos (₱) without disproportionately weighting outliers.",
    interpretation: "Mean Absolute Error (₱): Linear average absolute miss. Lower value indicates smaller typical price deviation.",
    medianExplanation: "Median summarizes the filtered companies, but peso-denominated errors remain affected by company price scale.",
    formatValue: (val, digits = 4) =>
      val == null || !Number.isFinite(val) ? "—" : `₱${val.toFixed(digits)}`,
  },
  mase: {
    name: "MASE",
    shortName: "MASE",
    fullName: "Mean Absolute Scaled Error",
    unit: "",
    direction: "lower",
    betterText: "< 1.0 has lower MAE than Naive",
    description: "Lower is better. A value below 1.0 indicates lower average absolute error than the Naive persistence benchmark; it does not by itself establish statistical significance.",
    interpretation: "Mean Absolute Scaled Error: Scaled relative to Naive persistence. Lower is better. A value below 1.0 indicates lower average absolute error than the Naive persistence benchmark; it does not by itself establish statistical significance.",
    medianExplanation: "MASE is scale-normalized relative to each company’s Naive denominator.",
    formatValue: (val, digits = 4) =>
      val == null || !Number.isFinite(val) ? "—" : val.toFixed(digits),
  },
  r2: {
    name: "R²",
    shortName: "R²",
    fullName: "Coefficient of Determination",
    unit: "",
    direction: "higher",
    betterText: "Higher is better (≤ 1.0)",
    description: "Proportion of holdout price variance explained by model forecasts. R² is NOT a confidence score or win probability.",
    interpretation: "Coefficient of Determination (R²): Proportion of price variance explained. Values closer to 1.0 indicate strong tracking. Not a confidence score.",
    medianExplanation: "Median summarizes explained variance and is not a confidence score.",
    formatValue: (val, digits = 4) =>
      val == null || !Number.isFinite(val) ? "—" : val.toFixed(digits),
  },
};

export const SECTORS: Array<{ id: string; label: string }> = [
  { id: "all", label: "All Sectors" },
  { id: "Financials", label: "Financials" },
  { id: "Industrial", label: "Industrial" },
  { id: "Mining and Oil", label: "Mining and Oil" },
  { id: "Property", label: "Property" },
  { id: "Services", label: "Services" },
];

export const SORT_OPTIONS: Array<{ key: SortKey; label: string }> = [
  { key: "symbol", label: "Company Symbol (A–Z)" },
  { key: "best_score", label: "Best Score" },
  { key: "worst_score", label: "Worst Score" },
];
