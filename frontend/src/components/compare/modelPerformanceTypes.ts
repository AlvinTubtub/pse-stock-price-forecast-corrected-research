import type { FormalModelId, FormalModelSummary } from "@/lib/types";

export type MetricKey = "rmse" | "mae" | "mase" | "r2";
export type SortKey = "symbol" | "best_score" | "worst_score";
export type SortDirection = "asc" | "desc";

export interface DashboardCompanyMetric {
  rmse: number;
  mae: number;
  mase: number;
  r2: number;
  ljung_box_pvalue?: number | string;
}

export interface DashboardCompany {
  symbol: string;
  name: string;
  sector: string;
  principalWinnerByRmse: Exclude<FormalModelId, "naive">;
  lowestRmseIncludingNaive?: FormalModelId[];
  metrics: Record<FormalModelId, DashboardCompanyMetric>;
  dmSquaredErrorVsNaive: Record<
    Exclude<FormalModelId, "naive">,
    {
      adjustedPValue: number;
      rawPValue: number;
      significantlyBeatsNaive: boolean;
    }
  >;
  configuration: {
    lagRegression: { alpha: number; selectedFeatureCount: number };
    arima: { order: number[]; trend: string | null; converged: boolean };
    lstm: { lookback: number; hiddenSize: number; learningRate: number; batchSize: number; fixedEpochs: number };
  };
}

export interface ModelPerformanceData {
  data: {
    firstDate: string;
    cutoffDate: string;
    holdoutStart: string;
    holdoutEnd: string;
    companyCount: number;
    developmentPairsPerCompany: number;
    holdoutPairsPerCompany: number;
    forecastPairsPerCompany: number;
    rowsPerCompany: number;
    totalHoldoutPredictions: number;
  };
  methodology: {
    modelLabels: Record<FormalModelId, string>;
    lassoAlphaCandidates: number;
    lstmConfigurations: number;
    lstmFolds: number;
    lstmTuningSeeds: number[];
  };
  conclusion: {
    summary: string;
    principalRmseWins: Record<Exclude<FormalModelId, "naive">, number>;
    dominanceThreshold: number;
    significantVsNaive: Array<{
      symbol: string;
      model: Exclude<FormalModelId, "naive">;
      adjustedPValue: number;
    }>;
  };
  aggregate: Record<FormalModelId, FormalModelSummary>;
  acrossCompany: {
    friedmanMase: {
      statistic: number;
      permutation_p_value: number;
      n_companies: number;
    };
    wilcoxonPosthoc: {
      posthoc_executed: boolean;
      results: Record<string, { p_value: number; holm_p_value: number; statistic: number }>;
    };
    rmseConsistency: {
      counts: Record<Exclude<FormalModelId, "naive">, number>;
      dominant_count: number;
      min_required: number;
      pass: boolean;
    };
  };
  companies: DashboardCompany[];
}

export interface ChartDataPoint {
  symbol: string;
  name: string;
  sector: string;
  lag_reg?: number | null;
  arima?: number | null;
  lstm?: number | null;
  naive?: number | null;
  bestModel?: string;
  bestVal?: number | null;
}

export interface SummaryData {
  winnerModel: FormalModelId | null;
  wins: Record<FormalModelId, number>;
  totalEvaluated: number;
  belowNaiveScaleCount: number;
  medians: Record<FormalModelId, number | null>;
}
