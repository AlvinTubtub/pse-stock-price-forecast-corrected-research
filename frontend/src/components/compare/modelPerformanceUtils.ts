import type { FormalModelId } from "@/lib/types";
import type {
  DashboardCompany,
  MetricKey,
  SortKey,
  SortDirection,
  ChartDataPoint,
  SummaryData,
} from "./modelPerformanceTypes";
import { MODELS, PRINCIPAL_MODELS, METRIC_CONFIG } from "./modelPerformanceConfig";

export function safeFormatMetric(
  val: number | string | null | undefined,
  digits = 4
): number | null {
  if (val == null) return null;
  const num = typeof val === "number" ? val : parseFloat(val);
  if (!Number.isFinite(num)) return null;
  return Number(num.toFixed(digits));
}

export function filterCompanies(
  companies: DashboardCompany[],
  selectedSector: string,
  searchQuery: string
): DashboardCompany[] {
  const query = searchQuery.trim().toLowerCase();
  return companies.filter((company) => {
    const matchesSector =
      selectedSector === "all" ||
      company.sector.toLowerCase() === selectedSector.toLowerCase();
    const matchesSearch =
      !query ||
      company.symbol.toLowerCase().includes(query) ||
      company.name.toLowerCase().includes(query);
    return matchesSector && matchesSearch;
  });
}

export function sortCompanies(
  companies: DashboardCompany[],
  selectedMetric: MetricKey,
  sortKey: SortKey,
  sortDirection: SortDirection,
  visibleModels: Record<FormalModelId, boolean> = {
    lag_reg: true,
    arima: true,
    lstm: true,
    naive: true,
  }
): DashboardCompany[] {
  const isLowerBetter = METRIC_CONFIG[selectedMetric].direction === "lower";

  return [...companies].sort((a, b) => {
    let comp = 0;

    if (sortKey === "symbol") {
      comp = a.symbol.localeCompare(b.symbol);
    } else {
      // Find best / worst score among visible models
      const getScore = (
        company: DashboardCompany,
        target: "best" | "worst"
      ): number => {
        let extremeVal =
          (target === "best" ? isLowerBetter : !isLowerBetter)
            ? Infinity
            : -Infinity;

        for (const m of MODELS) {
          if (!visibleModels[m]) continue;
          const val = company.metrics[m]?.[selectedMetric];
          if (val != null && Number.isFinite(val)) {
            if (target === "best") {
              if (isLowerBetter ? val < extremeVal : val > extremeVal) {
                extremeVal = val;
              }
            } else {
              if (isLowerBetter ? val > extremeVal : val < extremeVal) {
                extremeVal = val;
              }
            }
          }
        }
        return extremeVal;
      };

      const scoreA = getScore(a, sortKey === "best_score" ? "best" : "worst");
      const scoreB = getScore(b, sortKey === "best_score" ? "best" : "worst");

      comp = scoreA - scoreB;
    }

    return sortDirection === "asc" ? comp : -comp;
  });
}

export function buildChartData(
  filteredCompanies: DashboardCompany[],
  selectedMetric: MetricKey,
  visibleModels: Record<FormalModelId, boolean>
): ChartDataPoint[] {
  const metricMeta = METRIC_CONFIG[selectedMetric];

  return filteredCompanies.map((c) => {
    const point: ChartDataPoint = {
      symbol: c.symbol,
      name: c.name,
      sector: c.sector,
    };

    let bestVal = metricMeta.direction === "lower" ? Infinity : -Infinity;
    let bestModel: string | undefined = undefined;

    for (const m of MODELS) {
      if (visibleModels[m]) {
        const val = c.metrics[m]?.[selectedMetric];
        const formatted = safeFormatMetric(val);
        point[m] = formatted;

        if (formatted !== null) {
          if (metricMeta.direction === "lower") {
            if (formatted < bestVal) {
              bestVal = formatted;
              bestModel = m;
            }
          } else {
            if (formatted > bestVal) {
              bestVal = formatted;
              bestModel = m;
            }
          }
        }
      }
    }

    if (bestModel !== undefined) {
      point.bestModel = bestModel;
      point.bestVal = bestVal;
    }

    return point;
  });
}

export function calculateMedians(
  filteredCompanies: DashboardCompany[],
  selectedMetric: MetricKey
): Record<FormalModelId, number | null> {
  const medians: Record<FormalModelId, number | null> = {
    lag_reg: null,
    arima: null,
    lstm: null,
    naive: null,
  };

  for (const m of MODELS) {
    const vals = filteredCompanies
      .map((c) => c.metrics[m]?.[selectedMetric])
      .filter((v): v is number => v != null && Number.isFinite(v))
      .sort((a, b) => a - b);

    if (vals.length > 0) {
      const mid = Math.floor(vals.length / 2);
      medians[m] =
        vals.length % 2 !== 0
          ? Number(vals[mid].toFixed(4))
          : Number(((vals[mid - 1] + vals[mid]) / 2).toFixed(4));
    }
  }

  return medians;
}

export function calculateSummary(
  filteredCompanies: DashboardCompany[],
  selectedMetric: MetricKey,
  visibleModels: Record<FormalModelId, boolean>
): SummaryData {
  const metricMeta = METRIC_CONFIG[selectedMetric];
  const wins: Record<FormalModelId, number> = {
    lag_reg: 0,
    arima: 0,
    lstm: 0,
    naive: 0,
  };
  let totalEvaluated = 0;
  let belowNaiveScaleCount = 0;

  for (const c of filteredCompanies) {
    let bestVal = metricMeta.direction === "lower" ? Infinity : -Infinity;
    let winnerModel: FormalModelId | null = null;

    for (const m of MODELS) {
      if (!visibleModels[m]) continue;
      const val = c.metrics[m]?.[selectedMetric];
      if (val != null && Number.isFinite(val)) {
        if (metricMeta.direction === "lower") {
          if (val < bestVal) {
            bestVal = val;
            winnerModel = m;
          }
        } else {
          if (val > bestVal) {
            bestVal = val;
            winnerModel = m;
          }
        }
      }
    }

    if (winnerModel) {
      wins[winnerModel] = (wins[winnerModel] || 0) + 1;
      totalEvaluated += 1;
    }

    // Check naive scaling / outperformance for principal models
    const naiveVal = c.metrics.naive?.[selectedMetric];
    for (const m of PRINCIPAL_MODELS) {
      if (!visibleModels[m]) continue;
      const val = c.metrics[m]?.[selectedMetric];
      if (val != null && Number.isFinite(val)) {
        if (selectedMetric === "mase") {
          if (val < 1.0) belowNaiveScaleCount += 1;
        } else if (naiveVal != null && Number.isFinite(naiveVal)) {
          if (metricMeta.direction === "lower" ? val < naiveVal : val > naiveVal) {
            belowNaiveScaleCount += 1;
          }
        }
      }
    }
  }

  let topModel: FormalModelId | null = null;
  let maxWins = -1;
  for (const m of MODELS) {
    if (visibleModels[m] && wins[m] > maxWins) {
      maxWins = wins[m];
      topModel = m;
    }
  }

  return {
    winnerModel: maxWins > 0 ? topModel : null,
    wins,
    totalEvaluated,
    belowNaiveScaleCount,
    medians: calculateMedians(filteredCompanies, selectedMetric),
  };
}

export function toggleModelVisibility(
  current: Record<FormalModelId, boolean>,
  model: FormalModelId
): Record<FormalModelId, boolean> {
  const visibleCount = Object.values(current).filter(Boolean).length;
  // Prevent hiding the last visible model
  if (current[model] && visibleCount <= 1) {
    return current;
  }
  return {
    ...current,
    [model]: !current[model],
  };
}
