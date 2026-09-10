import type { CompanyDetail } from "./types";

export interface CompanyChartData {
  dates: string[];
  actual: number[];
  byModel: Record<string, Array<number | null>>;
  legacyStartDate?: string;
  legacyEndDate?: string;
  liveStartDate?: string;
}

type ChartPoint = {
  date: string;
  actual: number;
  forecasts: Record<string, number>;
};

const NEXT_CLOSE_MODELS: Record<string, string> = {
  lag: "Lag-Informed Regression",
  arima: "ARIMA",
  lstm: "LSTM",
};

export function buildCompanyChartData(company: CompanyDetail): CompanyChartData {
  const points = new Map<string, ChartPoint>();
  const addStoredSeries = (
    dates: string[], actual: number[], byModel: Record<string, number[]>
  ) => dates.forEach((date, index) => {
    if (!Number.isFinite(actual[index])) return;
    const forecasts = Object.fromEntries(
      Object.entries(byModel)
        .filter(([, values]) => Number.isFinite(values[index]))
        .map(([model, values]) => [model, values[index]])
    );
    points.set(date, { date, actual: actual[index], forecasts });
  });

  addStoredSeries(company.backtestDates ?? [], company.backtestActual, company.backtestByModel);
  addStoredSeries(
    company.productionBacktestDates ?? [],
    company.productionBacktestActual ?? [],
    company.productionBacktestByModel ?? {}
  );

  const realizedOperational = (company.operationalHistory ?? [])
    .filter((row): row is typeof row & { actual: number } =>
      row.actual !== null && Number.isFinite(row.actual)
    );
  const comparisonDate = company.comparisonForecastDate ?? company.forecastDate;
  const comparisonNextClose = company.comparisonNextClose ?? company.nextClose;
  const currentActual = realizedOperational.find((row) => row.forecastFor === comparisonDate)?.actual;
  if (comparisonDate && currentActual !== undefined) {
    const forecasts = Object.fromEntries(
      Object.entries(NEXT_CLOSE_MODELS)
        .filter(([key]) => Number.isFinite(comparisonNextClose[key]))
        .map(([key, model]) => [model, comparisonNextClose[key]])
    );
    if (Object.keys(forecasts).length > 0) {
      points.set(comparisonDate, { date: comparisonDate, actual: currentActual, forecasts });
    }
  }

  for (const row of realizedOperational) {
    const point = points.get(row.forecastFor) ?? {
      date: row.forecastFor,
      actual: row.actual,
      forecasts: {},
    };
    point.actual = row.actual;
    for (const [model, value] of Object.entries(row.comparisonForecasts ?? {})) {
      if (Number.isFinite(value)) point.forecasts[model] = value;
    }
    point.forecasts[row.model] = row.predictedClose;
    points.set(row.forecastFor, point);
  }

  const latest = [...points.values()]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-60);
  const modelNames = [...new Set(latest.flatMap((point) => Object.keys(point.forecasts)))];
  const controlledOperationalDates = realizedOperational
    .map((row) => row.forecastFor)
    .filter((date) => !company.operationalPromotionStartDate
      || date >= company.operationalPromotionStartDate)
    .sort();
  const legacyDates = (company.productionBacktestDates ?? [])
    .filter((date) => !company.operationalPromotionStartDate
      || date < company.operationalPromotionStartDate)
    .sort();

  return {
    dates: latest.map((point) => point.date),
    actual: latest.map((point) => point.actual),
    byModel: Object.fromEntries(
      modelNames.map((model) => [model, latest.map((point) => point.forecasts[model] ?? null)])
    ),
    legacyStartDate: legacyDates[0],
    legacyEndDate: legacyDates.at(-1),
    liveStartDate: controlledOperationalDates.length > 0
      ? company.operationalPromotionStartDate ?? controlledOperationalDates[0]
      : undefined,
  };
}
