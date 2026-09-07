import { Metadata } from "next";
import Link from "next/link";
import { getCompanies, getFormalStudy } from "@/lib/data";
import ModelPerformanceDashboard, {
  type ModelPerformanceData,
} from "@/components/compare/ModelPerformanceDashboard";

export const metadata: Metadata = {
  title: "Model Performance - ForecastPH",
  description:
    "Formal holdout performance benchmarks comparing Lag-Informed Regression, ARIMA, LSTM, and Naive baselines for Philippine equities.",
};

export default async function ComparePage() {
  const [study, companies] = await Promise.all([
    getFormalStudy(),
    getCompanies(),
  ]);

  if (!study) {
    console.error("[compare/page] Failed to load formal study dataset.");
    return (
      <div className="space-y-3 py-16 text-center max-w-md mx-auto">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          Model Performance Unavailable
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          The formal-study performance dataset could not be loaded. Please try again later or return to the{" "}
          <Link href="/" className="text-brand-500 dark:text-brand-400 underline font-medium">
            home page
          </Link>.
        </p>
      </div>
    );
  }

  // Create metadata lookup for company names and sectors
  const companyMetaMap = new Map(
    companies.map((c) => [c.symbol, { name: c.name, sector: c.sector || "Other" }])
  );

  // Sanitize and shape data explicitly: strictly exclude run IDs, commit hashes, release URLs, and archive hashes
  const dashboardData: ModelPerformanceData = {
    data: {
      firstDate: study.data.firstDate,
      cutoffDate: study.data.cutoffDate,
      holdoutStart: study.data.holdoutStart,
      holdoutEnd: study.data.holdoutEnd,
      companyCount: study.data.companyCount,
      rowsPerCompany: study.data.rowsPerCompany,
      totalHoldoutPredictions: study.data.totalHoldoutPredictions,
    },
    methodology: {
      modelLabels: study.methodology.modelLabels,
      lassoAlphaCandidates: study.methodology.lassoAlphaCandidates,
      lstmConfigurations: study.methodology.lstmConfigurations,
      lstmFolds: study.methodology.lstmFolds,
      lstmTuningSeeds: study.methodology.lstmTuningSeeds,
    },
    conclusion: {
      summary: study.conclusion.summary,
      principalRmseWins: study.conclusion.principalRmseWins,
      dominanceThreshold: study.conclusion.dominanceThreshold,
      significantVsNaive: study.conclusion.significantVsNaive.map((item) => ({
        symbol: item.symbol,
        model: item.model,
        adjustedPValue: item.adjustedPValue,
      })),
    },
    aggregate: study.aggregate,
    acrossCompany: {
      friedmanMase: {
        statistic: study.acrossCompany.friedmanMase.statistic,
        permutation_p_value: study.acrossCompany.friedmanMase.permutation_p_value,
        n_companies: study.acrossCompany.friedmanMase.n_companies,
      },
      wilcoxonPosthoc: {
        posthoc_executed: study.acrossCompany.wilcoxonPosthoc.posthoc_executed,
        results: study.acrossCompany.wilcoxonPosthoc.results,
      },
      rmseConsistency: {
        counts: study.acrossCompany.rmseConsistency.counts,
        dominant_count: study.acrossCompany.rmseConsistency.dominant_count,
        min_required: study.acrossCompany.rmseConsistency.min_required,
        pass: study.acrossCompany.rmseConsistency.pass,
      },
    },
    companies: study.perCompany.map((c) => {
      const meta = companyMetaMap.get(c.symbol);
      return {
        symbol: c.symbol,
        name: meta?.name || c.symbol,
        sector: meta?.sector || "Other",
        principalWinnerByRmse: c.principalWinnerByRmse,
        lowestRmseIncludingNaive: c.lowestRmseIncludingNaive,
        metrics: {
          lag_reg: {
            rmse: Number(c.metrics.lag_reg.rmse),
            mae: Number(c.metrics.lag_reg.mae),
            mase: Number(c.metrics.lag_reg.mase),
            r2: Number(c.metrics.lag_reg.r2),
          },
          arima: {
            rmse: Number(c.metrics.arima.rmse),
            mae: Number(c.metrics.arima.mae),
            mase: Number(c.metrics.arima.mase),
            r2: Number(c.metrics.arima.r2),
          },
          lstm: {
            rmse: Number(c.metrics.lstm.rmse),
            mae: Number(c.metrics.lstm.mae),
            mase: Number(c.metrics.lstm.mase),
            r2: Number(c.metrics.lstm.r2),
          },
          naive: {
            rmse: Number(c.metrics.naive.rmse),
            mae: Number(c.metrics.naive.mae),
            mase: Number(c.metrics.naive.mase),
            r2: Number(c.metrics.naive.r2),
          },
        },
        dmSquaredErrorVsNaive: {
          lag_reg: {
            adjustedPValue: c.dmSquaredErrorVsNaive.lag_reg.adjustedPValue,
            rawPValue: c.dmSquaredErrorVsNaive.lag_reg.rawPValue,
            significantlyBeatsNaive: c.dmSquaredErrorVsNaive.lag_reg.significantlyBeatsNaive,
          },
          arima: {
            adjustedPValue: c.dmSquaredErrorVsNaive.arima.adjustedPValue,
            rawPValue: c.dmSquaredErrorVsNaive.arima.rawPValue,
            significantlyBeatsNaive: c.dmSquaredErrorVsNaive.arima.significantlyBeatsNaive,
          },
          lstm: {
            adjustedPValue: c.dmSquaredErrorVsNaive.lstm.adjustedPValue,
            rawPValue: c.dmSquaredErrorVsNaive.lstm.rawPValue,
            significantlyBeatsNaive: c.dmSquaredErrorVsNaive.lstm.significantlyBeatsNaive,
          },
        },
        configuration: {
          lagRegression: {
            alpha: c.configuration.lagRegression.alpha,
            selectedFeatureCount: c.configuration.lagRegression.selectedFeatureCount,
          },
          arima: {
            order: c.configuration.arima.order,
            trend: c.configuration.arima.trend,
            converged: c.configuration.arima.converged,
          },
          lstm: {
            lookback: c.configuration.lstm.lookback,
            hiddenSize: c.configuration.lstm.hiddenSize,
            learningRate: c.configuration.lstm.learningRate,
            batchSize: c.configuration.lstm.batchSize,
            fixedEpochs: c.configuration.lstm.fixedEpochs,
          },
        },
      };
    }),
  };

  return <ModelPerformanceDashboard data={dashboardData} />;
}
