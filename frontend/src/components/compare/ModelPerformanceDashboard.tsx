"use client";

import React, { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import CompanyLogo from "@/components/CompanyLogo";
import ModernIcon, { ModernSquircleBadge } from "@/components/ModernIcon";
import { formatDate, formatNum } from "@/lib/format";
import type { FormalModelId, FormalModelSummary } from "@/lib/types";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";

export type MetricKey = "rmse" | "mae" | "mase" | "r2";
export type SortKey = "symbol" | "best_score" | "worst_score";
export type SortDirection = "asc" | "desc";

export interface DashboardCompanyMetric {
  rmse: number;
  mae: number;
  mase: number;
  r2: number;
}

export interface DashboardCompany {
  symbol: string;
  name: string;
  sector: string;
  principalWinnerByRmse: Exclude<FormalModelId, "naive">;
  lowestRmseIncludingNaive?: FormalModelId[];
  metrics: Record<FormalModelId, DashboardCompanyMetric>;
  dmSquaredErrorVsNaive: Record<
    Exclude<FormalModelId, "naive">,
    {
      adjustedPValue: number;
      rawPValue: number;
      significantlyBeatsNaive: boolean;
    }
  >;
  configuration: {
    lagRegression: { alpha: number; selectedFeatureCount: number };
    arima: { order: number[]; trend: string | null; converged: boolean };
    lstm: { lookback: number; hiddenSize: number; learningRate: number; batchSize: number; fixedEpochs: number };
  };
}

export interface ModelPerformanceData {
  data: {
    firstDate: string;
    cutoffDate: string;
    holdoutStart: string;
    holdoutEnd: string;
    companyCount: number;
    rowsPerCompany: number;
    totalHoldoutPredictions: number;
  };
  methodology: {
    modelLabels: Record<FormalModelId, string>;
    lassoAlphaCandidates: number;
    lstmConfigurations: number;
    lstmFolds: number;
    lstmTuningSeeds: number[];
  };
  conclusion: {
    summary: string;
    principalRmseWins: Record<Exclude<FormalModelId, "naive">, number>;
    dominanceThreshold: number;
    significantVsNaive: Array<{
      symbol: string;
      model: Exclude<FormalModelId, "naive">;
      adjustedPValue: number;
    }>;
  };
  aggregate: Record<FormalModelId, FormalModelSummary>;
  acrossCompany: {
    friedmanMase: {
      statistic: number;
      permutation_p_value: number;
      n_companies: number;
    };
    wilcoxonPosthoc: {
      posthoc_executed: boolean;
      results: Record<string, { p_value: number; holm_p_value: number; statistic: number }>;
    };
    rmseConsistency: {
      counts: Record<Exclude<FormalModelId, "naive">, number>;
      dominant_count: number;
      min_required: number;
      pass: boolean;
    };
  };
  companies: DashboardCompany[];
}

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
    role: string;
  }
> = {
  lag_reg: {
    label: "Lag-Informed Regression",
    shortLabel: "Lag Reg",
    color: "#10b981", // emerald
    bgBadge: "bg-emerald-500/15",
    borderBadge: "border-emerald-500/30",
    textBadge: "text-emerald-500 dark:text-emerald-400",
    role: "Regularized Autoregressive ML",
  },
  arima: {
    label: "ARIMA",
    shortLabel: "ARIMA",
    color: "#00f0ff", // neon cyan
    bgBadge: "bg-cyan-500/15",
    borderBadge: "border-cyan-500/30",
    textBadge: "text-cyan-600 dark:text-cyan-400",
    role: "Statistical Econometric Standard",
  },
  lstm: {
    label: "LSTM",
    shortLabel: "LSTM",
    color: "#a855f7", // purple
    bgBadge: "bg-purple-500/15",
    borderBadge: "border-purple-500/30",
    textBadge: "text-purple-600 dark:text-purple-400",
    role: "Deep Recurrent Neural Network",
  },
  naive: {
    label: "Naive Baseline",
    shortLabel: "Naive",
    color: "#94a3b8", // slate
    bgBadge: "bg-slate-500/15",
    borderBadge: "border-slate-500/30",
    textBadge: "text-slate-600 dark:text-slate-400",
    role: "Random-Walk Persistence Benchmark",
  },
};

export const METRIC_CONFIG: Record<
  MetricKey,
  {
    name: string;
    shortName: string;
    fullName: string;
    unit: string;
    direction: "lower" | "higher";
    betterText: string;
    description: string;
    interpretation: string;
    formatValue: (val: number | null | undefined, digits?: number) => string;
  }
> = {
  rmse: {
    name: "RMSE",
    shortName: "RMSE",
    fullName: "Root Mean Square Error",
    unit: "₱",
    direction: "lower",
    betterText: "Lower is better",
    description: "Measures average error magnitude, penalizing large misses quadratically in Philippine Pesos (₱).",
    interpretation: "Root Mean Square Error (₱): Quadratic penalty for larger misses. Lower value indicates tighter precision.",
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
    formatValue: (val, digits = 4) =>
      val == null || !Number.isFinite(val) ? "—" : `₱${val.toFixed(digits)}`,
  },
  mase: {
    name: "MASE",
    shortName: "MASE",
    fullName: "Mean Absolute Scaled Error",
    unit: "",
    direction: "lower",
    betterText: "< 1.0 beats naive",
    description: "Standardized benchmark comparing model MAE against the Naive persistence baseline. Values < 1.0 beat naive.",
    interpretation: "Mean Absolute Scaled Error: Scaled relative to Naive persistence. Values < 1.0 beat random-walk guess. Lower is better.",
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
    formatValue: (val, digits = 4) =>
      val == null || !Number.isFinite(val) ? "—" : val.toFixed(digits),
  },
};

export default function ModelPerformanceDashboard({
  data,
}: {
  data: ModelPerformanceData;
}) {
  // State
  const [selectedMetric, setSelectedMetric] = useState<MetricKey>("rmse");
  const [selectedSector, setSelectedSector] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [sortKey, setSortKey] = useState<SortKey>("symbol");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [visibleModels, setVisibleModels] = useState<Record<FormalModelId, boolean>>({
    lag_reg: true,
    arima: true,
    lstm: true,
    naive: true,
  });
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  // Table sorting state
  const [tableSortField, setTableSortField] = useState<"symbol" | "sector" | "model" | "rmse" | "mae" | "mase" | "r2">("symbol");
  const [tableSortDir, setTableSortDir] = useState<"asc" | "desc">("asc");

  // Check reduced motion preference
  useEffect(() => {
    try {
      const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
      setPrefersReducedMotion(mediaQuery.matches);
      const listener = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
      mediaQuery.addEventListener("change", listener);
      return () => mediaQuery.removeEventListener("change", listener);
    } catch {
      // Fallback
    }
  }, []);

  // Distinct sectors
  const sectors = useMemo(() => {
    const set = new Set<string>();
    data.companies.forEach((c) => {
      if (c.sector) set.add(c.sector);
    });
    return Array.from(set).sort();
  }, [data.companies]);

  // Model toggle handler (ensure at least one model stays active)
  const toggleModel = (model: FormalModelId) => {
    const activeCount = Object.values(visibleModels).filter(Boolean).length;
    if (visibleModels[model] && activeCount <= 1) {
      return; // prevent turning off the only visible model
    }
    setVisibleModels((prev) => ({ ...prev, [model]: !prev[model] }));
  };

  // Filtered companies
  const filteredCompanies = useMemo(() => {
    let list = [...data.companies];

    // Sector filter
    if (selectedSector !== "all") {
      list = list.filter((c) => c.sector === selectedSector);
    }

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (c) => c.symbol.toLowerCase().includes(q) || c.name.toLowerCase().includes(q)
      );
    }

    // Helper: get best score for a company on active metric among visible models
    const getBestScore = (c: DashboardCompany): number => {
      const metricMeta = METRIC_CONFIG[selectedMetric];
      let best = metricMeta.direction === "lower" ? Infinity : -Infinity;
      MODELS.forEach((m) => {
        if (!visibleModels[m]) return;
        const val = c.metrics[m]?.[selectedMetric];
        if (val != null && Number.isFinite(val)) {
          if (metricMeta.direction === "lower") {
            if (val < best) best = val;
          } else {
            if (val > best) best = val;
          }
        }
      });
      return best;
    };

    // Helper: get worst score for a company on active metric among visible models
    const getWorstScore = (c: DashboardCompany): number => {
      const metricMeta = METRIC_CONFIG[selectedMetric];
      let worst = metricMeta.direction === "lower" ? -Infinity : Infinity;
      MODELS.forEach((m) => {
        if (!visibleModels[m]) return;
        const val = c.metrics[m]?.[selectedMetric];
        if (val != null && Number.isFinite(val)) {
          if (metricMeta.direction === "lower") {
            if (val > worst) worst = val;
          } else {
            if (val < worst) worst = val;
          }
        }
      });
      return worst;
    };

    // Sorting
    list.sort((a, b) => {
      let comparison = 0;
      if (sortKey === "symbol") {
        comparison = a.symbol.localeCompare(b.symbol);
      } else if (sortKey === "best_score") {
        const scoreA = getBestScore(a);
        const scoreB = getBestScore(b);
        comparison = scoreA - scoreB;
      } else if (sortKey === "worst_score") {
        const scoreA = getWorstScore(a);
        const scoreB = getWorstScore(b);
        comparison = scoreA - scoreB;
      }
      return sortDirection === "desc" ? -comparison : comparison;
    });

    return list;
  }, [data.companies, selectedSector, searchQuery, sortKey, sortDirection, selectedMetric, visibleModels]);

  // Chart data preparation
  const chartData = useMemo(() => {
    return filteredCompanies.map((c) => {
      const row: Record<string, any> = {
        symbol: c.symbol,
        name: c.name,
        sector: c.sector,
      };
      MODELS.forEach((m) => {
        if (visibleModels[m]) {
          const val = c.metrics[m]?.[selectedMetric];
          row[m] = val != null && Number.isFinite(val) ? Number(val.toFixed(4)) : null;
        }
      });
      return row;
    });
  }, [filteredCompanies, visibleModels, selectedMetric]);

  // Dynamic Summary calculations for the filtered set and selected metric
  const summary = useMemo(() => {
    const metricMeta = METRIC_CONFIG[selectedMetric];
    const wins: Record<FormalModelId, number> = {
      lag_reg: 0,
      arima: 0,
      lstm: 0,
      naive: 0,
    };
    let totalEvaluated = 0;
    let beatsNaiveCount = 0;

    for (const c of filteredCompanies) {
      let bestVal = metricMeta.direction === "lower" ? Infinity : -Infinity;
      let winnerModel: FormalModelId | null = null;

      for (const m of MODELS) {
        if (!visibleModels[m]) continue;
        const val = c.metrics[m]?.[selectedMetric];
        if (val != null && Number.isFinite(val)) {
          if (metricMeta.direction === "lower") {
            if (val < bestVal) {
              bestVal = val;
              winnerModel = m;
            }
          } else {
            if (val > bestVal) {
              bestVal = val;
              winnerModel = m;
            }
          }
        }
      }

      if (winnerModel) {
        wins[winnerModel] = (wins[winnerModel] || 0) + 1;
        totalEvaluated += 1;
      }

      // Check naive outperformance for principal models
      const naiveVal = c.metrics.naive?.[selectedMetric];
      for (const m of PRINCIPAL_MODELS) {
        if (!visibleModels[m]) continue;
        const val = c.metrics[m]?.[selectedMetric];
        if (val != null && Number.isFinite(val)) {
          if (selectedMetric === "mase") {
            if (val < 1.0) beatsNaiveCount += 1;
          } else if (naiveVal != null && Number.isFinite(naiveVal)) {
            if (metricMeta.direction === "lower" ? val < naiveVal : val > naiveVal) {
              beatsNaiveCount += 1;
            }
          }
        }
      }
    }

    // Medians across filtered companies for each model
    const medians: Record<FormalModelId, number | null> = {
      lag_reg: null,
      arima: null,
      lstm: null,
      naive: null,
    };

    MODELS.forEach((m) => {
      const vals = filteredCompanies
        .map((c) => c.metrics[m]?.[selectedMetric])
        .filter((v): v is number => v != null && Number.isFinite(v))
        .sort((a, b) => a - b);

      if (vals.length > 0) {
        const mid = Math.floor(vals.length / 2);
        medians[m] = vals.length % 2 !== 0 ? vals[mid] : (vals[mid - 1] + vals[mid]) / 2;
      }
    });

    // Determine leading model in win count
    let leaderModel: FormalModelId = "lag_reg";
    let maxWins = -1;
    MODELS.forEach((m) => {
      if (visibleModels[m] && wins[m] > maxWins) {
        maxWins = wins[m];
        leaderModel = m;
      }
    });

    return {
      wins,
      totalEvaluated,
      beatsNaiveCount,
      medians,
      leaderModel,
      maxWins,
    };
  }, [filteredCompanies, selectedMetric, visibleModels]);

  // Flat table rows for the accessible table
  const tableRows = useMemo(() => {
    const rows: Array<{
      symbol: string;
      name: string;
      sector: string;
      model: FormalModelId;
      modelLabel: string;
      isWinnerForMetric: boolean;
      rmse: number;
      mae: number;
      mase: number;
      r2: number;
      beatsNaive: boolean;
    }> = [];

    filteredCompanies.forEach((c) => {
      // Find winner for selected metric among visible models
      let bestMetricVal = METRIC_CONFIG[selectedMetric].direction === "lower" ? Infinity : -Infinity;
      let winningModel: FormalModelId | null = null;
      MODELS.forEach((m) => {
        if (!visibleModels[m]) return;
        const val = c.metrics[m]?.[selectedMetric];
        if (val != null && Number.isFinite(val)) {
          if (METRIC_CONFIG[selectedMetric].direction === "lower") {
            if (val < bestMetricVal) {
              bestMetricVal = val;
              winningModel = m;
            }
          } else {
            if (val > bestMetricVal) {
              bestMetricVal = val;
              winningModel = m;
            }
          }
        }
      });

      MODELS.forEach((m) => {
        if (!visibleModels[m]) return;
        const metric = c.metrics[m];
        if (!metric) return;

        let beatsNaive = false;
        if (m === "naive") {
          beatsNaive = false;
        } else if (selectedMetric === "mase") {
          beatsNaive = metric.mase < 1.0;
        } else {
          const naiveVal = c.metrics.naive?.[selectedMetric];
          if (naiveVal != null) {
            beatsNaive =
              METRIC_CONFIG[selectedMetric].direction === "lower"
                ? metric[selectedMetric] < naiveVal
                : metric[selectedMetric] > naiveVal;
          }
        }

        rows.push({
          symbol: c.symbol,
          name: c.name,
          sector: c.sector,
          model: m,
          modelLabel: MODEL_CONFIG[m].label,
          isWinnerForMetric: m === winningModel,
          rmse: metric.rmse,
          mae: metric.mae,
          mase: metric.mase,
          r2: metric.r2,
          beatsNaive,
        });
      });
    });

    // Sort table rows
    rows.sort((a, b) => {
      let cmp = 0;
      if (tableSortField === "symbol") {
        cmp = a.symbol.localeCompare(b.symbol) || a.model.localeCompare(b.model);
      } else if (tableSortField === "sector") {
        cmp = a.sector.localeCompare(b.sector) || a.symbol.localeCompare(b.symbol);
      } else if (tableSortField === "model") {
        cmp = a.model.localeCompare(b.model) || a.symbol.localeCompare(b.symbol);
      } else {
        const valA = a[tableSortField];
        const valB = b[tableSortField];
        cmp = valA - valB;
      }
      return tableSortDir === "desc" ? -cmp : cmp;
    });

    return rows;
  }, [filteredCompanies, visibleModels, selectedMetric, tableSortField, tableSortDir]);

  // Handle table sort click
  const handleTableSort = (field: typeof tableSortField) => {
    if (tableSortField === field) {
      setTableSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setTableSortField(field);
      setTableSortDir("asc");
    }
  };

  // Custom Tooltip Component for Recharts
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;
    const company = data.companies.find((c) => c.symbol === label);
    if (!company) return null;

    // Find best among rendered payload items
    const metricMeta = METRIC_CONFIG[selectedMetric];
    let bestVal = metricMeta.direction === "lower" ? Infinity : -Infinity;
    let bestModelKey: string | null = null;
    payload.forEach((p: any) => {
      const val = p.value;
      if (val != null && Number.isFinite(val)) {
        if (metricMeta.direction === "lower") {
          if (val < bestVal) {
            bestVal = val;
            bestModelKey = p.dataKey;
          }
        } else {
          if (val > bestVal) {
            bestVal = val;
            bestModelKey = p.dataKey;
          }
        }
      }
    });

    return (
      <div
        className="rounded-xl border border-slate-200 dark:border-charcoal-700 bg-white/95 dark:bg-charcoal-900/95 p-4 shadow-xl backdrop-blur-md text-xs space-y-3 min-w-[260px] max-w-[320px]"
        role="tooltip"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-2 border-b border-slate-200 dark:border-charcoal-800 pb-2">
          <div>
            <div className="flex items-center gap-1.5 font-bold font-mono text-sm text-slate-900 dark:text-white">
              <span>{company.symbol}</span>
              <span className="text-[10px] font-sans px-2 py-0.5 rounded-full bg-slate-100 dark:bg-charcoal-800 text-slate-600 dark:text-slate-300 font-medium">
                {company.sector}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[220px]">
              {company.name}
            </p>
          </div>
          <span className="text-[10px] font-mono font-semibold uppercase px-1.5 py-0.5 rounded bg-neon-500/10 text-cyan-600 dark:text-neon-400 border border-cyan-500/25">
            {metricMeta.shortName}
          </span>
        </div>

        {/* Model Metrics List */}
        <div className="space-y-1.5">
          {payload.map((entry: any) => {
            const mKey = entry.dataKey as FormalModelId;
            const config = MODEL_CONFIG[mKey];
            const isWinner = mKey === bestModelKey;
            const rawVal = company.metrics[mKey]?.[selectedMetric];

            return (
              <div
                key={mKey}
                className={`flex items-center justify-between gap-2 px-2 py-1 rounded-lg ${
                  isWinner
                    ? "bg-slate-100 dark:bg-charcoal-800/90 font-semibold"
                    : "text-slate-600 dark:text-slate-300"
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: config.color }}
                    aria-hidden="true"
                  />
                  <span className="truncate text-slate-900 dark:text-slate-200">
                    {config.shortLabel}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 font-mono">
                  <span className="text-slate-900 dark:text-white font-bold">
                    {metricMeta.formatValue(rawVal)}
                  </span>
                  {isWinner && (
                    <span className="text-[9px] font-mono uppercase px-1 py-0.2 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                      Best
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Metric Interpretation Footer */}
        <div className="pt-2 border-t border-slate-200 dark:border-charcoal-800 text-[10px] text-slate-500 dark:text-slate-400 leading-snug">
          {metricMeta.interpretation}
        </div>
      </div>
    );
  };

  const hasActiveFilters =
    selectedMetric !== "rmse" ||
    selectedSector !== "all" ||
    searchQuery.trim() !== "" ||
    sortKey !== "symbol" ||
    sortDirection !== "asc" ||
    !Object.values(visibleModels).every(Boolean);

  const resetFilters = () => {
    setSelectedMetric("rmse");
    setSelectedSector("all");
    setSearchQuery("");
    setSortKey("symbol");
    setSortDirection("asc");
    setVisibleModels({
      lag_reg: true,
      arima: true,
      lstm: true,
      naive: true,
    });
  };

  return (
    <div className="space-y-10 pb-16">
      {/* ================================================================
          1. HEADER & METHODOLOGICAL SCOPE
      ================================================================ */}
      <header className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="space-y-1">
            <span className="text-xs font-bold uppercase tracking-wider text-brand-500 dark:text-brand-400">
              Formal Study Holdout Evaluation
            </span>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
              Model Performance
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 max-w-3xl leading-relaxed">
              Empirical holdout benchmarks comparing Lag-Informed Regression, ARIMA, and LSTM architectures against the random-walk Naive persistence baseline across {data.data.companyCount} Philippine equities over identical target dates ({formatDate(data.data.holdoutStart)} to {formatDate(data.data.holdoutEnd)}).
            </p>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto">
            <a
              href="#performance-charts"
              className="px-3.5 py-2 rounded-xl bg-neon-500 hover:bg-neon-400 text-charcoal-950 text-xs font-bold font-mono shadow-neon-sm neon-btn-glow transition-all outline-none focus-visible:ring-2 focus-visible:ring-neon-400"
            >
              Interactive Charts ↓
            </a>
            <a
              href="#metrics-table"
              className="px-3.5 py-2 rounded-xl bg-white dark:bg-charcoal-850 border border-slate-200 dark:border-charcoal-700 hover:border-slate-300 dark:hover:border-charcoal-600 text-slate-700 dark:text-slate-200 text-xs font-semibold font-mono transition-colors outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
            >
              Data Table ↓
            </a>
          </div>
        </div>

        {/* Metric Guidance Alert */}
        <div className="p-4 rounded-xl bg-white dark:bg-charcoal-900 border border-slate-200 dark:border-charcoal-800 shadow-sm grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div className="flex items-start gap-2">
            <ModernIcon name="check" className="w-4 h-4 text-emerald-500 dark:text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <strong className="text-slate-900 dark:text-white block font-mono">RMSE & MAE (₱)</strong>
              <span className="text-slate-600 dark:text-slate-400">Lower is better. Measures average error magnitude against actual closing prices.</span>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <ModernIcon name="target" className="w-4 h-4 text-cyan-600 dark:text-neon-400 shrink-0 mt-0.5" />
            <div>
              <strong className="text-slate-900 dark:text-white block font-mono">MASE</strong>
              <span className="text-slate-600 dark:text-slate-400">Lower is better. Values &lt; 1.0 confirm forecasting skill over naive persistence.</span>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <ModernIcon name="lineChart" className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0 mt-0.5" />
            <div>
              <strong className="text-slate-900 dark:text-white block font-mono">R² Score</strong>
              <span className="text-slate-600 dark:text-slate-400">Higher is better (≤ 1.0). Explains price variance; not a confidence probability.</span>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <ModernIcon name="shieldCheck" className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <strong className="text-slate-900 dark:text-white block font-mono">Statistical Honesty</strong>
              <span className="text-slate-600 dark:text-slate-400">Win counts are descriptive; statistical superiority requires formal hypothesis tests.</span>
            </div>
          </div>
        </div>
      </header>

      {/* ================================================================
          2. INTERACTIVE CONTROLS TOOLBAR
      ================================================================ */}
      <section
        className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-charcoal-900 border border-slate-200 dark:border-charcoal-800 shadow-sm space-y-5"
        aria-label="Model performance filter and visualization controls"
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 dark:border-charcoal-800 pb-4">
          {/* Metric Selector Tabs */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
              1. Select Primary Metric
            </span>
            <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Holdout metric selection">
              {(Object.keys(METRIC_CONFIG) as MetricKey[]).map((mKey) => {
                const isSelected = selectedMetric === mKey;
                const m = METRIC_CONFIG[mKey];
                return (
                  <button
                    key={mKey}
                    role="tab"
                    aria-selected={isSelected}
                    onClick={() => setSelectedMetric(mKey)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold font-mono transition-all cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-neon-400 flex items-center gap-1.5 ${
                      isSelected
                        ? "bg-neon-500 text-charcoal-950 shadow-neon-sm"
                        : "bg-slate-100 dark:bg-charcoal-850 hover:bg-slate-200 dark:hover:bg-charcoal-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-charcoal-750"
                    }`}
                  >
                    <span>{m.name}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded font-sans font-medium ${
                        isSelected
                          ? "bg-charcoal-950/15 text-charcoal-950"
                          : "bg-slate-200 dark:bg-charcoal-800 text-slate-500 dark:text-slate-400"
                      }`}
                    >
                      {m.betterText}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Model Visibility Toggles */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
              2. Toggle Model Visibility
            </span>
            <div className="flex flex-wrap items-center gap-2" aria-label="Toggle visible forecasting architectures">
              {MODELS.map((mKey) => {
                const config = MODEL_CONFIG[mKey];
                const isVisible = visibleModels[mKey];
                return (
                  <button
                    key={mKey}
                    type="button"
                    onClick={() => toggleModel(mKey)}
                    aria-pressed={isVisible}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium font-mono transition-all cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-neon-400 flex items-center gap-1.5 border ${
                      isVisible
                        ? `${config.bgBadge} ${config.borderBadge} ${config.textBadge}`
                        : "bg-slate-100 dark:bg-charcoal-950/60 border-slate-200 dark:border-charcoal-800 text-slate-400 line-through opacity-60"
                    }`}
                  >
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: isVisible ? config.color : "#64748b" }}
                      aria-hidden="true"
                    />
                    <span>{config.shortLabel}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Sector, Search, and Sort Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          {/* Sector Filter */}
          <div className="space-y-1">
            <label htmlFor="sector-filter" className="font-semibold text-slate-700 dark:text-slate-300 block">
              Sector Filter:
            </label>
            <select
              id="sector-filter"
              value={selectedSector}
              onChange={(e) => setSelectedSector(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-charcoal-850 border border-slate-200 dark:border-charcoal-700 text-slate-900 dark:text-white font-medium outline-none focus-visible:ring-2 focus-visible:ring-neon-400 cursor-pointer"
            >
              <option value="all">All PSE Sectors ({data.companies.length})</option>
              {sectors.map((s) => (
                <option key={s} value={s}>
                  {s} ({data.companies.filter((c) => c.sector === s).length})
                </option>
              ))}
            </select>
          </div>

          {/* Company Search */}
          <div className="space-y-1">
            <label htmlFor="company-search" className="font-semibold text-slate-700 dark:text-slate-300 block">
              Company Search:
            </label>
            <div className="relative">
              <input
                id="company-search"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter by ticker (e.g. BPI, ALI)..."
                className="w-full pl-8 pr-7 py-2 rounded-xl bg-slate-50 dark:bg-charcoal-850 border border-slate-200 dark:border-charcoal-700 text-slate-900 dark:text-white placeholder-slate-400 text-xs font-mono outline-none focus-visible:ring-2 focus-visible:ring-neon-400"
              />
              <ModernIcon name="search" className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-2 p-0.5 text-slate-400 hover:text-white cursor-pointer"
                  aria-label="Clear search"
                >
                  <ModernIcon name="x" className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* Sort By */}
          <div className="space-y-1">
            <label htmlFor="sort-by" className="font-semibold text-slate-700 dark:text-slate-300 block">
              Sort By:
            </label>
            <select
              id="sort-by"
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-charcoal-850 border border-slate-200 dark:border-charcoal-700 text-slate-900 dark:text-white font-medium outline-none focus-visible:ring-2 focus-visible:ring-neon-400 cursor-pointer"
            >
              <option value="symbol">Company Ticker (A–Z)</option>
              <option value="best_score">Best Score on {METRIC_CONFIG[selectedMetric].shortName}</option>
              <option value="worst_score">Worst Score on {METRIC_CONFIG[selectedMetric].shortName}</option>
            </select>
          </div>

          {/* Sort Direction & Reset */}
          <div className="space-y-1">
            <span className="font-semibold text-slate-700 dark:text-slate-300 block">
              Order & Actions:
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"))}
                className="flex-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-charcoal-850 border border-slate-200 dark:border-charcoal-700 hover:border-slate-300 dark:hover:border-charcoal-600 text-slate-800 dark:text-slate-200 font-semibold font-mono flex items-center justify-center gap-1.5 transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-neon-400"
                aria-label={`Current sort order: ${sortDirection}. Click to toggle.`}
              >
                <ModernIcon name={sortDirection === "asc" ? "arrowUp" : "arrowDown"} className="w-3.5 h-3.5 text-cyan-600 dark:text-neon-400" />
                <span>{sortDirection === "asc" ? "Ascending" : "Descending"}</span>
              </button>

              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={resetFilters}
                  title="Reset all filters to default"
                  className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-charcoal-800 hover:bg-slate-200 dark:hover:bg-charcoal-750 text-slate-600 dark:text-slate-300 font-semibold transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
                >
                  Reset
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================
          3. FORMAL PERFORMANCE SUMMARY CARDS
      ================================================================ */}
      <section className="space-y-4" aria-labelledby="summary-heading">
        <div className="flex items-center justify-between">
          <h2 id="summary-heading" className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
            Formal Performance Summary: {METRIC_CONFIG[selectedMetric].fullName}
          </h2>
          <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
            Showing {filteredCompanies.length} of {data.companies.length} Equities
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Top Performer on Metric */}
          <div className="p-5 rounded-2xl bg-white dark:bg-charcoal-900 border border-slate-200 dark:border-charcoal-800 shadow-sm space-y-2 flex flex-col justify-between">
            <div className="space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Most Frequent Leader ({METRIC_CONFIG[selectedMetric].shortName})
              </span>
              <div className="flex items-center gap-2">
                <span
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: MODEL_CONFIG[summary.leaderModel].color }}
                  aria-hidden="true"
                />
                <h3 className="text-base font-bold text-slate-900 dark:text-white truncate">
                  {MODEL_CONFIG[summary.leaderModel].label}
                </h3>
              </div>
            </div>
            <div className="text-xs text-slate-600 dark:text-slate-300 pt-1 border-t border-slate-200 dark:border-charcoal-800">
              Leads on <strong className="text-slate-900 dark:text-white font-mono">{summary.maxWins}</strong> of {filteredCompanies.length} companies ({((summary.maxWins / Math.max(1, filteredCompanies.length)) * 100).toFixed(0)}%).
            </div>
          </div>

          {/* Card 2: Model Win Counts */}
          <div className="p-5 rounded-2xl bg-white dark:bg-charcoal-900 border border-slate-200 dark:border-charcoal-800 shadow-sm space-y-2 flex flex-col justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Win Counts by Model ({METRIC_CONFIG[selectedMetric].shortName})
            </span>
            <div className="flex flex-wrap gap-1.5">
              {MODELS.map((m) => {
                if (!visibleModels[m]) return null;
                const winCount = summary.wins[m] || 0;
                return (
                  <span
                    key={m}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono font-bold ${MODEL_CONFIG[m].bgBadge} ${MODEL_CONFIG[m].borderBadge} border ${MODEL_CONFIG[m].textBadge}`}
                  >
                    <span>{MODEL_CONFIG[m].shortLabel}:</span>
                    <span>{winCount}</span>
                  </span>
                );
              })}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">
              Descriptive holdout wins; not proof of global superiority.
            </div>
          </div>

          {/* Card 3: Outperforming Naive Baseline */}
          <div className="p-5 rounded-2xl bg-white dark:bg-charcoal-900 border border-slate-200 dark:border-charcoal-800 shadow-sm space-y-2 flex flex-col justify-between">
            <div className="space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                Beating Naive Persistence
              </span>
              <div className="text-2xl font-extrabold text-slate-900 dark:text-white font-mono">
                {summary.beatsNaiveCount}
                <span className="text-xs font-normal text-slate-500 dark:text-slate-400 ml-1.5">
                  model evaluations
                </span>
              </div>
            </div>
            <div className="text-xs text-slate-600 dark:text-slate-300 pt-1 border-t border-slate-200 dark:border-charcoal-800">
              {selectedMetric === "mase"
                ? "Instances achieving MASE < 1.0 threshold."
                : `Instances outperforming Naive on ${METRIC_CONFIG[selectedMetric].shortName}.`}
            </div>
          </div>

          {/* Card 4: Median Holdout Score */}
          <div className="p-5 rounded-2xl bg-white dark:bg-charcoal-900 border border-slate-200 dark:border-charcoal-800 shadow-sm space-y-2 flex flex-col justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Filtered Medians ({METRIC_CONFIG[selectedMetric].shortName})
            </span>
            <div className="grid grid-cols-2 gap-1.5 text-xs font-mono">
              {MODELS.map((m) => {
                if (!visibleModels[m]) return null;
                const med = summary.medians[m];
                return (
                  <div key={m} className="flex items-center justify-between gap-1 p-1 rounded bg-slate-50 dark:bg-charcoal-850 px-2">
                    <span className="text-slate-500 dark:text-slate-400 text-[10px]">{MODEL_CONFIG[m].shortLabel}:</span>
                    <span className="text-slate-900 dark:text-white font-bold">{METRIC_CONFIG[selectedMetric].formatValue(med, 3)}</span>
                  </div>
                );
              })}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">
              Medians mitigate stock price scale differences.
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================
          4. PERFORMANCE BY COMPANY (GROUPED BAR CHART)
      ================================================================ */}
      <section id="performance-charts" className="scroll-mt-24 space-y-4" aria-labelledby="chart-heading">
        <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-charcoal-900 border border-slate-200 dark:border-charcoal-800 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 dark:border-charcoal-800 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <ModernSquircleBadge icon="barChart" color="cyan" size="sm" />
                <h2 id="chart-heading" className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                  Performance by Company: {METRIC_CONFIG[selectedMetric].fullName}
                </h2>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                Grouped bar comparison across all visible models for {filteredCompanies.length} selected equities. Hover or focus on bars for detailed metrics and interpretation.
              </p>
            </div>

            <div className="flex items-center gap-3 text-xs font-mono text-slate-500 dark:text-slate-400">
              <span>{METRIC_CONFIG[selectedMetric].betterText}</span>
            </div>
          </div>

          {/* Chart Container */}
          {filteredCompanies.length === 0 ? (
            <div className="flex h-[360px] items-center justify-center rounded-xl border border-dashed border-slate-200 dark:border-charcoal-700 bg-slate-50 dark:bg-charcoal-950/40 p-6 text-center">
              <div className="space-y-2 max-w-sm">
                <p className="text-sm font-semibold text-slate-900 dark:text-white">No companies match current filters</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Try adjusting the sector filter, search keyword, or model visibility toggles above.
                </p>
                <button
                  type="button"
                  onClick={resetFilters}
                  className="px-3.5 py-1.5 rounded-lg bg-neon-500 text-charcoal-950 font-bold text-xs font-mono"
                >
                  Reset Filters
                </button>
              </div>
            </div>
          ) : (
            <div
              className="w-full overflow-x-auto overflow-y-hidden pt-2"
              role="region"
              aria-label={`Interactive grouped bar chart showing ${METRIC_CONFIG[selectedMetric].fullName} by company`}
            >
              <div className="min-w-[680px] h-[380px] sm:h-[420px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chartData}
                    margin={{ top: 20, right: 20, left: 10, bottom: 25 }}
                  >
                    <CartesianGrid stroke="#22252e" strokeDasharray="3 3" vertical={false} opacity={0.5} />
                    <XAxis
                      dataKey="symbol"
                      tick={{ fill: "#94a3b8", fontSize: 11, fontFamily: "var(--font-jetbrains-mono)" }}
                      interval={0}
                    />
                    <YAxis
                      tick={{ fill: "#94a3b8", fontSize: 11, fontFamily: "var(--font-jetbrains-mono)" }}
                      label={{
                        value: `${METRIC_CONFIG[selectedMetric].shortName} ${METRIC_CONFIG[selectedMetric].unit ? `(${METRIC_CONFIG[selectedMetric].unit})` : ""}`,
                        angle: -90,
                        position: "insideLeft",
                        fill: "#94a3b8",
                        fontSize: 11,
                      }}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend
                      verticalAlign="top"
                      height={36}
                      formatter={(val: string) => {
                        return <span className="text-xs font-mono text-slate-700 dark:text-slate-300 mr-2">{val}</span>;
                      }}
                    />

                    {/* Bars for visible models */}
                    {visibleModels.lag_reg && (
                      <Bar
                        dataKey="lag_reg"
                        name={MODEL_CONFIG.lag_reg.label}
                        fill={MODEL_CONFIG.lag_reg.color}
                        radius={[3, 3, 0, 0]}
                        isAnimationActive={!prefersReducedMotion}
                      />
                    )}
                    {visibleModels.arima && (
                      <Bar
                        dataKey="arima"
                        name={MODEL_CONFIG.arima.label}
                        fill={MODEL_CONFIG.arima.color}
                        radius={[3, 3, 0, 0]}
                        isAnimationActive={!prefersReducedMotion}
                      />
                    )}
                    {visibleModels.lstm && (
                      <Bar
                        dataKey="lstm"
                        name={MODEL_CONFIG.lstm.label}
                        fill={MODEL_CONFIG.lstm.color}
                        radius={[3, 3, 0, 0]}
                        isAnimationActive={!prefersReducedMotion}
                      />
                    )}
                    {visibleModels.naive && (
                      <Bar
                        dataKey="naive"
                        name={MODEL_CONFIG.naive.label}
                        fill={MODEL_CONFIG.naive.color}
                        radius={[3, 3, 0, 0]}
                        isAnimationActive={!prefersReducedMotion}
                      />
                    )}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ================================================================
          5. COMPLETE ACCESSIBLE NUMERICAL RESULTS TABLE
      ================================================================ */}
      <section id="metrics-table" className="scroll-mt-24 space-y-4" aria-labelledby="table-heading">
        <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-charcoal-900 border border-slate-200 dark:border-charcoal-800 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 dark:border-charcoal-800 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <ModernSquircleBadge icon="fileText" color="emerald" size="sm" />
                <h2 id="table-heading" className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                  Canonical Holdout Performance Table
                </h2>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                Complete, immutable numerical results across all visible models and filtered equities. Click any column header to sort.
              </p>
            </div>

            <div className="flex items-center gap-2 text-xs font-mono text-slate-500 dark:text-slate-400">
              <span>{tableRows.length} Rows Available</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px] text-sm text-left">
              <caption className="sr-only">
                Complete holdout performance evaluation results across Philippine equities and models
              </caption>
              <thead className="text-xs uppercase font-mono text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-charcoal-850 border-b border-slate-200 dark:border-charcoal-800">
                <tr>
                  <th
                    scope="col"
                    className="py-3 px-3.5 cursor-pointer select-none hover:text-slate-900 dark:hover:text-white"
                    onClick={() => handleTableSort("symbol")}
                    aria-sort={tableSortField === "symbol" ? (tableSortDir === "asc" ? "ascending" : "descending") : "none"}
                    tabIndex={0}
                    onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && handleTableSort("symbol")}
                  >
                    <div className="flex items-center gap-1">
                      <span>Company</span>
                      {tableSortField === "symbol" && (
                        <ModernIcon name={tableSortDir === "asc" ? "arrowUp" : "arrowDown"} className="w-3 h-3 text-cyan-500" />
                      )}
                    </div>
                  </th>
                  <th
                    scope="col"
                    className="py-3 px-3 cursor-pointer select-none hover:text-slate-900 dark:hover:text-white"
                    onClick={() => handleTableSort("sector")}
                    aria-sort={tableSortField === "sector" ? (tableSortDir === "asc" ? "ascending" : "descending") : "none"}
                    tabIndex={0}
                    onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && handleTableSort("sector")}
                  >
                    <div className="flex items-center gap-1">
                      <span>Sector</span>
                      {tableSortField === "sector" && (
                        <ModernIcon name={tableSortDir === "asc" ? "arrowUp" : "arrowDown"} className="w-3 h-3 text-cyan-500" />
                      )}
                    </div>
                  </th>
                  <th
                    scope="col"
                    className="py-3 px-3 cursor-pointer select-none hover:text-slate-900 dark:hover:text-white"
                    onClick={() => handleTableSort("model")}
                    aria-sort={tableSortField === "model" ? (tableSortDir === "asc" ? "ascending" : "descending") : "none"}
                    tabIndex={0}
                    onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && handleTableSort("model")}
                  >
                    <div className="flex items-center gap-1">
                      <span>Model</span>
                      {tableSortField === "model" && (
                        <ModernIcon name={tableSortDir === "asc" ? "arrowUp" : "arrowDown"} className="w-3 h-3 text-cyan-500" />
                      )}
                    </div>
                  </th>
                  <th
                    scope="col"
                    className="py-3 px-3 text-right cursor-pointer select-none hover:text-slate-900 dark:hover:text-white"
                    onClick={() => handleTableSort("rmse")}
                    aria-sort={tableSortField === "rmse" ? (tableSortDir === "asc" ? "ascending" : "descending") : "none"}
                    tabIndex={0}
                    onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && handleTableSort("rmse")}
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>RMSE (₱)</span>
                      {tableSortField === "rmse" && (
                        <ModernIcon name={tableSortDir === "asc" ? "arrowUp" : "arrowDown"} className="w-3 h-3 text-cyan-500" />
                      )}
                    </div>
                  </th>
                  <th
                    scope="col"
                    className="py-3 px-3 text-right cursor-pointer select-none hover:text-slate-900 dark:hover:text-white"
                    onClick={() => handleTableSort("mae")}
                    aria-sort={tableSortField === "mae" ? (tableSortDir === "asc" ? "ascending" : "descending") : "none"}
                    tabIndex={0}
                    onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && handleTableSort("mae")}
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>MAE (₱)</span>
                      {tableSortField === "mae" && (
                        <ModernIcon name={tableSortDir === "asc" ? "arrowUp" : "arrowDown"} className="w-3 h-3 text-cyan-500" />
                      )}
                    </div>
                  </th>
                  <th
                    scope="col"
                    className="py-3 px-3 text-right cursor-pointer select-none hover:text-slate-900 dark:hover:text-white"
                    onClick={() => handleTableSort("mase")}
                    aria-sort={tableSortField === "mase" ? (tableSortDir === "asc" ? "ascending" : "descending") : "none"}
                    tabIndex={0}
                    onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && handleTableSort("mase")}
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>MASE</span>
                      {tableSortField === "mase" && (
                        <ModernIcon name={tableSortDir === "asc" ? "arrowUp" : "arrowDown"} className="w-3 h-3 text-cyan-500" />
                      )}
                    </div>
                  </th>
                  <th
                    scope="col"
                    className="py-3 px-3 text-right cursor-pointer select-none hover:text-slate-900 dark:hover:text-white"
                    onClick={() => handleTableSort("r2")}
                    aria-sort={tableSortField === "r2" ? (tableSortDir === "asc" ? "ascending" : "descending") : "none"}
                    tabIndex={0}
                    onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && handleTableSort("r2")}
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>R²</span>
                      {tableSortField === "r2" && (
                        <ModernIcon name={tableSortDir === "asc" ? "arrowUp" : "arrowDown"} className="w-3 h-3 text-cyan-500" />
                      )}
                    </div>
                  </th>
                  <th scope="col" className="py-3 px-3 text-center">
                    Benchmark Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-charcoal-800">
                {tableRows.map((row) => {
                  const mConfig = MODEL_CONFIG[row.model];
                  return (
                    <tr
                      key={`${row.symbol}-${row.model}`}
                      className="hover:bg-slate-50 dark:hover:bg-charcoal-850/50 transition-colors"
                    >
                      <td className="py-2.5 px-3.5">
                        <Link
                          href={`/companies/${row.symbol}`}
                          className="inline-flex items-center gap-2 font-bold font-mono text-slate-900 dark:text-white hover:text-cyan-600 dark:hover:text-neon-400 transition-colors"
                        >
                          <CompanyLogo symbol={row.symbol} size="xs" />
                          <span>{row.symbol}</span>
                        </Link>
                      </td>
                      <td className="py-2.5 px-3 text-xs text-slate-600 dark:text-slate-400">
                        {row.sector}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: mConfig.color }}
                            aria-hidden="true"
                          />
                          <span className="font-medium text-slate-800 dark:text-slate-200 text-xs">
                            {row.modelLabel}
                          </span>
                          {row.isWinnerForMetric && (
                            <span className="text-[9px] font-mono uppercase px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                              Best {METRIC_CONFIG[selectedMetric].shortName}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-800 dark:text-slate-200 text-xs">
                        {formatNum(row.rmse, 6)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-800 dark:text-slate-200 text-xs">
                        {formatNum(row.mae, 6)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-xs">
                        <span
                          className={
                            row.mase < 1.0
                              ? "text-emerald-600 dark:text-emerald-400 font-bold"
                              : "text-slate-800 dark:text-slate-200"
                          }
                        >
                          {formatNum(row.mase, 6)}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-800 dark:text-slate-200 text-xs">
                        {formatNum(row.r2, 6)}
                      </td>
                      <td className="py-2.5 px-3 text-center text-xs">
                        {row.model === "naive" ? (
                          <span className="text-[10px] px-2 py-0.5 rounded font-mono uppercase bg-slate-100 dark:bg-charcoal-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-charcoal-700">
                            Baseline
                          </span>
                        ) : row.beatsNaive ? (
                          <span className="text-[10px] px-2 py-0.5 rounded font-mono font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                            Beats Naive
                          </span>
                        ) : (
                          <span className="text-[10px] px-2 py-0.5 rounded font-mono text-slate-500 dark:text-slate-400">
                            Within Baseline
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ================================================================
          6. STATISTICAL INFERENCE & METHODOLOGICAL RIGOR
      ================================================================ */}
      <section className="space-y-6" aria-labelledby="statistical-heading">
        <div className="space-y-1">
          <span className="text-xs font-bold uppercase tracking-wider text-brand-500 dark:text-brand-400">
            Statistical Validation & Significance Tests
          </span>
          <h2 id="statistical-heading" className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            Model Comparison & Scientific Governance
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 max-w-3xl leading-relaxed">
            Rigorous econometric and non-parametric hypothesis tests ensure conclusions reflect genuine predictive capabilities rather than random financial noise.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Card 1: Benchmark-First Diebold-Mariano Tests */}
          <div className="p-6 rounded-2xl bg-white dark:bg-charcoal-900 border border-slate-200 dark:border-charcoal-800 shadow-sm space-y-4">
            <div className="flex items-center gap-2.5">
              <ModernSquircleBadge icon="scale" color="emerald" size="md" />
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-base">
                  Benchmark-First Diebold–Mariano Tests
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Pairwise squared-error loss comparison against Naive persistence with Holm correction
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Evaluating whether model accuracy genuinely exceeds the Naive baseline requires pairwise Diebold–Mariano testing. Across the 15 companies, exactly <strong className="text-slate-900 dark:text-white">{data.conclusion.significantVsNaive.length} equities</strong> achieved statistically significant outperformance over Naive holdouts after Holm adjustment:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {data.conclusion.significantVsNaive.map((item) => (
                <div
                  key={`${item.symbol}-${item.model}`}
                  className="p-3.5 rounded-xl bg-slate-50 dark:bg-charcoal-950/80 border border-slate-200 dark:border-charcoal-800 space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-sm text-slate-900 dark:text-white">
                      {item.symbol}
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 font-medium">
                      p = {item.adjustedPValue.toFixed(4)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    {MODEL_CONFIG[item.model]?.label ?? item.model} significantly reduced squared errors over Naive persistence (Holm-adjusted p = {item.adjustedPValue.toFixed(4)}).
                  </p>
                </div>
              ))}
            </div>

            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed pt-1 border-t border-slate-200 dark:border-charcoal-800">
              * Note: A descriptive MASE below 1.0 indicates lower average absolute error than naive persistence on holdout data, but does not alone establish statistical significance beyond random market variance.
            </p>
          </div>

          {/* Card 2: Across-Company Friedman & Post-Hoc Tests */}
          <div className="p-6 rounded-2xl bg-white dark:bg-charcoal-900 border border-slate-200 dark:border-charcoal-800 shadow-sm space-y-4">
            <div className="flex items-center gap-2.5">
              <ModernSquircleBadge icon="microscope" color="purple" size="md" />
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-base">
                  Across-Company Non-Parametric Inference
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Omnibus rank variation and pairwise post-hoc Wilcoxon test results
                </p>
              </div>
            </div>

            <dl className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between py-1.5 border-b border-slate-200 dark:border-charcoal-800">
                <dt className="text-slate-600 dark:text-slate-400">Friedman MASE Rank Statistic:</dt>
                <dd className="font-mono font-bold text-slate-900 dark:text-white">
                  {formatNum(data.acrossCompany.friedmanMase.statistic, 4)}
                </dd>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-slate-200 dark:border-charcoal-800">
                <dt className="text-slate-600 dark:text-slate-400">Permutation p-value:</dt>
                <dd className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                  p = {formatNum(data.acrossCompany.friedmanMase.permutation_p_value, 4)} (Significant)
                </dd>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-slate-200 dark:border-charcoal-800">
                <dt className="text-slate-600 dark:text-slate-400">Wilcoxon Post-Hoc Pairs (Holm Adjusted):</dt>
                <dd className="font-mono text-slate-500 dark:text-slate-400">
                  No pairs survived Holm correction
                </dd>
              </div>
            </dl>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              While the omnibus Friedman test confirms that ranking differences across methods are non-random across the PSE universe, pairwise Wilcoxon signed-rank tests with Holm correction yielded no pair-wise significance. Therefore, <strong className="text-slate-900 dark:text-white">no single architecture demonstrated statistically proven cross-market dominance</strong>.
            </p>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-charcoal-950/80 border border-slate-200 dark:border-charcoal-800 text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
              <strong className="text-slate-900 dark:text-white block">Consistency Threshold:</strong>
              Lag-Informed Regression and ARIMA each obtained the lowest principal RMSE on 7 companies; LSTM did so on 1. Neither architecture achieved the pre-specified 8-of-15 consistency threshold required to establish market-wide dominance.
            </div>
          </div>
        </div>

        {/* Methodology Controls Card */}
        <div className="p-6 rounded-2xl bg-white dark:bg-charcoal-900 border border-slate-200 dark:border-charcoal-800 shadow-sm space-y-3">
          <div className="flex items-center gap-2">
            <ModernIcon name="cog" className="w-5 h-5 text-cyan-600 dark:text-neon-400" />
            <h3 className="font-bold text-slate-900 dark:text-white text-base">
              Methodology & Holdout Controls Summary
            </h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs pt-1">
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-charcoal-950/80 border border-slate-200 dark:border-charcoal-800 space-y-1">
              <span className="font-bold text-slate-900 dark:text-white block">Chronological Split</span>
              <p className="text-slate-600 dark:text-slate-400">
                85% development ({formatDate(data.data.firstDate)} to {formatDate(data.data.cutoffDate)}) and 15% holdout ({formatDate(data.data.holdoutStart)} to {formatDate(data.data.holdoutEnd)}) with zero lookahead bias.
              </p>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-charcoal-950/80 border border-slate-200 dark:border-charcoal-800 space-y-1">
              <span className="font-bold text-slate-900 dark:text-white block">LASSO Regularization</span>
              <p className="text-slate-600 dark:text-slate-400">
                {data.methodology.lassoAlphaCandidates} alpha candidates evaluated per company using Partial Autocorrelation Functions to filter uninformative price and volume lags.
              </p>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-charcoal-950/80 border border-slate-200 dark:border-charcoal-800 space-y-1">
              <span className="font-bold text-slate-900 dark:text-white block">LSTM Multi-Seed Tuning</span>
              <p className="text-slate-600 dark:text-slate-400">
                {data.methodology.lstmConfigurations} configurations evaluated across {data.methodology.lstmFolds} folds and {data.methodology.lstmTuningSeeds.length} seeds ({data.methodology.lstmTuningSeeds.join(", ")}) to ensure convergence stability.
              </p>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-charcoal-950/80 border border-slate-200 dark:border-charcoal-800 space-y-1">
              <span className="font-bold text-slate-900 dark:text-white block">Harmonized Benchmarks</span>
              <p className="text-slate-600 dark:text-slate-400">
                Strictly identical target dates ({data.data.rowsPerCompany.toLocaleString()} observations per company) and a uniform MASE denominator per equity.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
