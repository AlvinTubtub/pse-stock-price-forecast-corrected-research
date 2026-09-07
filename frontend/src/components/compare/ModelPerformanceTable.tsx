"use client";

import React from "react";
import Link from "next/link";
import CompanyLogo from "@/components/CompanyLogo";
import type { FormalModelId } from "@/lib/types";
import type { DashboardCompany, MetricKey } from "./modelPerformanceTypes";
import { MODELS, MODEL_CONFIG, METRIC_CONFIG } from "./modelPerformanceConfig";

interface ModelPerformanceTableProps {
  companies: DashboardCompany[];
  selectedMetric: MetricKey;
  visibleModels: Record<FormalModelId, boolean>;
}

export default function ModelPerformanceTable({
  companies,
  selectedMetric,
  visibleModels,
}: ModelPerformanceTableProps) {
  const metricMeta = METRIC_CONFIG[selectedMetric];

  return (
    <div className="p-6 rounded-2xl bg-white dark:bg-charcoal-900 border border-slate-200 dark:border-charcoal-800 shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h3 className="font-bold text-slate-900 dark:text-white text-base">
            Formal Holdout Results Table ({metricMeta.shortName})
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Comprehensive numerical evaluation across all {companies.length} filtered companies.
          </p>
        </div>
        <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
          Best scores highlighted in emerald
        </span>
      </div>

      <div className="overflow-x-auto -mx-6 px-6">
        <table className="w-full text-left text-xs border-collapse min-w-[700px]">
          <thead>
            <tr className="border-b border-slate-200 dark:border-charcoal-800 font-mono uppercase text-[11px] text-slate-500 dark:text-slate-400">
              <th scope="col" className="py-3 px-3">
                Company
              </th>
              <th scope="col" className="py-3 px-3">
                Sector
              </th>
              {MODELS.map((m) => {
                if (!visibleModels[m]) return null;
                const cfg = MODEL_CONFIG[m];
                return (
                  <th key={m} scope="col" className="py-3 px-3 text-right">
                    <span className="inline-flex items-center gap-1.5 justify-end">
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: cfg.color }}
                      />
                      {cfg.shortLabel}
                    </span>
                  </th>
                );
              })}
              <th scope="col" className="py-3 px-3 text-right">
                Holdout Winner
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-charcoal-800/60 font-mono">
            {companies.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="py-8 text-center text-slate-500 dark:text-slate-400"
                >
                  No companies found matching current filters.
                </td>
              </tr>
            ) : (
              companies.map((company) => {
                // Determine winning model in row among visible models
                let bestVal =
                  metricMeta.direction === "lower" ? Infinity : -Infinity;
                let bestModelKey: FormalModelId | null = null;

                for (const m of MODELS) {
                  if (!visibleModels[m]) continue;
                  const val = company.metrics[m]?.[selectedMetric];
                  if (val != null && Number.isFinite(val)) {
                    if (metricMeta.direction === "lower") {
                      if (val < bestVal) {
                        bestVal = val;
                        bestModelKey = m;
                      }
                    } else {
                      if (val > bestVal) {
                        bestVal = val;
                        bestModelKey = m;
                      }
                    }
                  }
                }

                return (
                  <tr
                    key={company.symbol}
                    className="hover:bg-slate-50 dark:hover:bg-charcoal-850/50 transition-colors"
                  >
                    <td className="py-2.5 px-3">
                      <Link
                        href={`/companies/${company.symbol}`}
                        className="inline-flex items-center gap-2 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-400 rounded"
                      >
                        <CompanyLogo symbol={company.symbol} size="sm" />
                        <div>
                          <span className="font-bold text-slate-900 dark:text-white group-hover:text-cyan-600 dark:group-hover:text-neon-400 transition-colors">
                            {company.symbol}
                          </span>
                          <span className="block text-[11px] text-slate-500 dark:text-slate-400 font-sans truncate max-w-[140px]">
                            {company.name}
                          </span>
                        </div>
                      </Link>
                    </td>

                    <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400 font-sans text-xs">
                      {company.sector}
                    </td>

                    {MODELS.map((m) => {
                      if (!visibleModels[m]) return null;
                      const val = company.metrics[m]?.[selectedMetric];
                      const isBest = bestModelKey === m;

                      return (
                        <td key={m} className="py-2.5 px-3 text-right">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-xs ${
                              isBest
                                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-bold border border-emerald-500/30"
                                : "text-slate-700 dark:text-slate-300"
                            }`}
                          >
                            {metricMeta.formatValue(val)}
                            {isBest && (
                              <span className="sr-only"> (Best score)</span>
                            )}
                          </span>
                        </td>
                      );
                    })}

                    <td className="py-2.5 px-3 text-right">
                      {bestModelKey ? (
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium border ${MODEL_CONFIG[bestModelKey].bgBadge} ${MODEL_CONFIG[bestModelKey].borderBadge} ${MODEL_CONFIG[bestModelKey].textBadge}`}
                        >
                          {MODEL_CONFIG[bestModelKey].shortLabel}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="pt-2 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed border-t border-slate-100 dark:border-charcoal-800">
        <p>
          * Values reflect formal holdout evaluation on 243 identical target dates per company. For MASE, values &lt; 1.0 have lower MAE than the Naive persistence benchmark; statistical superiority requires formal hypothesis testing.
        </p>
      </div>
    </div>
  );
}
