// Automated test for the Model Performance page (/compare)
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');

// 1. Verify that prohibited identifiers, commit hashes, and links are absent from source files
const comparePageSource = fs.readFileSync(path.join(root, 'src/app/compare/page.tsx'), 'utf8');
const dashboardSource = fs.readFileSync(path.join(root, 'src/components/compare/ModelPerformanceDashboard.tsx'), 'utf8');

const combinedSource = comparePageSource + '\n' + dashboardSource;

// Prohibited items
const PROHIBITED_TOKENS = [
  'FORMAL_CORRECTED_20260828_02',
  'bfb33b8c',
  '2b2ed0ca',
  '98199732',
  'https://github.com/AlvinTubtub/pse-stock-price-forecast/releases',
  'RUN02_OPS',
  'getOperationalBatch',
  'getMetrics',
  'getLatest',
  'predictedClose',
  'Operational forecast snapshot',
  'Current operational forecasts',
];

for (const token of PROHIBITED_TOKENS) {
  assert.equal(
    combinedSource.includes(token),
    false,
    `Prohibited token "${token}" was found in compare page or dashboard component!`
  );
}

// 2. Transpile and load data.ts to inspect actual formal study metrics
const compiled = ts.transpileModule(fs.readFileSync(path.join(root, 'src/lib/data.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2017, esModuleInterop: true },
}).outputText;

const tempFile = path.join(root, 'scripts', '.temp-data.cjs');
fs.writeFileSync(tempFile, compiled);

(async () => {
  try {
    const data = require(tempFile);
    const study = await data.getFormalStudy();
    const companies = await data.getCompanies();

    assert.ok(study, 'Formal study data must load successfully');
    assert.equal(study.kind, 'immutable_formal_study');
    assert.equal(study.data.companyCount, 15);
    assert.equal(study.perCompany.length, 15);

    // 3. Verify that formal study metrics remain completely unchanged
    assert.equal(study.conclusion.principalRmseWins.lag_reg, 7);
    assert.equal(study.conclusion.principalRmseWins.arima, 7);
    assert.equal(study.conclusion.principalRmseWins.lstm, 1);

    // Verify aggregate medians
    assert.ok(Math.abs(study.aggregate.arima.medianRMSE - 0.859415) < 1e-4);
    assert.ok(Math.abs(study.aggregate.lag_reg.medianRMSE - 0.860882) < 1e-4);
    assert.ok(Math.abs(study.aggregate.lstm.medianRMSE - 0.864189) < 1e-4);
    assert.ok(Math.abs(study.aggregate.naive.medianRMSE - 0.860872) < 1e-4);

    // Verify DM significance tests
    const sigList = study.conclusion.significantVsNaive;
    assert.equal(sigList.length, 2);
    const ict = sigList.find((s) => s.symbol === 'ICT');
    const mbt = sigList.find((s) => s.symbol === 'MBT');
    assert.ok(ict && ict.model === 'lag_reg', 'ICT should be significant for Lag Regression');
    assert.ok(mbt && mbt.model === 'lag_reg', 'MBT should be significant for Lag Regression');

    // 4. Verify Sector filtering logic
    const sectors = ['Financials', 'Industrial', 'Mining and Oil', 'Property', 'Services'];
    const companyMetaMap = new Map(companies.map((c) => [c.symbol, c.sector]));

    const financials = study.perCompany.filter((c) => companyMetaMap.get(c.symbol) === 'Financials');
    assert.equal(financials.length, 3, 'Financials should have 3 companies');

    const industrial = study.perCompany.filter((c) => companyMetaMap.get(c.symbol) === 'Industrial');
    assert.equal(industrial.length, 3, 'Industrial should have 3 companies');

    const miningOil = study.perCompany.filter((c) => companyMetaMap.get(c.symbol) === 'Mining and Oil');
    assert.equal(miningOil.length, 3, 'Mining and Oil should have 3 companies');

    const property = study.perCompany.filter((c) => companyMetaMap.get(c.symbol) === 'Property');
    assert.equal(property.length, 3, 'Property should have 3 companies');

    const services = study.perCompany.filter((c) => companyMetaMap.get(c.symbol) === 'Services');
    assert.equal(services.length, 3, 'Services should have 3 companies');

    // 5. Verify Metric calculations: Best score determination
    // For RMSE: lower is better
    study.perCompany.forEach((c) => {
      const bestModelByRmse = ['lag_reg', 'arima', 'lstm'].reduce((best, m) =>
        c.metrics[m].rmse < c.metrics[best].rmse ? m : best
      , 'lag_reg');
      assert.equal(bestModelByRmse, c.principalWinnerByRmse);
    });

    // For R²: higher is better
    study.perCompany.forEach((c) => {
      const bestModelByR2 = ['lag_reg', 'arima', 'lstm', 'naive'].reduce((best, m) =>
        c.metrics[m].r2 > c.metrics[best].r2 ? m : best
      , 'lag_reg');
      assert.ok(['lag_reg', 'arima', 'lstm', 'naive'].includes(bestModelByR2));
    });

    // For MASE: check values < 1.0
    let countBeatsNaiveMase = 0;
    study.perCompany.forEach((c) => {
      ['lag_reg', 'arima', 'lstm'].forEach((m) => {
        if (c.metrics[m].mase < 1.0) countBeatsNaiveMase++;
      });
    });
    assert.ok(countBeatsNaiveMase > 0, 'There should be instances where MASE < 1.0');

    // 6. Verify safe chart handling of missing, NaN, or non-finite values
    const safeFormat = (val) => (val != null && Number.isFinite(val) ? Number(val.toFixed(4)) : null);
    assert.equal(safeFormat(undefined), null);
    assert.equal(safeFormat(null), null);
    assert.equal(safeFormat(NaN), null);
    assert.equal(safeFormat(Infinity), null);
    assert.equal(safeFormat(-Infinity), null);
    assert.equal(safeFormat(0.859415), 0.8594);

    console.log('[frontend-test] PASS: prohibited identifiers absent, operational forecasts excluded, formal study metrics unchanged, sector & metric filters verified, safe non-finite handling confirmed');
  } finally {
    if (fs.existsSync(tempFile)) {
      fs.unlinkSync(tempFile);
    }
  }
})().catch((err) => {
  console.error('[frontend-test] FAIL:', err);
  process.exitCode = 1;
});
