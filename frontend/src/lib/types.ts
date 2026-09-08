export type Direction = "bullish" | "bearish";

export interface CompanySummary {
  symbol: string;
  name: string;
  sector: string;
  latestClose: number;
  predictedClose: number;
  pctChange: number;
  direction: Direction;
  bestModel: string;
  confidence?: number;
  forecastDate?: string;
}

export interface OhlcvPoint {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface ModelMetric {
  rmse: string | number;
  mae: string | number;
  mase: string | number;
  r2: string | number;
  ljung_box_pvalue?: string | number;
}

export interface NaiveComparison {
  model_a: string;
  model_b: string;
  direction: string;
  beats_naive_rmse: boolean;
  significantly_beats_naive: boolean;
  raw_p_value: number;
  holm_adjusted_p_value: number;
  mean_loss_differential: number;
  dm_statistic: number;
  hln_statistic: number;
  hac_bandwidth: number;
  n_observations: number;
  loss: string;
  alpha: number;
}

export interface CompanyDetail {
  symbol: string;
  name: string;
  sector: string;
  previousClose: number;
  predictedClose: number;
  pesoChange: number;
  pctChange: number;
  direction: Direction;
  model: string;
  confidence?: number;
  metrics: Record<string, ModelMetric>;
  nextClose: Record<string, number>;
  naiveComparison?: NaiveComparison | null;
  naiveComparisons?: Record<string, NaiveComparison>;
  ohlcv: OhlcvPoint[];
  backtestDates?: string[];
  backtestActual: number[];
  backtestByModel: Record<string, number[]>;
  productionBacktestDates?: string[];
  productionBacktestActual?: number[];
  productionBacktestByModel?: Record<string, number[]>;
  forecastDate?: string;
  dataAsOf?: string | null;
  inferenceAt?: string | null;
}

export interface DashboardData {
  generatedAt: string;
  forecastDate: string;
  lastRunAt: string | null;
  status: string;
  totalCompanies: number;
  missingCompanies: string[];
  sectors: { name: string; count: number }[];
  marketSummary: { gainers: number; losers: number; unchanged: number };
  topGainer: CompanySummary | null;
  topLoser: CompanySummary | null;
}

export interface FriedmanMaseTest {
  statistic: number;
  p_value: number;
  permutation_p_value: number;
  permutation_count: number;
  n_companies: number;
  model_order?: string[];
  seed?: number;
}

export interface RmseConsistencyCheck {
  counts: Record<string, number>;
  dominant_count: number;
  dominant_model: string | null;
  min_required: number;
  pass: boolean;
  tie?: boolean;
  tied_models?: string[];
  total_companies?: number;
}

export interface WilcoxonPosthocComparison {
  p_value: number;
  holm_p_value: number;
  statistic: number;
}

export interface WilcoxonPosthocTest {
  posthoc_executed: boolean;
  results: Record<string, WilcoxonPosthocComparison>;
}

export interface CompanyDmTestRecord {
  alpha: number;
  beats_naive_rmse: boolean;
  direction: string;
  dm_statistic: number;
  hac_bandwidth: number;
  hln_statistic: number;
  holm_adjusted_p_value: number;
  loss: string;
  mean_loss_differential: number;
  model_a: string;
  model_b: string;
  n_observations: number;
  raw_p_value: number;
  significantly_beats_naive: boolean;
}

export interface CompanyDmTestFamily {
  eligible_principal_models?: string[];
  reason?: string;
  stage1_vs_naive: CompanyDmTestRecord[];
  stage2_executed?: boolean;
  stage2_principal?: unknown[];
}

export interface CompanyDiagnosticMetric {
  computable: boolean;
  diagnostic: string;
  diagnostic_target: string;
  n: number;
  p_value?: number;
  statistic?: number;
  lm_statistic?: number;
  lm_p_value?: number;
  f_statistic?: number;
  f_p_value?: number;
  lags?: number[];
}

export interface CompanyDiagnostics {
  [model: string]: {
    arch_lm?: CompanyDiagnosticMetric;
    shapiro_wilk?: CompanyDiagnosticMetric;
  };
}

export interface PerCompanyStatisticalTests {
  diagnostics?: CompanyDiagnostics;
  dm_absolute_error?: CompanyDmTestFamily;
  dm_squared_error?: CompanyDmTestFamily;
}

export interface StatisticalTestsData {
  across_company: {
    friedman_mase: FriedmanMaseTest;
    rmse_consistency: RmseConsistencyCheck;
    wilcoxon_posthoc: WilcoxonPosthocTest;
  };
  per_company: Record<string, PerCompanyStatisticalTests>;
}

export interface MetricsData {
  generatedAt: string;
  forecastDate?: string;
  lastRunAt?: string | null;
  status?: string;
  aggregate: Record<string, { rmse: number; mae: number; mase: number; r2: number }>;
  bestModel: string;
  worstModel: string;
  perCompany: Record<
    string,
    {
      metrics: Record<string, ModelMetric>;
      bestModel: string;
      naiveComparison?: NaiveComparison | null;
      naiveComparisons?: Record<string, NaiveComparison>;
    }
  >;
  statisticalTests: StatisticalTestsData;
}

export type FormalModelId = "lag_reg" | "arima" | "lstm" | "naive";

export interface FormalModelSummary {
  label: string;
  principalRmseWins: number | null;
  medianRMSE: number;
  medianMAE: number;
  medianMASE: number;
  medianR2: number;
}

export interface FormalCompanyResult {
  symbol: string;
  dataSha256: string;
  principalWinnerByRmse: Exclude<FormalModelId, "naive">;
  lowestRmseIncludingNaive: FormalModelId[];
  metrics: Record<FormalModelId, ModelMetric>;
  dmSquaredErrorVsNaive: Record<
    Exclude<FormalModelId, "naive">,
    {
      adjustedPValue: number;
      rawPValue: number;
      direction: string;
      significantlyBeatsNaive: boolean;
    }
  >;
  configuration: {
    lagRegression: {
      alpha: number;
      selectedFeatureCount: number;
      selectedFeatures: string[];
    };
    arima: { order: number[]; trend: string | null; converged: boolean };
    lstm: {
      lookback: number;
      hiddenSize: number;
      learningRate: number;
      batchSize: number;
      fixedEpochs: number;
      finalFitSeed: number;
      tuningSeeds: number[];
    };
  };
  corporateActions: {
    verifiedEventCount: number;
    excludedTargetDates: string[];
    remainingHoldoutCount: number;
    status: string;
  };
}

export interface FormalStudyData {
  schemaVersion: number;
  kind: "immutable_formal_study";
  runId: string;
  status: "complete";
  finalizedAt: string;
  identity: {
    repositoryCommit: string;
    sourceDataCommit: string;
    archiveSha256: string;
    corporateActionRegistrySha256: string;
    releaseUrl: string;
  };
  data: {
    firstDate: string;
    cutoffDate: string;
    rowsPerCompany: number;
    totalRows: number;
    forecastPairsPerCompany: number;
    developmentPairsPerCompany: number;
    holdoutPairsPerCompany: number;
    holdoutStart: string;
    holdoutEnd: string;
    totalHoldoutPredictions: number;
    companyCount: number;
  };
  methodology: {
    splitBasis: string;
    models: FormalModelId[];
    modelLabels: Record<FormalModelId, string>;
    lassoAlphaCandidates: number;
    lstmConfigurations: number;
    lstmFolds: number;
    lstmTuningSeeds: number[];
    corporateActionPolicy: Record<string, unknown>;
  };
  conclusion: {
    summary: string;
    principalRmseWins: Record<Exclude<FormalModelId, "naive">, number>;
    dominanceThreshold: number;
    dominantModel: null;
    significantVsNaive: Array<{
      symbol: string;
      model: Exclude<FormalModelId, "naive">;
      adjustedPValue: number;
    }>;
    significantPosthocPairs: string[];
  };
  aggregate: Record<FormalModelId, FormalModelSummary>;
  perCompany: FormalCompanyResult[];
  acrossCompany: {
    friedmanMase: {
      statistic: number;
      permutation_p_value: number;
      permutation_count: number;
      n_companies: number;
    };
    wilcoxonPosthoc: {
      posthoc_executed: boolean;
      results: Record<string, { p_value: number; holm_p_value: number; statistic: number }>;
    };
    rmseConsistency: {
      counts: Record<Exclude<FormalModelId, "naive">, number>;
      dominant_count: number;
      dominant_model: null;
      min_required: number;
      pass: false;
    };
  };
}

export interface LatestData {
  generatedAt: string;
  forecastDate: string;
  lastRunAt: string | null;
  status: string;
}

export interface DeploymentManifest {
  promotion_id: string;
  promotion_date: string;
  formal_run_id: string;
  approval: { status: string; scope: string };
  companies: Record<string, { model: string; configuration: Record<string, unknown> }>;
}
export interface OperationalForecast {
  symbol: string;
  model: string;
  predictedClose: number;
  previousClose: number;
  dataAsOf: string;
  forecastFor: string;
  issuedAt: string;
  actual: number | null;
  error: number | null;
  deploymentVersion: string;
  coverage: string;
}
export interface OperationalBatch {
  manifestSha256: string;
  deploymentVersion: string;
  developmentOnly: boolean;
  approvalStatus: string;
  promotionBoundary: { firstIssuedAt: string; firstTargetDate: string };
  forecasts: Record<string, OperationalForecast>;
  history: OperationalForecast[];
  ohlcv: Record<string, OhlcvPoint[]>;
}
