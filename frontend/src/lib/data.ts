import { promises as fs } from "fs";
import path from "path";
import { createHash } from "crypto";
import type {
  DeploymentManifest,
  OperationalBatch,
  CompanyDetail,
  CompanySummary,
  DashboardData,
  FormalStudyData,
  LatestData,
  MetricsData,
} from "./types";

// Every reader here does a plain fs.readFile against the JSON files that
// backend/scripts/export_forecast_artifacts.py writes straight into this
// repo's frontend/public/forecasts/ (monorepo — frontend and backend are
// sibling directories in the same repo, so there is no cross-repo fetch
// here). There is no database, no API route, no Python — this is the
// entire "backend" of the deployed app; the real backend/ pipeline that
// produces the JSON runs entirely inside GitHub Actions, never on Vercel.
const FORECASTS_DIR = path.join(process.cwd(), "public", "forecasts");
const APPROVED_FORMAL_RUN_ID = "FORMAL_CORRECTED_20260828_02";
const MODEL_LABELS: Record<string, string> = {
  lag_reg: "Lag-Informed Regression",
  arima: "ARIMA",
  lstm: "LSTM",
};

async function readJson<T>(relativePath: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(path.join(FORECASTS_DIR, relativePath), "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function getDashboard(): Promise<DashboardData | null> {
  const [legacy, companies, operational] = await Promise.all([
    readJson<DashboardData>("dashboard.json"), getCompanies(), getOperationalBatch(),
  ]);
  if (!legacy || !operational) return legacy;
  const row = Object.values(operational.forecasts)[0];
  return { ...legacy, forecastDate: row.forecastFor, lastRunAt: row.issuedAt, status: "ok",
    marketSummary: { gainers: companies.filter((c) => c.pctChange > 0).length,
      losers: companies.filter((c) => c.pctChange < 0).length, unchanged: companies.filter((c) => c.pctChange === 0).length },
    topGainer: companies.reduce((a, b) => a.pctChange > b.pctChange ? a : b),
    topLoser: companies.reduce((a, b) => a.pctChange < b.pctChange ? a : b) };

}

export async function getLatest(): Promise<LatestData | null> {
  const [legacy, operational] = await Promise.all([readJson<LatestData>("latest.json"), getOperationalBatch()]);
  if (!legacy || !operational) return legacy;
  const row = Object.values(operational.forecasts)[0];
  return { ...legacy, forecastDate: row.forecastFor, lastRunAt: row.issuedAt, status: "ok" };

}

export async function getMetrics(): Promise<MetricsData | null> {
  return readJson<MetricsData>("metrics.json");
}

export async function getFormalStudy(): Promise<FormalStudyData | null> {
  return readJson<FormalStudyData>(`formal/${APPROVED_FORMAL_RUN_ID}.json`);
}

export async function getCompanies(): Promise<CompanySummary[]> {
  const [companies, operational] = await Promise.all([
    readJson<CompanySummary[]>("companies.json"), getOperationalBatch(),
  ]);
  return (companies ?? []).map((company) => {
    const row = operational?.forecasts[company.symbol];
    if (!row) return company;
    const pctChange = (row.predictedClose / row.previousClose - 1) * 100;
    return { ...company, latestClose: row.previousClose, predictedClose: row.predictedClose,
      pctChange, direction: pctChange >= 0 ? "bullish" as const : "bearish" as const,
      bestModel: row.model, confidence: undefined, forecastDate: row.forecastFor };
  });
}

export async function getCompanyDetail(symbol: string): Promise<CompanyDetail | null> {
  const [company, operational] = await Promise.all([
    readJson<CompanyDetail>(`company/${symbol.toUpperCase()}.json`), getOperationalBatch(),
  ]);
  const row = operational?.forecasts[symbol.toUpperCase()];
  if (!company || !row) return company;
  const key = { "Lag-Informed Regression": "lag", ARIMA: "arima", LSTM: "lstm" }[row.model];
  const modelKey = { "Lag-Informed Regression": "lag_reg", ARIMA: "arima", LSTM: "lstm" }[row.model];
  const matchedComparison = (company.naiveComparisons && modelKey)
    ? (company.naiveComparisons[modelKey] ?? null)
    : (company.naiveComparison?.model_a === modelKey ? company.naiveComparison : null);
  const pesoChange = row.predictedClose - row.previousClose;
  return { ...company, model: row.model, predictedClose: row.predictedClose,
    previousClose: row.previousClose, pesoChange, pctChange: pesoChange / row.previousClose * 100,
    direction: pesoChange >= 0 ? "bullish" : "bearish", confidence: undefined,
    naiveComparison: matchedComparison,
    comparisonForecastDate: company.forecastDate,
    comparisonNextClose: company.nextClose,
    nextClose: key ? { ...(company.nextClose ?? {}), [key]: row.predictedClose } : (company.nextClose ?? {}),
    ohlcv: operational?.ohlcv[symbol.toUpperCase()] ?? company.ohlcv,
    operationalHistory: (operational.history ?? [])
      .filter((record) => record.symbol === symbol.toUpperCase())
      .sort((a, b) => a.forecastFor.localeCompare(b.forecastFor)),
    operationalPromotionStartDate: operational.promotionBoundary.firstTargetDate,
    forecastDate: row.forecastFor, dataAsOf: row.dataAsOf, inferenceAt: row.issuedAt };

}

export async function getAllSymbols(): Promise<string[]> {
  const companies = await getCompanies();
  return companies.map((c) => c.symbol);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasValidCompanies(value: unknown, requireArtifacts: boolean): boolean {
  if (!isRecord(value) || Object.keys(value).length === 0) return false;
  return Object.values(value).every((company) => {
    if (!isRecord(company) || !Object.prototype.hasOwnProperty.call(MODEL_LABELS, String(company.model))
        || !isRecord(company.configuration)) return false;
    if (!requireArtifacts) return true;
    const artifact = company.artifact;
    return isRecord(artifact)
      && typeof artifact.path === "string" && artifact.path.length > 0
      && typeof artifact.sha256 === "string" && /^[a-f0-9]{64}$/.test(artifact.sha256)
      && typeof artifact.configuration_sha256 === "string"
      && /^[a-f0-9]{64}$/.test(artifact.configuration_sha256)
      && artifact.model_family === company.model
      && typeof artifact.training_cutoff === "string";
  });
}

export function isDeploymentManifestV1(value: unknown): value is Extract<DeploymentManifest, { schema_version: 1 }> {
  if (!isRecord(value) || value.schema_version !== 1 || typeof value.promotion_id !== "string"
      || value.promotion_id.length === 0 || typeof value.promotion_date !== "string"
      || !/^\d{4}-\d{2}-\d{2}$/.test(value.promotion_date)
      || typeof value.formal_run_id !== "string" || !isRecord(value.approval)) return false;
  return value.approval.status === "approved" && typeof value.approval.scope === "string"
    && hasValidCompanies(value.companies, false);
}

export function isDeploymentManifestV2(value: unknown): value is Extract<DeploymentManifest, { schema_version: 2 }> {
  if (!isRecord(value) || value.schema_version !== 2 || typeof value.deployment_version !== "string"
      || value.deployment_version.length === 0 || value.status !== "verified"
      || typeof value.formal_run_id !== "string" || typeof value.operation !== "string"
      || typeof value.created_at !== "string" || !Number.isFinite(Date.parse(value.created_at))
      || !isRecord(value.approval)
      || typeof value.approval.approval_id !== "string"
      || typeof value.approval.authorized_at !== "string"
      || !Number.isFinite(Date.parse(value.approval.authorized_at))
      || typeof value.approval.record_sha256 !== "string"
      || !/^[a-f0-9]{64}$/.test(value.approval.record_sha256)
      || !Array.isArray(value.approval.scopes)
      || !value.approval.scopes.includes("production_inference")) return false;
  return hasValidCompanies(value.companies, true);
}

export function deploymentVersion(manifest: DeploymentManifest): string {
  return manifest.schema_version === 1 ? manifest.promotion_id : manifest.deployment_version;
}

async function readDeploymentManifest(relativePath: string): Promise<DeploymentManifest | null> {
  const manifest = await readJson<unknown>(relativePath);
  return isDeploymentManifestV1(manifest) || isDeploymentManifestV2(manifest) ? manifest : null;
}

export async function getDeploymentManifest(): Promise<DeploymentManifest | null> {
  try {
    await fs.access(path.join(FORECASTS_DIR, "active-deployment.json"));
    return readDeploymentManifest("active-deployment.json");
  } catch {
    return readDeploymentManifest("deployment.json");
  }
}

export async function getIssuingDeploymentManifest(): Promise<DeploymentManifest | null> {
  return readDeploymentManifest("deployment.json");
}

export async function getOperationalBatch(): Promise<OperationalBatch | null> {
  const [batch, manifest] = await Promise.all([
    readJson<OperationalBatch>("operational.json"), getIssuingDeploymentManifest(),
  ]);
  if (!batch || !manifest || batch.developmentOnly !== false || batch.approvalStatus !== "approved"
      || batch.deploymentVersion !== deploymentVersion(manifest)
      || Object.keys(batch.forecasts ?? {}).sort().join() !== Object.keys(manifest.companies).sort().join()) return null;
  const manifestBytes = await fs.readFile(path.join(FORECASTS_DIR, "deployment.json"));
  if (batch.manifestSha256 !== createHash("sha256").update(manifestBytes).digest("hex")) return null;
  if (Object.entries(batch.forecasts).some(([symbol, row]) => row.symbol !== symbol
      || row.model !== MODEL_LABELS[manifest.companies[symbol].model] || row.coverage !== "post_promotion_prospective"
      || !Number.isFinite(row.predictedClose) || row.predictedClose <= 0
      || !Number.isFinite(row.previousClose) || row.previousClose <= 0)) return null;
  return batch;
}
