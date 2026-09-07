"use client";

import React, { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import ModernIcon, { ModernSquircleBadge } from "@/components/ModernIcon";
import { formatDate } from "@/lib/format";
import type { FormalModelId } from "@/lib/types";
import type {
  ModelPerformanceData,
  DashboardCompany,
  MetricKey,
  SortKey,
  SortDirection,
} from "./modelPerformanceTypes";
import {
  filterCompanies,
  sortCompanies,
  buildChartData,
  calculateSummary,
  toggleModelVisibility,
} from "./modelPerformanceUtils";
import ModelPerformanceControls from "./ModelPerformanceControls";
import ModelPerformanceSummary from "./ModelPerformanceSummary";
import ModelPerformanceChart from "./ModelPerformanceChart";
import ModelPerformanceTable from "./ModelPerformanceTable";
import ModelPerformanceMethodology from "./ModelPerformanceMethodology";

export type {
  ModelPerformanceData,
  DashboardCompany,
  MetricKey,
  SortKey,
  SortDirection,
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

  // Check prefers-reduced-motion media query
  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia) {
      const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
      setPrefersReducedMotion(mediaQuery.matches);
      const listener = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
      mediaQuery.addEventListener("change", listener);
      return () => mediaQuery.removeEventListener("change", listener);
    }
  }, []);

  // Filter and sort companies (memoized)
  const filteredCompanies = useMemo(() => {
    const filtered = filterCompanies(data.companies, selectedSector, searchQuery);
    return sortCompanies(filtered, selectedMetric, sortKey, sortDirection, visibleModels);
  }, [data.companies, selectedSector, searchQuery, selectedMetric, sortKey, sortDirection, visibleModels]);

  // Chart data transformation (memoized)
  const chartData = useMemo(() => {
    return buildChartData(filteredCompanies, selectedMetric, visibleModels);
  }, [filteredCompanies, selectedMetric, visibleModels]);

  // Dynamic Summary calculations for the filtered set and selected metric (memoized)
  const summary = useMemo(() => {
    return calculateSummary(filteredCompanies, selectedMetric, visibleModels);
  }, [filteredCompanies, selectedMetric, visibleModels]);

  // Model visibility toggler handler
  const handleToggleModel = (model: FormalModelId) => {
    setVisibleModels((prev) => toggleModelVisibility(prev, model));
  };

  return (
    <div className="space-y-8 pb-16">
      {/* Top Header & Breadcrumb */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <Link
              href="/"
              className="hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              Home
            </Link>
            <span>/</span>
            <span className="text-slate-700 dark:text-slate-200 font-medium">
              Models
            </span>
            <span>/</span>
            <span className="text-cyan-600 dark:text-neon-400 font-semibold font-mono">
              Performance
            </span>
          </div>

          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 dark:bg-charcoal-900 border border-slate-200 dark:border-charcoal-800 text-xs text-slate-600 dark:text-slate-400">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Formal Study Evaluation Period:</span>
            <strong className="font-mono text-slate-900 dark:text-white">
              {formatDate(data.data.firstDate)} — {formatDate(data.data.cutoffDate)}
            </strong>
          </div>
        </div>

        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
            Model Performance
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300 max-w-3xl leading-relaxed">
            Standardized holdout evaluation across 15 Philippine equities. Compare predictive accuracy, scale-normalized errors, and variance explained across Lag-Informed Regression, ARIMA, LSTM, and Naive baselines under identical rolling holdouts.
          </p>
        </div>
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Stat 1: Descriptive Wins */}
        <div className="p-4 rounded-2xl bg-white dark:bg-charcoal-900 border border-slate-200 dark:border-charcoal-800 shadow-sm flex items-center gap-3">
          <ModernSquircleBadge
            icon="star"
            color="cyan"
            size="lg"
            className="shrink-0"
          />
          <div>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              Descriptive Winner Count
            </span>
            <div className="text-sm font-bold font-mono text-slate-900 dark:text-white mt-0.5">
              <span>7 Lag</span>
              <span className="mx-1 text-slate-400">/</span>
              <span>7 ARIMA</span>
              <span className="mx-1 text-slate-400">/</span>
              <span>1 LSTM</span>
            </div>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5">
              Plurality by holdout RMSE
            </span>
          </div>
        </div>

        {/* Stat 2: Companies Evaluated */}
        <div className="p-4 rounded-2xl bg-white dark:bg-charcoal-900 border border-slate-200 dark:border-charcoal-800 shadow-sm flex items-center gap-3">
          <ModernSquircleBadge
            icon="barChart"
            color="emerald"
            size="lg"
            className="shrink-0"
          />
          <div>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              Evaluated Companies
            </span>
            <div className="text-xl font-bold font-mono text-slate-900 dark:text-white mt-0.5">
              {data.data.companyCount} Stocks
            </div>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5">
              Across 5 major PSE sectors
            </span>
          </div>
        </div>

        {/* Stat 3: Strict Dominance Rule */}
        <div className="p-4 rounded-2xl bg-white dark:bg-charcoal-900 border border-slate-200 dark:border-charcoal-800 shadow-sm flex items-center gap-3">
          <ModernSquircleBadge
            icon="shieldCheck"
            color="purple"
            size="lg"
            className="shrink-0"
          />
          <div>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              Strict Dominance
            </span>
            <div className="text-base font-bold font-mono text-slate-900 dark:text-white mt-0.5">
              None (&lt; 8/15)
            </div>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5">
              No single model proved dominant
            </span>
          </div>
        </div>

        {/* Stat 4: Formal Holdout Window */}
        <div className="p-4 rounded-2xl bg-white dark:bg-charcoal-900 border border-slate-200 dark:border-charcoal-800 shadow-sm flex items-center gap-3">
          <ModernSquircleBadge
            icon="calendar"
            color="cyan"
            size="lg"
            className="shrink-0"
          />
          <div>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              Holdout Window
            </span>
            <div className="text-sm font-bold font-mono text-slate-900 dark:text-white mt-0.5">
              {data.data.holdoutPairsPerCompany} Trading Days
            </div>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5">
              {data.data.totalHoldoutPredictions.toLocaleString()} total predictions
            </span>
          </div>
        </div>
      </div>

      {/* Interactive Controls & Filters */}
      <ModelPerformanceControls
        selectedMetric={selectedMetric}
        onSelectMetric={setSelectedMetric}
        selectedSector={selectedSector}
        onSelectSector={setSelectedSector}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        visibleModels={visibleModels}
        onToggleModel={handleToggleModel}
        sortKey={sortKey}
        onSortKeyChange={setSortKey}
        sortDirection={sortDirection}
        onToggleSortDirection={() =>
          setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"))
        }
        filteredCount={filteredCompanies.length}
        totalCount={data.companies.length}
      />

      {/* Dynamic Summary Cards */}
      <ModelPerformanceSummary
        selectedMetric={selectedMetric}
        summary={summary}
        visibleModels={visibleModels}
        filteredCompanyCount={filteredCompanies.length}
      />

      {/* Interactive Grouped Bar Chart & Accessible Inspector */}
      <ModelPerformanceChart
        chartData={chartData}
        selectedMetric={selectedMetric}
        visibleModels={visibleModels}
        prefersReducedMotion={prefersReducedMotion}
      />

      {/* Full Numerical Results Table */}
      <ModelPerformanceTable
        companies={filteredCompanies}
        selectedMetric={selectedMetric}
        visibleModels={visibleModels}
      />

      {/* Formal Statistical Rigor & Methodology */}
      <ModelPerformanceMethodology data={data} />
    </div>
  );
}
