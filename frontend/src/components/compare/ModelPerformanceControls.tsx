"use client";

import React from "react";
import ModernIcon from "@/components/ModernIcon";
import type { FormalModelId } from "@/lib/types";
import type { MetricKey, SortKey, SortDirection } from "./modelPerformanceTypes";
import {
  MODELS,
  MODEL_CONFIG,
  METRIC_CONFIG,
  SECTORS,
  SORT_OPTIONS,
} from "./modelPerformanceConfig";

interface ModelPerformanceControlsProps {
  selectedMetric: MetricKey;
  onSelectMetric: (metric: MetricKey) => void;
  selectedSector: string;
  onSelectSector: (sector: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  visibleModels: Record<FormalModelId, boolean>;
  onToggleModel: (model: FormalModelId) => void;
  sortKey: SortKey;
  onSortKeyChange: (key: SortKey) => void;
  sortDirection: SortDirection;
  onToggleSortDirection: () => void;
  filteredCount: number;
  totalCount: number;
}

export default function ModelPerformanceControls({
  selectedMetric,
  onSelectMetric,
  selectedSector,
  onSelectSector,
  searchQuery,
  onSearchChange,
  visibleModels,
  onToggleModel,
  sortKey,
  onSortKeyChange,
  sortDirection,
  onToggleSortDirection,
  filteredCount,
  totalCount,
}: ModelPerformanceControlsProps) {
  const visibleModelCount = Object.values(visibleModels).filter(Boolean).length;

  return (
    <div className="space-y-4">
      {/* Metric Selector Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200 dark:border-charcoal-800">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Select Evaluation Metric
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
            {METRIC_CONFIG[selectedMetric].description}
          </p>
        </div>

        <div
          role="tablist"
          aria-label="Evaluation metrics"
          className="inline-flex p-1 rounded-xl bg-slate-100 dark:bg-charcoal-900 border border-slate-200 dark:border-charcoal-800 self-start sm:self-auto"
        >
          {(Object.keys(METRIC_CONFIG) as MetricKey[]).map((metric) => {
            const meta = METRIC_CONFIG[metric];
            const isActive = selectedMetric === metric;
            return (
              <button
                key={metric}
                role="tab"
                aria-selected={isActive}
                onClick={() => onSelectMetric(metric)}
                className={`relative px-3.5 py-1.5 rounded-lg text-xs font-medium font-mono transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-400 ${
                  isActive
                    ? "bg-white dark:bg-charcoal-800 text-slate-900 dark:text-white shadow-sm border border-slate-200 dark:border-charcoal-700 font-bold"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <span>{meta.shortName}</span>
                <span
                  className={`ml-1.5 text-[10px] uppercase px-1.5 py-0.5 rounded font-sans ${
                    isActive
                      ? "bg-slate-100 dark:bg-charcoal-900 text-slate-700 dark:text-slate-300"
                      : "text-slate-500 dark:text-slate-400"
                  }`}
                >
                  {meta.betterText}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Filter and Sort Toolbar */}
      <div className="p-4 rounded-2xl bg-white dark:bg-charcoal-900 border border-slate-200 dark:border-charcoal-800 shadow-sm space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Left: Sector & Search */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Sector Dropdown */}
            <div className="relative">
              <label htmlFor="sector-filter" className="sr-only">
                Filter by Sector
              </label>
              <select
                id="sector-filter"
                value={selectedSector}
                onChange={(e) => onSelectSector(e.target.value)}
                className="text-xs font-medium rounded-xl border border-slate-200 dark:border-charcoal-700 bg-slate-50 dark:bg-charcoal-850 text-slate-900 dark:text-white px-3 py-2 pr-8 focus:outline-none focus:ring-2 focus:ring-cyan-500 dark:focus:ring-neon-400 transition-colors cursor-pointer"
              >
                {SECTORS.map((sec) => (
                  <option key={sec.id} value={sec.id}>
                    {sec.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Company Search Input */}
            <div className="relative min-w-[220px]">
              <label htmlFor="company-search" className="sr-only">
                Search company ticker or name
              </label>
              <input
                id="company-search"
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search symbol or name..."
                className="w-full text-xs rounded-xl border border-slate-200 dark:border-charcoal-700 bg-slate-50 dark:bg-charcoal-850 text-slate-900 dark:text-white placeholder:text-slate-500 px-3 py-2 pl-8 focus:outline-none focus:ring-2 focus:ring-cyan-500 dark:focus:ring-neon-400 transition-colors"
              />
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500 dark:text-slate-400">
                <ModernIcon name="search" className="w-3.5 h-3.5" />
              </span>
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => onSearchChange("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 dark:hover:text-white text-xs"
                  aria-label="Clear search"
                >
                  ✕
                </button>
              )}
            </div>

            <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
              Showing {filteredCount} of {totalCount} companies
            </span>
          </div>

          {/* Right: Sorting Controls */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Sort:
            </span>
            <select
              aria-label="Sort metric by"
              value={sortKey}
              onChange={(e) => onSortKeyChange(e.target.value as SortKey)}
              className="text-xs font-medium rounded-xl border border-slate-200 dark:border-charcoal-700 bg-slate-50 dark:bg-charcoal-850 text-slate-900 dark:text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-cyan-500 dark:focus:ring-neon-400 cursor-pointer"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.key} value={opt.key}>
                  {opt.label}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={onToggleSortDirection}
              aria-label={`Sort direction: currently ${
                sortDirection === "asc" ? "Ascending" : "Descending"
              }. Click to toggle.`}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border border-slate-200 dark:border-charcoal-700 bg-slate-50 dark:bg-charcoal-850 text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-400"
            >
              <ModernIcon
                name={sortDirection === "asc" ? "arrowUp" : "arrowDown"}
                className="w-3.5 h-3.5 text-cyan-600 dark:text-neon-400"
              />
              <span className="capitalize">{sortDirection}</span>
            </button>
          </div>
        </div>

        {/* Model Visibility Toggles */}
        <div className="pt-3 border-t border-slate-100 dark:border-charcoal-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium mr-1">
              Active Models:
            </span>
            {MODELS.map((model) => {
              const cfg = MODEL_CONFIG[model];
              const isVisible = visibleModels[model];
              const isOnlyVisible = isVisible && visibleModelCount <= 1;

              return (
                <button
                  key={model}
                  type="button"
                  aria-pressed={isVisible}
                  disabled={isOnlyVisible}
                  onClick={() => onToggleModel(model)}
                  title={
                    isOnlyVisible
                      ? "At least one model must remain visible"
                      : isVisible
                      ? `Hide ${cfg.label}`
                      : `Show ${cfg.label}`
                  }
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-mono transition-all border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-400 ${
                    isVisible
                      ? `${cfg.bgBadge} ${cfg.borderBadge} ${cfg.textBadge} font-semibold shadow-xs`
                      : "bg-slate-100 dark:bg-charcoal-800 border-slate-200 dark:border-charcoal-700 text-slate-400 opacity-60 line-through"
                  } ${isOnlyVisible ? "cursor-not-allowed" : "cursor-pointer"}`}
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{
                      backgroundColor: isVisible ? cfg.color : "#64748b",
                    }}
                  />
                  <span>{cfg.shortLabel}</span>
                </button>
              );
            })}
          </div>

          <span className="text-[11px] text-slate-500 dark:text-slate-400 italic">
            Click model badge to toggle series visibility
          </span>
        </div>
      </div>
    </div>
  );
}
