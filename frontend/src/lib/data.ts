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
  const pesoChange = row.predictedClose - row.previousClose;
  return { ...company, model: row.model, predictedClose: row.predictedClose,
    previousClose: row.previousClose, pesoChange, pctChange: pesoChange / row.previousClose * 100,
    direction: pesoChange >= 0 ? "bullish" : "bearish", confidence: undefined,
    nextClose: key ? { ...(company.nextClose ?? {}), [key]: row.predictedClose } : (company.nextClose ?? {}),
    ohlcv: operational?.ohlcv[symbol.toUpperCase()] ?? company.ohlcv,
    forecastDate: row.forecastFor, dataAsOf: row.dataAsOf, inferenceAt: row.issuedAt };

}

export async function getAllSymbols(): Promise<string[]> {
  const companies = await getCompanies();
  return companies.map((c) => c.symbol);
}

export async function getDeploymentManifest(): Promise<DeploymentManifest | null> {
  return readJson<DeploymentManifest>("deployment.json");
}

export async function getOperationalBatch(): Promise<OperationalBatch | null> {
  const [batch, manifest] = await Promise.all([
    readJson<OperationalBatch>("operational.json"), getDeploymentManifest(),
  ]);
  if (!batch || !manifest || batch.developmentOnly !== false || batch.approvalStatus !== "approved"
      || batch.deploymentVersion !== manifest.promotion_id
      || Object.keys(batch.forecasts ?? {}).sort().join() !== Object.keys(manifest.companies).sort().join()) return null;
  const labels: Record<string, string> = { lag_reg: "Lag-Informed Regression", arima: "ARIMA", lstm: "LSTM" };
  const manifestBytes = await fs.readFile(path.join(FORECASTS_DIR, "deployment.json"));
  if (batch.manifestSha256 !== createHash("sha256").update(manifestBytes).digest("hex")) return null;
  if (Object.entries(batch.forecasts).some(([symbol, row]) => row.symbol !== symbol
      || row.model !== labels[manifest.companies[symbol].model] || row.coverage !== "post_promotion_prospective"
      || !Number.isFinite(row.predictedClose) || row.predictedClose <= 0
      || !Number.isFinite(row.previousClose) || row.previousClose <= 0)) return null;
  return batch;
}
