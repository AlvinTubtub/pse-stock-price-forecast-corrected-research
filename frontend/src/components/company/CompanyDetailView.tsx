"use client";

import { useState, useEffect, useRef } from "react";
import HistoryChart from "@/components/charts/HistoryChart";
import NextDayPredictionChart from "@/components/charts/NextDayPredictionChart";
import PredictionChart from "@/components/charts/PredictionChart";
import ErrorChart from "@/components/charts/ErrorChart";
import ChangeBadge from "@/components/ChangeBadge";
import CompanyLogo from "@/components/CompanyLogo";
import StatCard from "@/components/StatCard";
import WatchlistStar from "@/components/watchlist/WatchlistStar";
import ModernIcon from "@/components/ModernIcon";
import { getCompanyProfile } from "@/lib/companyProfiles";
import { buildCompanyChartData } from "@/lib/chartData";
import { formatDate, formatNum, formatPeso } from "@/lib/format";
import type { CompanyDetail } from "@/lib/types";

interface CompanyDetailViewProps {
  company: CompanyDetail;
}

type ViewMode = "beginner" | "advanced";

const STORAGE_KEY = "forecastph_view_mode";

export default function CompanyDetailView({ company }: CompanyDetailViewProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("beginner");
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const beginnerBtnRef = useRef<HTMLButtonElement>(null);
  const advancedBtnRef = useRef<HTMLButtonElement>(null);

  // Sync mode with localStorage on client mount & listen for storage changes
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "advanced" || saved === "beginner") {
        setViewMode(saved);
      }
    } catch {
      // localStorage may be unavailable in private browsing modes
    }

    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && (e.newValue === "beginner" || e.newValue === "advanced")) {
        setViewMode(e.newValue);
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const handleModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // ignore
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, currentMode: ViewMode) => {
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      handleModeChange("advanced");
      advancedBtnRef.current?.focus();
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      handleModeChange("beginner");
      beginnerBtnRef.current?.focus();
    }
  };

  const profile = getCompanyProfile(company.symbol);

  const modelOrder = ["lag_reg", "arima", "lstm", "naive"];
  const modelLabels: Record<string, string> = {
    lag_reg: "Lag-Informed Regression",
    arima: "ARIMA",
    lstm: "LSTM",
    naive: "Naive baseline",
  };

  const selectedModelKey =
    Object.keys(modelLabels).find((key) => modelLabels[key] === company.model) || "arima";
  const selectedMetrics = company.metrics[selectedModelKey] || {
    rmse: "--",
    mae: "--",
    mase: "--",
    r2: "--",
  };

  const maseVal = parseFloat(String(selectedMetrics.mase));
  const naiveComp = company.naiveComparison;
  let naiveSignificanceLabel = "Naive significance evidence unavailable";
  let naiveBadgeStyle = "bg-charcoal-800/80 text-slate-400 border-charcoal-700";
  let naiveBadgeIcon: "check" | "alertTriangle" = "alertTriangle";

  if (naiveComp) {
    if (naiveComp.significantly_beats_naive) {
      naiveSignificanceLabel = `Statistically significant improvement over Naive (Holm p = ${naiveComp.holm_adjusted_p_value.toFixed(4)})`;
      naiveBadgeStyle = "bg-accent-emerald/15 text-accent-emerald border-accent-emerald/30";
      naiveBadgeIcon = "check";
    } else {
      naiveSignificanceLabel = `No statistically significant improvement over Naive (Holm p = ${naiveComp.holm_adjusted_p_value.toFixed(4)})`;
      naiveBadgeStyle = "bg-charcoal-800/80 text-slate-300 border-charcoal-700";
      naiveBadgeIcon = "alertTriangle";
    }
  }

  const chartData = buildCompanyChartData(company);
  const hasRealizedProductionHistory = Boolean(chartData.liveStartDate);

  return (
    <div className="space-y-8">
      {/* 1. Header & Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <a
            href="/companies"
            className="text-xs font-semibold text-neon-400 hover:text-neon-300 font-mono transition-colors uppercase tracking-wider mb-1 inline-block"
          >
            ← Back to Companies
          </a>
          <div className="flex items-start gap-3.5">
            <CompanyLogo symbol={company.symbol} name={company.name} size="lg" />
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-3xl font-extrabold text-white tracking-tight font-mono">{company.symbol}</h1>
                <span className="text-xs px-2.5 py-1 rounded-md bg-charcoal-900 border border-charcoal-700 text-slate-300 font-medium">
                  {company.sector}
                </span>
                <WatchlistStar symbol={company.symbol} showLabel size="md" />
              </div>
              <p className="text-sm text-slate-400 mt-0.5">{company.name}</p>

              {/* Compact Company Profile expand button directly below company name and sector label */}
              <button
                type="button"
                onClick={() => setIsProfileOpen((prev) => !prev)}
                aria-expanded={isProfileOpen}
                aria-controls="company-profile-panel"
                className="mt-2.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-slate-300 hover:text-white bg-charcoal-900 hover:bg-charcoal-850 border border-charcoal-700 hover:border-neon-400/40 transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-neon-400 shadow-card-glow group"
              >
                <svg
                  className="w-3.5 h-3.5 text-neon-400 shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span>About {company.name}</span>
                <svg
                  className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ease-out ${
                    isProfileOpen ? "rotate-180 text-neon-400" : ""
                  }`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Upper-right metadata area: Date context & Beginner / Advanced view toggle */}
        <div className="flex flex-col sm:items-end gap-2.5">
          {/* Date context */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400 bg-charcoal-900/80 border border-charcoal-700/80 px-3.5 py-2 rounded-xl font-mono shadow-xs">
            {company.dataAsOf && (
              <div>
                <span className="text-slate-500">Data as of: </span>
                <strong className="text-slate-300 font-medium">{formatDate(company.dataAsOf)}</strong>
              </div>
            )}
            {company.dataAsOf && company.forecastDate && <span className="text-slate-600">&middot;</span>}
            {company.forecastDate && (
              <div>
                <span className="text-slate-500">Forecast for: </span>
                <strong className="text-neon-300 font-semibold">
                  {formatDate(company.forecastDate)}
                </strong>
              </div>
            )}
          </div>

          {/* Accessible Beginner / Advanced Segmented Control */}
          <div
            role="radiogroup"
            aria-label="Detail view mode"
            className="inline-flex items-center p-1 rounded-xl bg-charcoal-900 border border-charcoal-700 shadow-card-glow"
          >
            <button
              ref={beginnerBtnRef}
              type="button"
              role="radio"
              aria-checked={viewMode === "beginner"}
              tabIndex={viewMode === "beginner" ? 0 : -1}
              onClick={() => handleModeChange("beginner")}
              onKeyDown={(e) => handleKeyDown(e, "beginner")}
              className={`relative px-3.5 py-1.5 rounded-lg text-xs font-semibold font-mono transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-neon-400 ${
                viewMode === "beginner"
                  ? "bg-neon-500 text-charcoal-950 shadow-neon-sm font-bold"
                  : "text-slate-400 hover:text-slate-200 hover:bg-charcoal-800"
              }`}
            >
              Beginner
            </button>
            <button
              ref={advancedBtnRef}
              type="button"
              role="radio"
              aria-checked={viewMode === "advanced"}
              tabIndex={viewMode === "advanced" ? 0 : -1}
              onClick={() => handleModeChange("advanced")}
              onKeyDown={(e) => handleKeyDown(e, "advanced")}
              className={`relative px-3.5 py-1.5 rounded-lg text-xs font-semibold font-mono transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-neon-400 ${
                viewMode === "advanced"
                  ? "bg-neon-500 text-charcoal-950 shadow-neon-sm font-bold"
                  : "text-slate-400 hover:text-slate-200 hover:bg-charcoal-800"
              }`}
            >
              Advanced
            </button>
          </div>
        </div>
      </div>

      {/* In-place collapsible Company Profile Panel */}
      <div
        id="company-profile-panel"
        className={`grid transition-all duration-200 ease-out ${
          isProfileOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0 pointer-events-none"
        }`}
        aria-hidden={!isProfileOpen}
      >
        <div className="overflow-hidden">
          <div className="glass-card p-4 sm:p-5 shadow-card-glow space-y-3">
            {profile?.description && (
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                {profile.description}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-2 border-t border-charcoal-700/60 text-xs">
              {company.sector && (
                <div>
                  <span className="text-slate-400">Sector: </span>
                  <span className="text-white font-medium">{company.sector}</span>
                </div>
              )}
              {profile?.industry && (
                <div>
                  <span className="text-slate-400">Industry: </span>
                  <span className="text-white font-medium">{profile.industry}</span>
                </div>
              )}
              {profile?.website && (
                <div>
                  <span className="text-slate-400">Official Website: </span>
                  <a
                    href={profile.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-neon-400 hover:text-neon-300 font-mono font-medium hover:underline ml-1"
                  >
                    <span>{profile.website.replace(/^https?:\/\/(www\.)?/, "")}</span>
                    <svg
                      className="w-3 h-3"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                      />
                    </svg>
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 2. Top Stats Grid */}
      <section
        className={`grid grid-cols-1 sm:grid-cols-2 ${
          viewMode === "advanced" ? "lg:grid-cols-4" : "lg:grid-cols-3"
        } gap-4`}
      >
        {/* Item 1: Previous Close (Shown in Beginner & Advanced) */}
        <StatCard label="Previous Close" value={formatPeso(company.previousClose)} />

        {/* Item 2: Forecasted Close (Shown in Beginner & Advanced) */}
        <StatCard
          label="Forecasted Close"
          value={formatPeso(company.predictedClose)}
          accent="text-white"
        />

        {/* Item 3: Expected Change (Shown in Beginner & Advanced) */}
        <div className="glass-card p-5 rounded-xl shadow-card-glow">
          <p className="text-xs uppercase tracking-wider text-slate-400 mb-2 font-medium">Expected Change</p>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white font-mono">{formatPeso(company.pesoChange)}</span>
            <ChangeBadge pctChange={company.pctChange} />
          </div>
        </div>

        {/* Item 4: Selected Model Card (Hidden in Beginner, Shown in Advanced) */}
        {viewMode === "advanced" && (
          <div className="glass-card p-5 rounded-xl shadow-card-glow">
            <p className="text-xs uppercase tracking-wider text-slate-400 mb-1 font-medium">Selected Model</p>
            <p className="text-base font-bold text-white truncate font-mono" title={company.model}>
              {company.model}
            </p>
            <p className="text-[11px] text-neon-400 font-mono mt-0.5">Lowest test-set RMSE</p>
          </div>
        )}
      </section>

      {/* 3. Selected Model Summary Panel (Hidden in Beginner, Shown in Advanced) */}
      {viewMode === "advanced" && (
        <section className="glass-card p-6 rounded-xl shadow-card-glow">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4 pb-3 border-b border-charcoal-700/60">
            <div>
              <h2 className="text-lg font-semibold text-white">
                Selected Model Summary: <span className="text-neon-400 font-mono">{company.model}</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Metrics calculated strictly for this company&apos;s out-of-sample test split.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-semibold font-mono border ${naiveBadgeStyle}`}
              >
                <ModernIcon name={naiveBadgeIcon} className="w-3.5 h-3.5" />
                {naiveSignificanceLabel}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-charcoal-900/80 border border-charcoal-800 rounded-lg p-3.5">
              <p className="text-xs text-slate-400 mb-0.5">Test RMSE</p>
              <p className="text-lg font-bold text-white font-mono">
                {formatNum(selectedMetrics.rmse, 4)}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">Scale-dependent error</p>
            </div>
            <div className="bg-charcoal-900/80 border border-charcoal-800 rounded-lg p-3.5">
              <p className="text-xs text-slate-400 mb-0.5">Test MAE</p>
              <p className="text-lg font-bold text-white font-mono">
                {formatNum(selectedMetrics.mae, 4)}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">Mean absolute error</p>
            </div>
            <div className="bg-charcoal-900/80 border border-charcoal-800 rounded-lg p-3.5">
              <p className="text-xs text-slate-400 mb-0.5">MASE</p>
              <p className="text-lg font-bold font-mono text-white">
                {formatNum(selectedMetrics.mase, 4)}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">&lt; 1.0 lower than in-sample scale</p>
            </div>
            <div className="bg-charcoal-900/80 border border-charcoal-800 rounded-lg p-3.5">
              <p className="text-xs text-slate-400 mb-0.5">Goodness-of-Fit (R²)</p>
              <p className="text-lg font-bold text-white font-mono">
                {formatNum(selectedMetrics.r2, 4)}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">Test set variance explained</p>
            </div>
          </div>

          <p className="text-xs text-slate-400 mt-3.5 leading-relaxed">
            <strong className="text-slate-300">Methodology Note: </strong>
            MASE below 1 means the model&apos;s holdout MAE is lower than the development-period in-sample Naive scaling error. Whether it significantly beats the holdout Naive forecast is determined separately using the benchmark-first Diebold–Mariano test and Holm-adjusted p-value. R² is a supplementary goodness-of-fit metric and is not a forecast confidence probability.
          </p>
        </section>
      )}

      {/* 4. Historical OHLCV (Shown in Beginner & Advanced) */}
      <section className="glass-card p-6 rounded-xl shadow-card-glow">
        <h2 className="text-lg font-semibold text-white mb-4">Historical OHLCV</h2>
        <HistoryChart data={company.ohlcv} />
      </section>

      {/* 5. Next-Day Prediction (Shown in Beginner & Advanced) */}
      <section className="glass-card p-6 rounded-xl shadow-card-glow">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-1">
          <h2 className="text-lg font-semibold text-white">Next-Day Prediction</h2>
        </div>
        <p className="text-sm text-slate-400 mb-4">
          Latest actual close with model predictions for the next trading session.
        </p>
        <NextDayPredictionChart
          ohlcv={company.ohlcv}
          previousClose={company.previousClose}
          nextClose={company.nextClose}
          forecastDate={company.forecastDate}
          dataAsOf={company.dataAsOf}
          hideModelBreakdown={viewMode === "beginner"}
        />
      </section>

      {/* 6. Backtest: Predicted vs. Actual (Shown in Beginner & Advanced) */}
      <section className="glass-card p-6 rounded-xl shadow-card-glow">
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <h2 className="text-lg font-semibold text-white">
            Backtest: Predicted vs. Actual (Last 60 Sessions)
          </h2>
          <span className="rounded-md border border-accent-amber/30 bg-accent-amber/10 px-2 py-0.5 text-[10px] font-semibold font-mono uppercase tracking-wide text-accent-amber">
            Pre-promotion evaluation
          </span>
          {hasRealizedProductionHistory && (
            <span className="rounded-md border border-accent-emerald/30 bg-accent-emerald/10 px-2 py-0.5 text-[10px] font-semibold font-mono uppercase tracking-wide text-accent-emerald">
              Live forecast
            </span>
          )}
        </div>
        <p className="text-sm text-slate-400 mb-4">
          The latest 60 realized target sessions combine the stored evaluation with immutable
          issued forecasts. The vertical marker shows where prospective production coverage begins.
        </p>
        <PredictionChart
          dates={chartData.dates}
          actual={chartData.actual}
          byModel={chartData.byModel}
          selectedModel={company.model}
          liveStartDate={chartData.liveStartDate}
        />
      </section>

      {/* 7. Forecast Error Over Time (Hidden in Beginner, Shown in Advanced) */}
      {viewMode === "advanced" && (
        <section className="glass-card p-6 rounded-xl shadow-card-glow">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h2 className="text-lg font-semibold text-white">Forecast Error Over Time</h2>
            <span className="rounded-md border border-accent-amber/30 bg-accent-amber/10 px-2 py-0.5 text-[10px] font-semibold font-mono uppercase tracking-wide text-accent-amber">
              Pre-promotion evaluation
            </span>
            {hasRealizedProductionHistory && (
              <span className="rounded-md border border-accent-emerald/30 bg-accent-emerald/10 px-2 py-0.5 text-[10px] font-semibold font-mono uppercase tracking-wide text-accent-emerald">
                Live forecast
              </span>
            )}
          </div>
          <p className="text-sm text-slate-400 mb-4">
            The latest 60 realized sessions use predicted close minus actual close (₱). Issued
            forecasts enter this graph only after the official target-session close is available;
            the vertical marker shows where prospective production coverage begins.
          </p>
          <ErrorChart
            dates={chartData.dates}
            actual={chartData.actual}
            byModel={chartData.byModel}
            selectedModel={company.model}
            liveStartDate={chartData.liveStartDate}
          />
        </section>
      )}

      {/* 8. Model Performance Table (Hidden in Beginner, Shown in Advanced) */}
      {viewMode === "advanced" && (
        <section className="glass-card p-6 rounded-xl shadow-card-glow overflow-x-auto">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-white mb-1">
              Model Performance for <span className="text-neon-400 font-mono">{company.symbol}</span>
            </h2>
            <p className="text-xs text-slate-400">
              Stored pre-promotion evaluation metrics across all forecasting models and the naive
              baseline. These are separate from the immutable formal-study metrics.
            </p>
          </div>

          <table className="w-full text-sm">
            <thead className="text-xs text-slate-400 font-mono uppercase bg-charcoal-900/90 border-b border-charcoal-700">
              <tr>
                <th className="text-left py-2.5 px-3">Model</th>
                <th className="text-right py-2.5 px-3">RMSE (₱)</th>
                <th className="text-right py-2.5 px-3">MAE (₱)</th>
                <th className="text-right py-2.5 px-3">MASE</th>
                <th className="text-right py-2.5 px-3">R²</th>
              </tr>
            </thead>
            <tbody>
              {modelOrder
                .filter((m) => company.metrics[m])
                .map((m) => (
                  <tr
                    key={m}
                    className={`border-b border-charcoal-800 transition-colors ${
                      modelLabels[m] === company.model
                        ? "bg-neon-500/5 hover:bg-charcoal-850/60"
                        : "hover:bg-charcoal-850/40"
                    }`}
                  >
                    <td className="py-2.5 px-3 font-medium text-white">
                      {modelLabels[m]}
                      {modelLabels[m] === company.model && (
                        <span className="ml-2 text-[10px] uppercase font-mono text-neon-400 border border-neon-400/40 bg-neon-500/10 rounded px-1.5 py-0.5">
                          Selected
                        </span>
                      )}
                      {m === "naive" && (
                        <span className="ml-2 text-[10px] uppercase font-mono text-slate-400 border border-charcoal-700 bg-charcoal-800 rounded px-1.5 py-0.5">
                          Benchmark
                        </span>
                      )}
                    </td>
                    <td className="text-right py-2.5 px-3 font-mono text-slate-200">
                      {formatNum(company.metrics[m].rmse)}
                    </td>
                    <td className="text-right py-2.5 px-3 font-mono text-slate-200">
                      {formatNum(company.metrics[m].mae)}
                    </td>
                    <td className="text-right py-2.5 px-3 font-mono text-slate-200">
                      {formatNum(company.metrics[m].mase)}
                    </td>
                    <td className="text-right py-2.5 px-3 font-mono text-slate-200">
                      {formatNum(company.metrics[m].r2)}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>

          <div className="mt-4 pt-3 border-t border-charcoal-700/60 text-xs text-slate-400 space-y-1">
            <p>
              &bull; <strong className="text-slate-300">Model Selection: </strong>
              The forecast model comes from the active deployment when generated. Metrics below remain pre-promotion. Formal-study RMSE
              rankings are reported separately on the Models page.
            </p>
            <p>
              &bull; <strong className="text-slate-300">MASE Benchmark: </strong>
              MASE &lt; 1.0 indicates better performance than the naive baseline, MASE = 1.0
              indicates approximately equal performance, and MASE &gt; 1.0 indicates worse
              performance.
            </p>
            <p>
              &bull; <strong className="text-slate-300">R² Interpretation: </strong>
              R² measures in-sample/test-set explained variance in price levels and is not a forecast
              confidence probability.
            </p>
          </div>
        </section>
      )}
    </div>
  );
}
