// DOM & Component Smoke Test for Model Performance Dashboard (/compare)
const assert = require('node:assert/strict');
const path = require('node:path');
const React = require('react');
global.React = React;
const ReactDOMServer = require('react-dom/server');

const root = path.resolve(__dirname, '..');

// Register .ts / .tsx loader and '@/...' path alias resolution
const Module = require('node:module');
const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain, options) {
  if (request.startsWith('@/')) {
    request = path.join(root, 'src', request.slice(2));
  }
  return origResolve.call(this, request, parent, isMain, options);
};

const ts = require('typescript');
const fs = require('node:fs');

function compileSource(module, filename) {
  const source = fs.readFileSync(filename, 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      jsx: ts.JsxEmit.React,
      esModuleInterop: true,
    },
  }).outputText;
  module._compile(compiled, filename);
}

require.extensions['.ts'] = compileSource;
require.extensions['.tsx'] = compileSource;

(async () => {
  console.log('[smoke-test] Starting Model Performance Dashboard smoke test...');

  const dataModule = require(path.join(root, 'src/lib/data.ts'));
  const DashboardComponent = require(path.join(
    root,
    'src/components/compare/ModelPerformanceDashboard.tsx'
  )).default;
  const {
    filterCompanies,
    sortCompanies,
    buildChartData,
    calculateSummary,
    toggleModelVisibility,
  } = require(path.join(root, 'src/components/compare/modelPerformanceUtils.ts'));
  const { METRIC_CONFIG } = require(path.join(
    root,
    'src/components/compare/modelPerformanceConfig.ts'
  ));

  const study = await dataModule.getFormalStudy();
  const companiesMeta = await dataModule.getCompanies();

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

  // 1. Initial Page Rendering Smoke Test
  const initialHtml = ReactDOMServer.renderToString(
    React.createElement(DashboardComponent, { data: dashboardData })
  );
  assert.ok(initialHtml.length > 5000, 'Initial HTML render must produce complete markup');
  assert.ok(initialHtml.includes('Model Performance'), 'Title must be rendered');
  assert.ok(initialHtml.includes('Keyboard Chart Inspector'), 'Keyboard accessible companion inspector must be rendered');

  // Check absence of error overlays
  assert.equal(initialHtml.includes('error-overlay'), false);
  assert.equal(initialHtml.includes('Unhandled Runtime Error'), false);

  // Check absence of prohibited tokens
  const prohibitedTokens = [
    'FORMAL_CORRECTED_20260828_02',
    'bfb33b8c',
    '2b2ed0ca',
    '98199732',
    'https://github.com/AlvinTubtub/pse-stock-price-forecast/releases',
    'RUN02_OPS',
    'Operational forecast snapshot',
    'Current operational forecasts',
    'confirms forecasting skill',
    'Medians mitigate stock price scale differences',
  ];
  for (const token of prohibitedTokens) {
    assert.equal(initialHtml.includes(token), false, `Prohibited token found: ${token}`);
  }

  // 2. Metric Selectors Smoke Test (all 4 metrics: rmse, mae, mase, r2)
  for (const metric of ['rmse', 'mae', 'mase', 'r2']) {
    const meta = METRIC_CONFIG[metric];
    assert.ok(initialHtml.includes(meta.shortName), `Metric ${metric} tab must be present`);
    assert.ok(meta.description.length > 10, `Metric ${metric} must have a valid description`);

    // Verify calculation for each metric works without throwing
    const chartPoints = buildChartData(dashboardData.companies, metric, {
      lag_reg: true,
      arima: true,
      lstm: true,
      naive: true,
    });
    assert.equal(chartPoints.length, 15);
  }

  // 3. Financials Sector Filtering Smoke Test
  const financials = filterCompanies(dashboardData.companies, 'Financials', '');
  assert.equal(financials.length, 3);
  const financialTickers = financials.map((c) => c.symbol).sort();
  assert.deepEqual(financialTickers, ['BPI', 'MBT', 'SECB']);

  // 4. Company Search Smoke Test
  const searchResult = filterCompanies(dashboardData.companies, 'all', 'jfc');
  assert.equal(searchResult.length, 1);
  assert.equal(searchResult[0].symbol, 'JFC');

  const searchByName = filterCompanies(dashboardData.companies, 'all', 'ayala');
  assert.equal(searchByName.length, 1);
  assert.equal(searchByName[0].symbol, 'ALI');

  // 5. Model Visibility Toggles Smoke Test
  let visible = { lag_reg: true, arima: true, lstm: true, naive: true };
  visible = toggleModelVisibility(visible, 'naive');
  assert.equal(visible.naive, false);
  const chartNoNaive = buildChartData(dashboardData.companies, 'rmse', visible);
  assert.equal(chartNoNaive[0].naive, undefined);

  // Prevent toggling off the last visible model
  let single = { lag_reg: true, arima: false, lstm: false, naive: false };
  let stillSingle = toggleModelVisibility(single, 'lag_reg');
  assert.equal(stillSingle.lag_reg, true, 'Last visible model must never be toggled off');

  // 6. Ascending and Descending Sorting Smoke Test
  const ascSorted = sortCompanies(dashboardData.companies, 'rmse', 'symbol', 'asc', visible);
  assert.equal(ascSorted[0].symbol, 'ALI');
  const descSorted = sortCompanies(dashboardData.companies, 'rmse', 'symbol', 'desc', visible);
  assert.equal(descSorted[0].symbol, 'SMPH');

  const bestScoreRmseAsc = sortCompanies(dashboardData.companies, 'rmse', 'best_score', 'asc', visible);
  assert.ok(bestScoreRmseAsc.length === 15);

  const bestScoreR2Desc = sortCompanies(dashboardData.companies, 'r2', 'best_score', 'desc', visible);
  assert.ok(bestScoreR2Desc.length === 15);

  // 7. Keyboard Access to Chart Details Smoke Test
  assert.ok(initialHtml.includes('role="region"'));
  assert.ok(initialHtml.includes('aria-label="Keyboard accessible chart inspector"'));
  assert.ok(initialHtml.includes('Use Tab and Arrow keys to inspect individual company metric values'));

  console.log('[smoke-test] PASS: All smoke tests passed successfully (initial render, 4 metrics, Financials filter, search, model toggles, sort asc/desc, keyboard accessibility, 0 errors, 0 prohibited tokens).');
})().catch((err) => {
  console.error('[smoke-test] FAIL:', err);
  process.exitCode = 1;
});
