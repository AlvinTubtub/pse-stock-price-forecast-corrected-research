"use client";

import React from "react";
import ModernIcon from "@/components/ModernIcon";
import type { FormalModelId } from "@/lib/types";
import type { MetricKey, SummaryData } from "./modelPerformanceTypes";
import { MODELS, MODEL_CONFIG, METRIC_CONFIG } from "./modelPerformanceConfig";

interface ModelPerformanceSummaryProps {
  selectedMetric: MetricKey;
  summary: SummaryData;
  visibleModels: Record<FormalModelId, boolean>;
  filteredCompanyCount: number;
}

export default function ModelPerformanceSummary({
  selectedMetric,
  summary,
  visibleModels,
  filteredCompanyCount,
}: ModelPerformanceSummaryProps) {
  const meta = METRIC_CONFIG[selectedMetric];

  return (
    <div className="space-y-4">
      {/* Metric Guide Banner with Finding 3 & Finding 4 Wording */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 p-4 rounded-2xl bg-white dark:bg-charcoal-900 border border-slate-200 dark:border-charcoal-800 text-xs shadow-sm">
        <div className="flex items-start gap-2">
          <ModernIcon
            name="barChart"
            className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5"
          />
          <div>
            <strong className="text-slate-900 dark:text-white block font-mono">
              RMSE &amp; MAE (₱)
            </strong>
            <span className="text-slate-600 dark:text-slate-400">
              Lower is better. Measures average error magnitude against actual closing prices.
            </span>
          </div>
        </div>

        <div className="flex items-start gap-2">
          <ModernIcon
            name="target"
            className="w-4 h-4 text-cyan-600 dark:text-neon-400 shrink-0 mt-0.5"
          />
          <div>
            <strong className="text-slate-900 dark:text-white block font-mono">
              MASE
            </strong>
            <span className="text-slate-600 dark:text-slate-400">
              Lower is better. A value below 1.0 indicates lower holdout MAE than the in-sample Naive scaling error; it does not by itself establish statistical significance over holdout Naive forecasts.
            </span>
          </div>
        </div>

        <div className="flex items-start gap-2">
          <ModernIcon
            name="lineChart"
            className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0 mt-0.5"
          />
          <div>
            <strong className="text-slate-900 dark:text-white block font-mono">
              R² Score
            </strong>
            <span className="text-slate-600 dark:text-slate-400">
              Higher is better (≤ 1.0). Explains holdout price variance; not a confidence score or win probability.
            </span>
          </div>
        </div>

        <div className="flex items-start gap-2">
          <ModernIcon
            name="shieldCheck"
            className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5"
          />
          <div>
            <strong className="text-slate-900 dark:text-white block font-mono">
              Statistical Honesty
            </strong>
            <span className="text-slate-600 dark:text-slate-400">
              Win counts are descriptive; statistical superiority requires formal hypothesis tests.
            </span>
          </div>
        </div>
      </div>

      {/* Dynamic Summary Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Top Performing Model */}
        <div className="p-4 rounded-2xl bg-white dark:bg-charcoal-900 border border-slate-200 dark:border-charcoal-800 shadow-sm space-y-2">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
            Plurality Best Model ({meta.shortName})
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold font-mono text-slate-900 dark:text-white">
              {summary.winnerModel
                ? MODEL_CONFIG[summary.winnerModel].shortLabel
                : "No models enabled"}
            </span>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            {summary.winnerModel
              ? `Achieved the best holdout score on ${
                  summary.wins[summary.winnerModel]
                } of ${summary.totalEvaluated} filtered companies.`
              : "Enable at least one model series to view performance."}
          </p>
        </div>

        {/* Card 2: Holdout Wins Breakdown */}
        <div className="p-4 rounded-2xl bg-white dark:bg-charcoal-900 border border-slate-200 dark:border-charcoal-800 shadow-sm space-y-2">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
            Holdout Wins ({meta.shortName})
          </span>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {MODELS.map((m) => {
              if (!visibleModels[m]) return null;
              const cfg = MODEL_CONFIG[m];
              const count = summary.wins[m] || 0;
              return (
                <div
                  key={m}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono border ${cfg.bgBadge} ${cfg.borderBadge} ${cfg.textBadge}`}
                >
                  <span className="font-semibold">{cfg.shortLabel}:</span>
                  <span className="font-bold">{count}</span>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Based on {filteredCompanyCount} filtered equities.
          </p>
        </div>

        {/* Card 3: Descriptive Benchmark Comparison */}
        <div className="p-4 rounded-2xl bg-white dark:bg-charcoal-900 border border-slate-200 dark:border-charcoal-800 shadow-sm space-y-2">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
            {selectedMetric === "mase"
              ? "Lower MAE than In-sample Scale"
              : `Lower Holdout ${meta.shortName} Than Naive`}
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-cyan-600 dark:text-neon-400">
              {summary.beatsNaiveCount}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              evaluations
            </span>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            {selectedMetric === "mase"
              ? "Evaluations with MASE < 1.0 (lower MAE than in-sample scaling error)."
              : `Evaluations with descriptively lower holdout ${meta.shortName} than Naive.`}
          </p>
        </div>

        {/* Card 4: Filtered Medians (Metric-Aware Finding 4) */}
        <div className="p-4 rounded-2xl bg-white dark:bg-charcoal-900 border border-slate-200 dark:border-charcoal-800 shadow-sm space-y-2">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
            Filtered Medians ({meta.shortName})
          </span>
          <div className="grid grid-cols-2 gap-1.5 pt-0.5">
            {MODELS.map((m) => {
              if (!visibleModels[m]) return null;
              const med = summary.medians[m];
              const cfg = MODEL_CONFIG[m];
              return (
                <div key={m} className="text-xs font-mono">
                  <span className="text-slate-500 dark:text-slate-400 text-[11px] block">
                    {cfg.shortLabel}
                  </span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {meta.formatValue(med)}
                  </span>
                </div>
              );
            })}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
            {meta.medianExplanation}
          </p>
        </div>
      </div>
    </div>
  );
}
