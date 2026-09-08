// Comprehensive behavior and data transformation test for Model Performance (/compare)
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');

// Register .ts loader and '@/...' path alias resolution
const Module = require('node:module');
const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain, options) {
  if (request.startsWith('@/')) {
    request = path.join(root, 'src', request.slice(2));
  }
  return origResolve.call(this, request, parent, isMain, options);
};

require.extensions['.ts'] = function (module, filename) {
  const source = fs.readFileSync(filename, 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
  }).outputText;
  module._compile(compiled, filename);
};

(async () => {
  console.log('[test-models-page] Running comprehensive Model Performance verification suite...');

  // 1. Source verification: Verify prohibited tokens are completely absent from compare page and components
  const compareDir = path.join(root, 'src/components/compare');
  const comparePageSource = fs.readFileSync(path.join(root, 'src/app/compare/page.tsx'), 'utf8');
  const compareComponentFiles = fs.readdirSync(compareDir).filter((f) => f.endsWith('.ts') || f.endsWith('.tsx'));
  let combinedSource = comparePageSource;
  for (const f of compareComponentFiles) {
    combinedSource += '\n' + fs.readFileSync(path.join(compareDir, f), 'utf8');
  }

  const PROHIBITED_TOKENS = [
    'FORMAL_CORRECTED_20260828_02',
    'bfb33b8c',
    '2b2ed0ca',
    '98199732',
    'https://github.com',
    'RUN02_OPS',
    'getOperationalBatch',
    'getMetrics',
    'predictedClose',
    'previousClose',
    'Operational forecast snapshot',
    'Current operational forecasts',
    'confirms forecasting skill',
    'Medians mitigate stock price scale differences',
  ];

  for (const token of PROHIBITED_TOKENS) {
    assert.equal(
      combinedSource.includes(token),
      false,
      `Prohibited token "${token}" was found in compare page or dashboard source!`
    );
  }

  // 2. Load data and test real page data transformation
  const dataModule = require(path.join(root, 'src/lib/data.ts'));
  const utilsModule = require(path.join(root, 'src/components/compare/modelPerformanceUtils.ts'));
  const configModule = require(path.join(root, 'src/components/compare/modelPerformanceConfig.ts'));

  const {
    filterCompanies,
    sortCompanies,
    buildChartData,
    calculateSummary,
    calculateMedians,
    safeFormatMetric,
    toggleModelVisibility,
  } = utilsModule;

  const { METRIC_CONFIG, MODEL_CONFIG, MODELS, PRINCIPAL_MODELS } = configModule;

  const study = await dataModule.getFormalStudy();
  const companiesMeta = await dataModule.getCompanies();

  assert.ok(study, 'Formal study dataset must load successfully');
  assert.equal(study.kind, 'immutable_formal_study');
  assert.equal(study.data.companyCount, 15);

  // Construct sanitized dashboardData mirroring page.tsx
  const companyMetaMap = new Map(
    companiesMeta.map((c) => [c.symbol, { name: c.name, sector: c.sector || 'Other' }])
  );

  const dashboardData = {
    data: {
      firstDate: study.data.firstDate,
      cutoffDate: study.data.cutoffDate,
      holdoutStart: study.data.holdoutStart,
      holdoutEnd: study.data.holdoutEnd,
      companyCount: study.data.companyCount,
      developmentPairsPerCompany: study.data.developmentPairsPerCompany,
      holdoutPairsPerCompany: study.data.holdoutPairsPerCompany,
      forecastPairsPerCompany: study.data.forecastPairsPerCompany,
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
    acrossCompany: study.acrossCompany,
    companies: study.perCompany.map((c) => {
      const meta = companyMetaMap.get(c.symbol);
      return {
        symbol: c.symbol,
        name: meta?.name || c.symbol,
        sector: meta?.sector || 'Other',
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
        dmSquaredErrorVsNaive: c.dmSquaredErrorVsNaive,
        configuration: c.configuration,
      };
    }),
  };

  // 3. Verify that sanitized page data contains formal performance fields only, without prohibited data
  const serialized = JSON.stringify(dashboardData);
  assert.equal(serialized.includes('FORMAL_CORRECTED_20260828_02'), false);
  assert.equal(serialized.includes('bfb33b8c'), false);
  assert.equal(serialized.includes('2b2ed0ca'), false);
  assert.equal(serialized.includes('98199732'), false);
  assert.equal(serialized.includes('predictedClose'), false);
  assert.equal(serialized.includes('RUN02_OPS'), false);

  // 4. Verify Finding 1 & 2: Corrected chronological split & holdout target values
  assert.equal(dashboardData.data.developmentPairsPerCompany, 1380);
  assert.equal(dashboardData.data.holdoutPairsPerCompany, 243);
  assert.equal(dashboardData.data.holdoutStart, '2025-09-02');
  assert.equal(dashboardData.data.holdoutEnd, '2026-08-28');
  assert.equal(dashboardData.data.firstDate, '2020-01-02');
  assert.equal(dashboardData.data.cutoffDate, '2026-08-28');

  // 5. Verify numerical metric values match immutable source data exactly for all 15 companies
  assert.equal(dashboardData.companies.length, 15);
  for (const raw of study.perCompany) {
    const shaped = dashboardData.companies.find((c) => c.symbol === raw.symbol);
    assert.ok(shaped, `Company ${raw.symbol} must exist in shaped data`);
    for (const m of ['lag_reg', 'arima', 'lstm', 'naive']) {
      assert.equal(shaped.metrics[m].rmse, raw.metrics[m].rmse, `RMSE for ${raw.symbol} ${m} must match`);
      assert.equal(shaped.metrics[m].mae, raw.metrics[m].mae, `MAE for ${raw.symbol} ${m} must match`);
      assert.equal(shaped.metrics[m].mase, raw.metrics[m].mase, `MASE for ${raw.symbol} ${m} must match`);
      assert.equal(shaped.metrics[m].r2, raw.metrics[m].r2, `R2 for ${raw.symbol} ${m} must match`);
    }
  }

  // 6. Test real filtering behavior: Sector filtering
  const financials = filterCompanies(dashboardData.companies, 'Financials', '');
  assert.equal(financials.length, 3, 'Financials must contain exactly 3 companies');
  const financialSymbols = financials.map((c) => c.symbol).sort();
  assert.deepEqual(financialSymbols, ['BPI', 'MBT', 'SECB'], 'Financials must be exactly BPI, MBT, SECB');

  const industrial = filterCompanies(dashboardData.companies, 'Industrial', '');
  assert.equal(industrial.length, 3);
  assert.deepEqual(industrial.map((c) => c.symbol).sort(), ['JFC', 'MER', 'SHLPH']);

  const property = filterCompanies(dashboardData.companies, 'Property', '');
  assert.equal(property.length, 3);
  assert.deepEqual(property.map((c) => c.symbol).sort(), ['ALI', 'MEG', 'SMPH']);

  const services = filterCompanies(dashboardData.companies, 'Services', '');
  assert.equal(services.length, 3);
  assert.deepEqual(services.map((c) => c.symbol).sort(), ['GLO', 'ICT', 'PGOLD']);

  const mining = filterCompanies(dashboardData.companies, 'Mining and Oil', '');
  assert.equal(mining.length, 3);
  assert.deepEqual(mining.map((c) => c.symbol).sort(), ['APX', 'NIKL', 'SCC']);

  // 7. Test real filtering behavior: Company Search
  const searchTicker = filterCompanies(dashboardData.companies, 'all', 'jfc');
  assert.equal(searchTicker.length, 1);
  assert.equal(searchTicker[0].symbol, 'JFC');

  const searchName = filterCompanies(dashboardData.companies, 'all', 'ayala land');
  assert.equal(searchName.length, 1);
  assert.equal(searchName[0].symbol, 'ALI');

  const searchSubstring = filterCompanies(dashboardData.companies, 'all', 'telecom');
  assert.equal(searchSubstring.length, 1);
  assert.equal(searchSubstring[0].symbol, 'GLO');

  const searchEmpty = filterCompanies(dashboardData.companies, 'all', 'nonexistent_ticker_xyz');
  assert.equal(searchEmpty.length, 0);

  // 8. Test real sorting behavior (symbol, best_score, worst_score, asc, desc)
  const defaultVisible = { lag_reg: true, arima: true, lstm: true, naive: true };

  // Symbol sorting
  const sortedSymbolAsc = sortCompanies(dashboardData.companies, 'rmse', 'symbol', 'asc', defaultVisible);
  assert.equal(sortedSymbolAsc[0].symbol, 'ALI');
  assert.equal(sortedSymbolAsc[sortedSymbolAsc.length - 1].symbol, 'SMPH');

  const sortedSymbolDesc = sortCompanies(dashboardData.companies, 'rmse', 'symbol', 'desc', defaultVisible);
  assert.equal(sortedSymbolDesc[0].symbol, 'SMPH');
  assert.equal(sortedSymbolDesc[sortedSymbolDesc.length - 1].symbol, 'ALI');

  // Best score sorting (RMSE: lower is better)
  const sortedRmseBestAsc = sortCompanies(dashboardData.companies, 'rmse', 'best_score', 'asc', defaultVisible);
  assert.ok(
    Math.min(...Object.values(sortedRmseBestAsc[0].metrics).map((m) => m.rmse)) <=
    Math.min(...Object.values(sortedRmseBestAsc[1].metrics).map((m) => m.rmse))
  );

  // Best score sorting (R2: higher is better)
  const sortedR2BestDesc = sortCompanies(dashboardData.companies, 'r2', 'best_score', 'desc', defaultVisible);
  assert.ok(
    Math.max(...Object.values(sortedR2BestDesc[0].metrics).map((m) => m.r2)) >=
    Math.max(...Object.values(sortedR2BestDesc[1].metrics).map((m) => m.r2))
  );

  // Worst score sorting (RMSE)
  const sortedRmseWorstDesc = sortCompanies(dashboardData.companies, 'rmse', 'worst_score', 'desc', defaultVisible);
  assert.ok(
    Math.max(...Object.values(sortedRmseWorstDesc[0].metrics).map((m) => m.rmse)) >=
    Math.max(...Object.values(sortedRmseWorstDesc[1].metrics).map((m) => m.rmse))
  );

  // 9. Test model toggles and chart data generation
  const fullChartData = buildChartData(dashboardData.companies, 'rmse', defaultVisible);
  assert.equal(fullChartData.length, 15);
  assert.ok(fullChartData[0].lag_reg !== undefined);
  assert.ok(fullChartData[0].arima !== undefined);
  assert.ok(fullChartData[0].lstm !== undefined);
  assert.ok(fullChartData[0].naive !== undefined);

  // Toggle off naive
  const noNaiveVisible = { ...defaultVisible, naive: false };
  const partialChartData = buildChartData(dashboardData.companies, 'rmse', noNaiveVisible);
  assert.equal(partialChartData[0].naive, undefined, 'Naive must be omitted when toggled off');
  assert.ok(partialChartData[0].lag_reg !== undefined);

  // Test at least one model always remains visible
  const singleVisible = { lag_reg: true, arima: false, lstm: false, naive: false };
  const attemptedToggleOff = toggleModelVisibility(singleVisible, 'lag_reg');
  assert.equal(attemptedToggleOff.lag_reg, true, 'At least one model must always remain visible');

  const normalToggle = toggleModelVisibility(defaultVisible, 'lstm');
  assert.equal(normalToggle.lstm, false, 'Normal toggle should disable model');

  // 10. Test dynamic summary calculation
  // For principal models (excluding naive), wins match formal study: 7 Lag, 7 ARIMA, 1 LSTM
  const principalVisible = { lag_reg: true, arima: true, lstm: true, naive: false };
  const summaryPrincipalRmse = calculateSummary(dashboardData.companies, 'rmse', principalVisible);
  assert.equal(summaryPrincipalRmse.totalEvaluated, 15);
  assert.equal(summaryPrincipalRmse.wins.lag_reg, 7);
  assert.equal(summaryPrincipalRmse.wins.arima, 7);
  assert.equal(summaryPrincipalRmse.wins.lstm, 1);

  // When naive is included, naive has lowest RMSE on 2 companies
  const summaryAllRmse = calculateSummary(dashboardData.companies, 'rmse', defaultVisible);
  assert.equal(summaryAllRmse.totalEvaluated, 15);
  assert.equal(summaryAllRmse.wins.lag_reg, 5);
  assert.equal(summaryAllRmse.wins.arima, 7);
  assert.equal(summaryAllRmse.wins.lstm, 1);
  assert.equal(summaryAllRmse.wins.naive, 2);

  // Test MASE summary (beating naive < 1.0)
  const summaryMase = calculateSummary(dashboardData.companies, 'mase', defaultVisible);
  assert.ok(summaryMase.belowNaiveScaleCount > 0, 'There should be models beating naive with MASE < 1.0');

  // 11. Test safe formatting of null, undefined, NaN, and Infinity
  assert.equal(safeFormatMetric(undefined), null);
  assert.equal(safeFormatMetric(null), null);
  assert.equal(safeFormatMetric(NaN), null);
  assert.equal(safeFormatMetric(Infinity), null);
  assert.equal(safeFormatMetric(-Infinity), null);
  assert.equal(safeFormatMetric(0.859415, 4), 0.8594);
  assert.equal(safeFormatMetric("0.859415", 4), 0.8594);

  // 12. Verify Finding 3: MASE definition and labels
  assert.equal(METRIC_CONFIG.mase.betterText, '< 1.0 has lower MAE than Naive');
  assert.ok(
    METRIC_CONFIG.mase.description.includes(
      'Lower is better. A value below 1.0 indicates lower average absolute error than the Naive persistence benchmark; it does not by itself establish statistical significance.'
    )
  );

  // 13. Verify Finding 4: Metric-aware median explanations
  assert.ok(METRIC_CONFIG.rmse.medianExplanation.includes('peso-denominated errors remain affected by company price scale'));
  assert.ok(METRIC_CONFIG.mae.medianExplanation.includes('peso-denominated errors remain affected by company price scale'));
  assert.ok(METRIC_CONFIG.mase.medianExplanation.includes('scale-normalized relative to each company’s Naive denominator'));
  assert.ok(METRIC_CONFIG.r2.medianExplanation.includes('not a confidence score'));

  // 14. Verify buildCompareContext() does not load operational data
  const aiContextModule = require(path.join(root, 'src/lib/ai/context.ts'));
  const compareContext = await aiContextModule.buildCompareContext();
  assert.ok(compareContext.includes('[Context: Formal Study Model Performance]'));
  assert.equal(compareContext.includes('FORMAL_CORRECTED_20260828_02'), false);
  assert.equal(compareContext.includes('Operational deployment'), false);
  assert.equal(compareContext.includes('pre-promotion deployment'), false);

  console.log('[test-models-page] ALL CHECKS PASSED: Real filtering, sorting, model toggling, safe formatting, formal metric fidelity, and prohibited token exclusion verified.');
})().catch((err) => {
  console.error('[test-models-page] FAILED:', err);
  process.exitCode = 1;
});
