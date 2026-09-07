"use client";

import React, { useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  TooltipProps,
} from "recharts";
import type { FormalModelId } from "@/lib/types";
import type { ChartDataPoint, MetricKey } from "./modelPerformanceTypes";
import { MODELS, MODEL_CONFIG, METRIC_CONFIG } from "./modelPerformanceConfig";

interface ModelPerformanceChartProps {
  chartData: ChartDataPoint[];
  selectedMetric: MetricKey;
  visibleModels: Record<FormalModelId, boolean>;
  prefersReducedMotion: boolean;
}

// Custom Pointer Tooltip
function CustomChartTooltip({
  active,
  payload,
  label,
  selectedMetric,
}: TooltipProps<number, string> & { selectedMetric: MetricKey }) {
  if (!active || !payload || payload.length === 0) return null;

  const dataPoint = payload[0]?.payload as ChartDataPoint | undefined;
  const metricMeta = METRIC_CONFIG[selectedMetric];

  return (
    <div className="p-3.5 rounded-xl bg-slate-900/95 dark:bg-charcoal-900/95 border border-slate-700/80 dark:border-charcoal-700 backdrop-blur-md shadow-2xl text-xs max-w-xs space-y-2 z-50">
      <div className="border-b border-slate-700/60 pb-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono font-bold text-sm text-white">{label}</span>
          <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
            {dataPoint?.sector || "PSE"}
          </span>
        </div>
        <p className="text-[11px] text-slate-400 truncate mt-0.5">
          {dataPoint?.name}
        </p>
      </div>

      <div className="space-y-1">
        {payload.map((entry) => {
          const modelKey = entry.dataKey as FormalModelId;
          const cfg = MODEL_CONFIG[modelKey];
          const val = entry.value as number | undefined;
          const isWinner = dataPoint?.bestModel === modelKey;

          return (
            <div
              key={modelKey}
              className={`flex items-center justify-between py-1 px-1.5 rounded ${
                isWinner ? "bg-emerald-500/10 border border-emerald-500/20" : ""
              }`}
            >
              <div className="flex items-center gap-1.5">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: cfg?.color || entry.color }}
                />
                <span className="text-slate-300 font-mono text-[11px]">
                  {cfg?.shortLabel || modelKey}
                </span>
                {isWinner && (
                  <span className="text-[9px] uppercase tracking-wider px-1 rounded bg-emerald-500/20 text-emerald-400 font-bold">
                    Best
                  </span>
                )}
              </div>
              <span className="font-mono font-bold text-white text-[11px]">
                {metricMeta.formatValue(val)}
              </span>
            </div>
          );
        })}
      </div>

      <p className="text-[10px] text-slate-400 border-t border-slate-700/60 pt-1.5 leading-relaxed italic">
        {metricMeta.interpretation}
      </p>
    </div>
  );
}

export default function ModelPerformanceChart({
  chartData,
  selectedMetric,
  visibleModels,
  prefersReducedMotion,
}: ModelPerformanceChartProps) {
  const metricMeta = METRIC_CONFIG[selectedMetric];
  const [selectedKeyboardIndex, setSelectedKeyboardIndex] = useState<number>(0);

  // Safely clamped active company for keyboard inspection
  const activePoint =
    chartData.length > 0
      ? chartData[Math.min(selectedKeyboardIndex, chartData.length - 1)]
      : null;

  return (
    <div className="space-y-4">
      {/* Visual Chart Card */}
      <div className="p-6 rounded-2xl bg-white dark:bg-charcoal-900 border border-slate-200 dark:border-charcoal-800 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white text-base">
              Holdout Comparison: {metricMeta.fullName}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Evaluating {chartData.length} companies across active model architectures.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-charcoal-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-charcoal-700">
              Metric: {metricMeta.shortName} ({metricMeta.betterText})
            </span>
          </div>
        </div>

        {/* Recharts Container with explicit ARIA label */}
        <div
          className="h-[380px] w-full"
          role="img"
          aria-label={`Grouped bar chart comparing ${metricMeta.fullName} across ${chartData.length} companies for Lag-Informed Regression, ARIMA, LSTM, and Naive baselines.`}
        >
          {chartData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-xs text-slate-500 dark:text-slate-400">
              No companies match the current filter selection.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 15, right: 10, left: -10, bottom: 25 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#334155"
                  opacity={0.2}
                />
                <XAxis
                  dataKey="symbol"
                  stroke="#94a3b8"
                  fontSize={11}
                  fontFamily="monospace"
                  tickLine={false}
                  axisLine={{ stroke: "#475569", opacity: 0.3 }}
                />
                <YAxis
                  stroke="#94a3b8"
                  fontSize={11}
                  fontFamily="monospace"
                  tickLine={false}
                  axisLine={{ stroke: "#475569", opacity: 0.3 }}
                  tickFormatter={(val: number) =>
                    selectedMetric === "r2" || selectedMetric === "mase"
                      ? val.toFixed(2)
                      : `₱${val.toFixed(0)}`
                  }
                />
                <Tooltip
                  cursor={{ fill: "rgba(100, 116, 139, 0.1)" }}
                  content={<CustomChartTooltip selectedMetric={selectedMetric} />}
                />
                <Legend
                  verticalAlign="top"
                  align="right"
                  wrapperStyle={{ paddingBottom: "10px", fontSize: "11px" }}
                />

                {MODELS.map((model) => {
                  if (!visibleModels[model]) return null;
                  const cfg = MODEL_CONFIG[model];
                  return (
                    <Bar
                      key={model}
                      dataKey={model}
                      name={cfg.shortLabel}
                      fill={cfg.color}
                      radius={[4, 4, 0, 0]}
                      isAnimationActive={!prefersReducedMotion}
                    />
                  );
                })}
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Accessible Companion Inspector for Keyboard Users & Screen Readers (Finding 7) */}
      {chartData.length > 0 && activePoint && (
        <div
          role="region"
          aria-label="Keyboard accessible chart inspector"
          className="p-4 rounded-2xl bg-white dark:bg-charcoal-900 border border-slate-200 dark:border-charcoal-800 shadow-sm space-y-3"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-charcoal-800 pb-2">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                Keyboard Chart Inspector
              </span>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                Use Tab and Arrow keys to inspect individual company metric values without a pointer mouse.
              </p>
            </div>
            <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
              {selectedKeyboardIndex + 1} of {chartData.length}
            </span>
          </div>

          {/* Company Selector Buttons */}
          <div
            role="tablist"
            aria-label="Select company to inspect"
            className="flex flex-wrap gap-1.5 overflow-x-auto pb-1"
          >
            {chartData.map((pt, idx) => {
              const isSelected = idx === selectedKeyboardIndex;
              return (
                <button
                  key={pt.symbol}
                  role="tab"
                  aria-selected={isSelected}
                  onClick={() => setSelectedKeyboardIndex(idx)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-400 ${
                    isSelected
                      ? "bg-slate-900 dark:bg-white text-white dark:text-charcoal-950 font-bold shadow-xs"
                      : "bg-slate-100 dark:bg-charcoal-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-charcoal-700"
                  }`}
                >
                  {pt.symbol}
                </button>
              );
            })}
          </div>

          {/* Active Company Metric Breakdown */}
          <div
            aria-live="polite"
            className="p-3.5 rounded-xl bg-slate-50 dark:bg-charcoal-950/80 border border-slate-200 dark:border-charcoal-800 space-y-2"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-charcoal-800 pb-2">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-sm text-slate-900 dark:text-white">
                    {activePoint.symbol}
                  </span>
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-slate-200 dark:bg-charcoal-800 text-slate-700 dark:text-slate-300">
                    {activePoint.sector}
                  </span>
                </div>
                <span className="text-xs text-slate-600 dark:text-slate-400">
                  {activePoint.name}
                </span>
              </div>

              {activePoint.bestModel && (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                  <span>Best Model:</span>
                  <span className="font-bold">
                    {MODEL_CONFIG[activePoint.bestModel as FormalModelId]?.shortLabel ||
                      activePoint.bestModel}
                  </span>
                </div>
              )}
            </div>

            {/* Models Value Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
              {MODELS.map((m) => {
                if (!visibleModels[m]) return null;
                const cfg = MODEL_CONFIG[m];
                const val = activePoint[m];
                const isWinner = activePoint.bestModel === m;

                return (
                  <div
                    key={m}
                    className={`p-2.5 rounded-lg border ${
                      isWinner
                        ? "bg-emerald-500/10 dark:bg-emerald-500/15 border-emerald-500/40"
                        : "bg-white dark:bg-charcoal-900 border-slate-200 dark:border-charcoal-800"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: cfg.color }}
                      />
                      <span className="text-[11px] font-mono font-semibold text-slate-700 dark:text-slate-300 truncate">
                        {cfg.shortLabel}
                      </span>
                    </div>
                    <span className="text-sm font-bold font-mono text-slate-900 dark:text-white block">
                      {metricMeta.formatValue(val)}
                    </span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 block mt-0.5">
                      {isWinner ? "Top Performer" : metricMeta.betterText}
                    </span>
                  </div>
                );
              })}
            </div>

            <p className="text-[11px] text-slate-600 dark:text-slate-400 pt-1 italic">
              {metricMeta.interpretation}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
