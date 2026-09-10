"use client";

import React, { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
  ReferenceLine,
} from "recharts";

const MODEL_COLORS: Record<string, string> = {
  ARIMA: "#ffb800",
  "Lag-Informed Regression": "#00f0ff",
  LSTM: "#a855f7",
  "Naive baseline": "#64748b",
  "Naive Baseline": "#64748b",
};

function formatShortDate(dateStr: string): string {
  if (!dateStr) return "";
  try {
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      const [y, m, d] = dateStr.split("-").map(Number);
      const dt = new Date(y, m - 1, d);
      return dt.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    }
    const dt = new Date(dateStr);
    return dt.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return dateStr;
  }
}

function formatFullDate(dateStr: string): string {
  if (!dateStr) return "";
  try {
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      const [y, m, d] = dateStr.split("-").map(Number);
      const dt = new Date(y, m - 1, d);
      return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    }
    const dt = new Date(dateStr);
    return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return dateStr;
  }
}

export interface ErrorChartProps {
  dates?: string[];
  actual: number[];
  byModel: Record<string, Array<number | null>>;
  selectedModel?: string;
  legacyStartDate?: string;
  legacyEndDate?: string;
  liveStartDate?: string;
}

export default function ErrorChart({ dates, actual, byModel, selectedModel, legacyStartDate, legacyEndDate, liveStartDate }: ErrorChartProps) {
  const data = useMemo(() => {
    return actual.map((value, i) => {
      const rawDate = dates?.[i] || `Day ${i + 1}`;
      const row: Record<string, any> = {
        step: rawDate,
        displayDate: dates?.[i] ? formatShortDate(rawDate) : `Day ${i + 1}`,
        fullDate: dates?.[i] ? formatFullDate(rawDate) : `Day ${i + 1}`,
      };
      for (const [model, series] of Object.entries(byModel)) {
        if (typeof series[i] === "number" && Number.isFinite(series[i])) {
          // Forecast Error = Predicted Price - Actual Price
          row[model] = Number(((series[i] as number) - value).toFixed(4));
        }
      }
      return row;
    });
  }, [actual, dates, byModel]);

  // Compute zero-centered symmetric Y-axis range
  const yLimit = useMemo(() => {
    const allErrors: number[] = [];
    for (const row of data) {
      for (const key of Object.keys(byModel)) {
        const val = row[key];
        if (typeof val === "number" && !isNaN(val)) {
          allErrors.push(val);
        }
      }
    }
    if (allErrors.length === 0) return 1;
    const maxAbs = Math.max(...allErrors.map(Math.abs));
    // Add 15% padding so peaks are not pressed against boundary
    return Math.max(0.05, Number((maxAbs * 1.15).toFixed(2)));
  }, [data, byModel]);

  const seriesNames = Object.keys(byModel);

  if (data.length === 0) {
    return (
      <div className="flex h-[360px] items-center justify-center rounded-lg border border-dashed border-slate-200 dark:border-charcoal-700 bg-slate-50 dark:bg-charcoal-950/40 px-6 text-center">
        <div className="max-w-md space-y-2">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">No realized production forecast errors yet</p>
          <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            Errors appear only after ForecastPH&apos;s previously issued prediction can be matched to the
            actual close for that trading session.
          </p>
        </div>
      </div>
    );
  }

  const renderTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;
    const point = payload[0]?.payload;
    const headerDate = point?.fullDate || point?.displayDate || point?.step;

    return (
      <div className="bg-charcoal-900/95 border border-charcoal-700/80 rounded-xl p-3 shadow-card-glow text-xs space-y-1.5 min-w-[230px] backdrop-blur-md">
        <p className="font-semibold text-white font-mono border-b border-charcoal-700 pb-1.5 mb-1.5">
          {headerDate}
        </p>
        {payload.map((entry: any) => {
          const isSelected = selectedModel && entry.dataKey === selectedModel;
          const isNaive =
            entry.dataKey === "Naive baseline" || entry.dataKey === "Naive Baseline";
          const label = isNaive ? "Naive Baseline" : entry.dataKey;
          const val = Number(entry.value);
          const sign = val > 0 ? "+" : val < 0 ? "-" : "";
          const absVal = Math.abs(val);

          return (
            <div key={entry.dataKey} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-1.5">
                <span
                  className="w-2.5 h-2.5 rounded-full inline-block shrink-0"
                  style={{ backgroundColor: entry.color }}
                />
                <span
                  className={`font-medium ${
                    isSelected ? "text-neon-400 font-semibold" : "text-slate-300"
                  }`}
                >
                  {label}
                  {isSelected && (
                    <span className="ml-1 text-[10px] text-neon-400 uppercase font-semibold">
                      (Selected)
                    </span>
                  )}
                </span>
              </div>
              <span
                className={`font-mono font-semibold ${
                  val > 0 ? "text-accent-amber" : val < 0 ? "text-neon-400" : "text-slate-300"
                }`}
              >
                {sign}₱
                {absVal.toLocaleString("en-PH", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="w-full select-none space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
        <span className="text-slate-400">
          Showing {data.length} trading sessions &middot; Positive =
          Overprediction, Negative = Underprediction
        </span>
        <span className="flex flex-wrap items-center gap-2">
          {legacyStartDate && legacyEndDate && (
            <span className="inline-flex items-center gap-1.5 rounded-md border border-accent-amber/40 bg-accent-amber/10 px-2 py-1 font-semibold text-accent-amber font-mono text-[11px]">
              <span className="h-3 border-l-2 border-dashed border-accent-amber" aria-hidden="true" />
              Legacy issued {formatShortDate(legacyStartDate)}–{formatShortDate(legacyEndDate)}
            </span>
          )}
          {liveStartDate && (
            <span className="inline-flex items-center gap-1.5 rounded-md border border-neon-400/40 bg-neon-400/10 px-2 py-1 font-semibold text-neon-300 font-mono text-[11px]">
              <span className="h-3 border-l-2 border-dashed border-neon-400" aria-hidden="true" />
              Controlled operational begins {formatShortDate(liveStartDate)}
            </span>
          )}
        </span>
      </div>

      <div className="w-full">
        <ResponsiveContainer width="100%" height={360}>
          <LineChart
            data={data}
            margin={{ top: 10, right: 15, left: 10, bottom: 5 }}
          >
            <CartesianGrid stroke="#22252e" strokeDasharray="3 3" vertical={false} />
            {legacyStartDate && (
              <ReferenceLine
                x={legacyStartDate}
                stroke="#ffb800"
                strokeWidth={2}
                strokeDasharray="4 4"
              />
            )}
            {liveStartDate && (
              <ReferenceLine
                x={liveStartDate}
                stroke="#2dd4bf"
                strokeWidth={2.5}
                strokeDasharray="7 4"
              />
            )}
            <XAxis
              dataKey="step"
              tick={{ fill: "#94a3b8", fontSize: 11 }}
              tickFormatter={(val) => {
                const item = data.find((d) => d.step === val);
                return item ? item.displayDate : val;
              }}
              minTickGap={35}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fill: "#94a3b8", fontSize: 11 }}
              domain={[-yLimit, yLimit]}
              tickFormatter={(val) => `${val > 0 ? "+" : ""}₱${Number(val).toFixed(2)}`}
              label={{
                value: "Forecast Error (₱)",
                angle: -90,
                position: "insideLeft",
                fill: "#64748b",
                fontSize: 11,
              }}
            />

            {/* Zero Reference Line (0 = Perfect Prediction) */}
            <ReferenceLine
              y={0}
              stroke="#94a3b8"
              strokeDasharray="3 3"
              strokeWidth={1.5}
              label={{
                value: "0 (Exact)",
                position: "right",
                fill: "#94a3b8",
                fontSize: 10,
              }}
            />

            <Tooltip content={renderTooltip} />
            <Legend
              wrapperStyle={{ fontSize: 12, paddingTop: 10 }}
              formatter={(value) => {
                const isSelected = selectedModel && value === selectedModel;
                const isNaive = value === "Naive baseline" || value === "Naive Baseline";
                const displayLabel = isNaive ? "Naive Baseline" : value;
                return (
                  <span className={isSelected ? "font-bold text-white" : "text-slate-300"}>
                    {displayLabel}
                    {isSelected && " (Selected)"}
                  </span>
                );
              }}
            />

            {seriesNames.map((name) => {
              const isSelected = selectedModel && name === selectedModel;
              const isNaive = name === "Naive baseline" || name === "Naive Baseline";

              return (
                <Line
                  key={name}
                  type="monotone"
                  dataKey={name}
                  stroke={MODEL_COLORS[name] ?? "#94a3b8"}
                  strokeWidth={isSelected ? 2.5 : 1.5}
                  strokeDasharray={isNaive ? "4 4" : undefined}
                  dot={data.length === 1 ? { r: 4 } : false}
                  activeDot={{ r: 4 }}
                />
              );
            })}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="pt-2 text-xs text-slate-500 dark:text-slate-400 leading-relaxed border-t border-slate-200 dark:border-charcoal-800">
        <p>
          <strong className="text-slate-700 dark:text-slate-300 font-medium">Interpretation: </strong>
          Forecast error = predicted price − actual price. Positive values indicate overprediction;
          negative values indicate underprediction. A value of ₱0.00 represents a perfect prediction.
        </p>
      </div>
    </div>
  );
}
