"use client";

import React from "react";
import ModernIcon from "@/components/ModernIcon";
import { formatDate } from "@/lib/format";
import type { ModelPerformanceData } from "./modelPerformanceTypes";
import { MODEL_CONFIG } from "./modelPerformanceConfig";

interface ModelPerformanceMethodologyProps {
  data: ModelPerformanceData;
}

export default function ModelPerformanceMethodology({
  data,
}: ModelPerformanceMethodologyProps) {
  return (
    <section className="space-y-6 pt-4">
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">
          Formal Statistical Testing &amp; Methodology
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
          Rigorous hypothesis testing results evaluating cross-market dominance, pairwise significance, and holdout protocols.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Card 1: Pairwise Diebold-Mariano Tests vs Naive */}
        <div className="p-6 rounded-2xl bg-white dark:bg-charcoal-900 border border-slate-200 dark:border-charcoal-800 shadow-sm space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
              <ModernIcon name="target" className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base">
                Diebold–Mariano Tests vs. Naive
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Pairwise squared-error loss differential (Holm-Bonferroni adjusted)
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
            * Note: Lower is better. A value below 1.0 indicates lower average absolute error than the Naive persistence benchmark; it does not by itself establish statistical significance beyond random market variance.
          </p>
        </div>

        {/* Card 2: Across-Company Friedman & Post-Hoc Tests */}
        <div className="p-6 rounded-2xl bg-white dark:bg-charcoal-900 border border-slate-200 dark:border-charcoal-800 shadow-sm space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/10 dark:bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-600 dark:text-neon-400 shrink-0">
              <ModernIcon name="barChart" className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base">
                Cross-Market Friedman &amp; Post-Hoc Analysis
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Non-parametric repeated-measures rank tests across all 15 equities
              </p>
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-3 text-xs font-mono">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-charcoal-950/80 border border-slate-200 dark:border-charcoal-800">
              <dt className="text-slate-600 dark:text-slate-400">Friedman MASE Rank Statistic:</dt>
              <dd className="text-base font-bold text-slate-900 dark:text-white mt-1">
                {data.acrossCompany.friedmanMase.statistic.toFixed(4)}
              </dd>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-charcoal-950/80 border border-slate-200 dark:border-charcoal-800">
              <dt className="text-slate-600 dark:text-slate-400">Permutation p-value:</dt>
              <dd className="text-base font-bold text-slate-900 dark:text-white mt-1">
                p = {data.acrossCompany.friedmanMase.permutation_p_value.toFixed(4)}
              </dd>
            </div>
          </dl>

          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            The omnibus Friedman permutation test yielded p = {data.acrossCompany.friedmanMase.permutation_p_value.toFixed(4)}, and pairwise Wilcoxon signed-rank post-hoc comparisons with Holm adjustment yielded no statistically significant pairs. Therefore, <strong className="text-slate-900 dark:text-white">no single architecture demonstrated statistically proven cross-market dominance</strong>.
          </p>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-charcoal-950/80 border border-slate-200 dark:border-charcoal-800 text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
            <strong className="text-slate-900 dark:text-white block">Consistency Threshold:</strong>
            Lag-Informed Regression and ARIMA each obtained the lowest principal RMSE on 7 companies; LSTM did so on 1. Neither architecture achieved the pre-specified 8-of-15 consistency threshold required to establish market-wide dominance.
          </div>
        </div>
      </div>

      {/* Methodology Controls Card with Corrected Finding 1 & Finding 2 Descriptions */}
      <div className="p-6 rounded-2xl bg-white dark:bg-charcoal-900 border border-slate-200 dark:border-charcoal-800 shadow-sm space-y-3">
        <div className="flex items-center gap-2">
          <ModernIcon name="cog" className="w-5 h-5 text-cyan-600 dark:text-neon-400" />
          <h3 className="font-bold text-slate-900 dark:text-white text-base">
            Methodology &amp; Holdout Controls Summary
          </h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs pt-1">
          {/* Finding 1: Chronological Split */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-charcoal-950/80 border border-slate-200 dark:border-charcoal-800 space-y-1">
            <span className="font-bold text-slate-900 dark:text-white block">
              Chronological Split
            </span>
            <p className="text-slate-600 dark:text-slate-400">
              The chronological split used {data.data.developmentPairsPerCompany.toLocaleString()} development forecast pairs and {data.data.holdoutPairsPerCompany.toLocaleString()} holdout forecast pairs per company. The formal holdout covers {formatDate(data.data.holdoutStart)} through {formatDate(data.data.holdoutEnd)}.
            </p>
          </div>

          {/* LASSO Regularization */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-charcoal-950/80 border border-slate-200 dark:border-charcoal-800 space-y-1">
            <span className="font-bold text-slate-900 dark:text-white block">
              LASSO Regularization
            </span>
            <p className="text-slate-600 dark:text-slate-400">
              {data.methodology.lassoAlphaCandidates} alpha candidates evaluated per company using Partial Autocorrelation Functions to filter uninformative price and volume lags.
            </p>
          </div>

          {/* LSTM Multi-Seed Tuning */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-charcoal-950/80 border border-slate-200 dark:border-charcoal-800 space-y-1">
            <span className="font-bold text-slate-900 dark:text-white block">
              LSTM Multi-Seed Tuning
            </span>
            <p className="text-slate-600 dark:text-slate-400">
              {data.methodology.lstmConfigurations} configurations evaluated across {data.methodology.lstmFolds} folds and {data.methodology.lstmTuningSeeds.length} seeds ({data.methodology.lstmTuningSeeds.join(", ")}) to ensure convergence stability.
            </p>
          </div>

          {/* Finding 2: Harmonized Benchmarks */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-charcoal-950/80 border border-slate-200 dark:border-charcoal-800 space-y-1">
            <span className="font-bold text-slate-900 dark:text-white block">
              Harmonized Benchmarks
            </span>
            <p className="text-slate-600 dark:text-slate-400">
              All four methods were evaluated on the same {data.data.holdoutPairsPerCompany.toLocaleString()} formal holdout target dates per company using a uniform MASE denominator.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
