"use client";
import PredictionChart from "@/components/charts/PredictionChart";
import ErrorChart from "@/components/charts/ErrorChart";
import type { OperationalForecast } from "@/lib/types";

export default function OperationalHistory({ history }: { history: OperationalForecast[] }) {
  const realized = history.filter((row) => row.actual !== null && row.coverage === "post_promotion_prospective");
  const symbols = Array.from(new Set(realized.map((row) => row.symbol))).sort();
  return <section className="space-y-6">
    <h2 className="text-xl font-semibold text-white">Post-promotion prospective errors</h2>
    <p>{realized.length} realized forecasts from {history.length} issued forecasts. Errors use predicted close minus actual close.
      No synthetic backtest, missing-session interpolation, or pre-promotion results are included.</p>
    {realized.length === 0 ? <p>Coverage starts only after a forecast is issued before its target session and the official close becomes available.</p> : null}
    {symbols.map((symbol) => {
      const rows = realized.filter((row) => row.symbol === symbol).sort((a, b) => a.forecastFor.localeCompare(b.forecastFor)).slice(-60);
      const dates = rows.map((row) => row.forecastFor);
      const actual = rows.map((row) => row.actual as number);
      const byModel = { [rows[0].model]: rows.map((row) => row.predictedClose) };
      return <div key={symbol}><h3 className="font-semibold">{symbol} · {rows.length} realized sessions</h3>
        <PredictionChart dates={dates} actual={actual} byModel={byModel} selectedModel={rows[0].model} liveStartDate={dates[0]} />
        <ErrorChart dates={dates} actual={actual} byModel={byModel} selectedModel={rows[0].model} liveStartDate={dates[0]} />
      </div>;
    })}
  </section>;
}
