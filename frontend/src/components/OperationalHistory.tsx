"use client";
import PredictionChart from "@/components/charts/PredictionChart";
import ErrorChart from "@/components/charts/ErrorChart";
import type { OperationalForecast } from "@/lib/types";

export default function OperationalHistory({ history }: { history: OperationalForecast[] }) {
  const realized = history.filter((row) => row.actual !== null && row.coverage === "post_promotion_prospective");
  const symbols = Array.from(new Set(realized.map((row) => row.symbol))).sort();
  return (
    <section className="space-y-6">
      <div className="glass-card p-5 rounded-xl shadow-card-glow">
        <h2 className="text-xl font-bold text-white mb-1">Post-promotion prospective errors</h2>
        <p className="text-xs sm:text-sm text-slate-300">
          <span className="text-neon-400 font-mono font-bold">{realized.length}</span> realized forecasts from <span className="font-mono text-slate-200">{history.length}</span> issued forecasts. Errors use predicted close minus actual close.
          No synthetic backtest, missing-session interpolation, or pre-promotion results are included.
        </p>
        {realized.length === 0 ? (
          <p className="text-xs text-slate-400 mt-2 italic">Coverage starts only after a forecast is issued before its target session and the official close becomes available.</p>
        ) : null}
      </div>
      {symbols.map((symbol) => {
        const rows = realized.filter((row) => row.symbol === symbol).sort((a, b) => a.forecastFor.localeCompare(b.forecastFor)).slice(-60);
        const dates = rows.map((row) => row.forecastFor);
        const actual = rows.map((row) => row.actual as number);
        const byModel = { [rows[0].model]: rows.map((row) => row.predictedClose) };
        return (
          <div key={symbol} className="glass-card p-6 rounded-xl shadow-card-glow space-y-4">
            <h3 className="text-base font-bold text-white font-mono flex items-center gap-2">
              <span className="text-neon-400">{symbol}</span>
              <span className="text-slate-500">·</span>
              <span className="text-xs text-slate-400 font-normal">{rows.length} realized sessions</span>
            </h3>
            <PredictionChart dates={dates} actual={actual} byModel={byModel} selectedModel={rows[0].model} liveStartDate={dates[0]} />
            <ErrorChart dates={dates} actual={actual} byModel={byModel} selectedModel={rows[0].model} liveStartDate={dates[0]} />
          </div>
        );
      })}
    </section>
  );
}
