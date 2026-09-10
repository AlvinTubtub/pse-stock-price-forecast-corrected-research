// Exercise the actual server readers against isolated schema-v1/v2 fixtures.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'run02-reader-'));
const dest = path.join(temp, 'public/forecasts');
fs.cpSync(path.join(root, 'public/forecasts'), dest, { recursive: true });
const compiled = ts.transpileModule(fs.readFileSync(path.join(root, 'src/lib/data.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2017, esModuleInterop: true },
}).outputText;
fs.writeFileSync(path.join(temp, 'data.cjs'), compiled);
const chartDataCompiled = ts.transpileModule(fs.readFileSync(path.join(root, 'src/lib/chartData.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
}).outputText;
fs.writeFileSync(path.join(temp, 'chart-data.cjs'), chartDataCompiled);
process.chdir(temp);

const data = require(path.join(temp, 'data.cjs'));
const chartData = require(path.join(temp, 'chart-data.cjs'));
const manifestPath = path.join(dest, 'deployment.json');
const activeManifestPath = path.join(dest, 'active-deployment.json');
const companyViewSource = fs.readFileSync(path.join(root, 'src/components/company/CompanyDetailView.tsx'), 'utf8');
const predictionChartSource = fs.readFileSync(path.join(root, 'src/components/charts/PredictionChart.tsx'), 'utf8');
const errorChartSource = fs.readFileSync(path.join(root, 'src/components/charts/ErrorChart.tsx'), 'utf8');
const activeManifest = JSON.parse(fs.readFileSync(activeManifestPath));
const historicalManifest = {
  schema_version: 1,
  promotion_id: 'RUN02_OPS_TEST_V1',
  promotion_date: '2026-09-07',
  formal_run_id: activeManifest.formal_run_id,
  approval: { status: 'approved', scope: 'manual_local_operational_generation' },
  companies: Object.fromEntries(Object.entries(activeManifest.companies).map(([symbol, item]) => [
    symbol,
    { model: item.model, configuration: item.configuration },
  ])),
};
const clone = (value) => JSON.parse(JSON.stringify(value));
const writeBatch = (value) => fs.writeFileSync(path.join(dest, 'operational.json'), JSON.stringify(value));
const writeManifest = (value) => fs.writeFileSync(manifestPath, `${JSON.stringify(value, null, 2)}\n`);
const manifestHash = () => crypto.createHash('sha256').update(fs.readFileSync(manifestPath)).digest('hex');
const versionOf = (manifest) => manifest.schema_version === 1
  ? manifest.promotion_id
  : manifest.deployment_version;

function makeBatch(manifest, predictedClose, targetDate) {
  const batch = {
    manifestSha256: manifestHash(),
    deploymentVersion: versionOf(manifest),
    developmentOnly: false,
    approvalStatus: 'approved',
    promotionBoundary: { firstIssuedAt: '2026-09-07T18:00:00+08:00', firstTargetDate: '2026-09-08' },
    forecasts: {},
    history: [],
    ohlcv: {},
  };
  for (const symbol of Object.keys(manifest.companies)) {
    batch.forecasts[symbol] = {
      symbol,
      model: { lag_reg: 'Lag-Informed Regression', arima: 'ARIMA', lstm: 'LSTM' }[manifest.companies[symbol].model],
      coverage: 'post_promotion_prospective',
      predictedClose,
      previousClose: 20,
      forecastFor: targetDate,
      dataAsOf: '2026-09-08',
      issuedAt: '2026-09-08T16:00:00+08:00',
      actual: null,
      error: null,
      deploymentVersion: versionOf(manifest),
    };
    batch.ohlcv[symbol] = [{ date: '2026-09-08', close: 20, open: 20, high: 21, low: 19, volume: 100 }];
  }
  batch.history = Object.values(batch.forecasts);
  return batch;
}

(async () => {
  assert.match(companyViewSource, /Legacy issued Sep 2–7/);
  assert.match(companyViewSource, /Controlled operational from Sep 8/);
  assert.match(companyViewSource, /development-period[\s\S]*in-sample Naive scaling error/);
  assert.doesNotMatch(companyViewSource, /MASE &lt; 1\.0 indicates better performance than the naive baseline/);
  assert.match(predictionChartSource, /Legacy issued/);
  assert.match(errorChartSource, /Legacy issued/);

  assert.equal(activeManifest.schema_version, 2);
  assert.equal(data.deploymentVersion(await data.getDeploymentManifest()), activeManifest.deployment_version);

  // The checked-in history retains all three predictions through September 9. September 10
  // was issued before controlled comparison snapshots and remains honestly selected-only.
  const publishedBatch = JSON.parse(fs.readFileSync(path.join(dest, 'operational.json')));
  const latestRealizedTarget = publishedBatch.history
    .filter((row) => row.actual !== null)
    .map((row) => row.forecastFor)
    .sort()
    .at(-1);
  assert.equal(latestRealizedTarget, '2026-09-10');
  const latestThreeModelTarget = '2026-09-09';
  for (const symbol of Object.keys(activeManifest.companies)) {
    const detail = await data.getCompanyDetail(symbol);
    const graph = chartData.buildCompanyChartData(detail);
    assert.notEqual(graph.dates.indexOf(latestRealizedTarget), -1,
      `${symbol}: latest realized session must be charted`);
    const index = graph.dates.indexOf(latestThreeModelTarget);
    assert.notEqual(index, -1, `${symbol}: latest issued three-model session must be charted`);
    for (const model of ['Lag-Informed Regression', 'ARIMA', 'LSTM']) {
      assert.equal(Number.isFinite(graph.byModel[model]?.[index]), true,
        `${symbol}: ${model} must be present on the latest issued three-model session`);
    }
  }

  // Historical schema v1 remains accepted and retains byte-level manifest hashing.
  writeManifest(historicalManifest);
  const historicalBatch = makeBatch(historicalManifest, 21, '2026-09-09');
  writeBatch(historicalBatch);
  assert.equal((await data.getOperationalBatch()).deploymentVersion, historicalManifest.promotion_id);
  assert.equal((await data.getCompanyDetail('ALI')).predictedClose, 21);

  const invalidHistorical = clone(historicalManifest);
  invalidHistorical.approval.status = 'pending';
  writeManifest(invalidHistorical);
  writeBatch({ ...historicalBatch, manifestSha256: manifestHash() });
  assert.equal(await data.getOperationalBatch(), null);

  // Schema v2 uses deployment_version and requires verified status, production scope,
  // artifact/configuration hashes, and an exact hash of the issuing manifest bytes.
  writeManifest(activeManifest);
  const versionedBatch = makeBatch(activeManifest, 22, '2026-09-10');
  for (const symbol of Object.keys(activeManifest.companies)) {
    const selectedLabel = {
      lag_reg: 'Lag-Informed Regression', arima: 'ARIMA', lstm: 'LSTM',
    }[activeManifest.companies[symbol].model];
    versionedBatch.forecasts[symbol].comparisonForecasts = {
      'Lag-Informed Regression': selectedLabel === 'Lag-Informed Regression' ? 22 : 21.8,
      ARIMA: selectedLabel === 'ARIMA' ? 22 : 22.1,
      LSTM: selectedLabel === 'LSTM' ? 22 : 21.9,
    };
    versionedBatch.forecasts[symbol].comparisonApprovalId = 'comparison-test';
    versionedBatch.forecasts[symbol].comparisonApprovalSha256 = 'a'.repeat(64);
    versionedBatch.forecasts[symbol].comparisonManifestSha256 = 'b'.repeat(64);
    versionedBatch.history.push({
      ...versionedBatch.forecasts[symbol],
      predictedClose: 21.5,
      forecastFor: '2026-09-09',
      dataAsOf: '2026-09-08',
      actual: 21,
      error: 0.5,
      comparisonForecasts: {
        'Lag-Informed Regression': selectedLabel === 'Lag-Informed Regression' ? 21.5 : 21.3,
        ARIMA: selectedLabel === 'ARIMA' ? 21.5 : 21.6,
        LSTM: selectedLabel === 'LSTM' ? 21.5 : 21.4,
      },
    });
  }
  writeBatch(versionedBatch);
  const acceptedV2 = await data.getOperationalBatch();
  assert.equal(acceptedV2.deploymentVersion, activeManifest.deployment_version);
  const companyDetail = await data.getCompanyDetail('ALI');
  assert.equal(companyDetail.predictedClose, 22);
  assert.equal(Object.values(companyDetail.nextClose).filter(Number.isFinite).length, 3);
  assert.deepEqual(
    companyDetail.operationalHistory.map((row) => [row.forecastFor, row.predictedClose, row.actual]),
    [['2026-09-09', 21.5, 21], ['2026-09-10', 22, null]],
  );
  assert.equal(companyDetail.operationalPromotionStartDate, '2026-09-08');
  for (const symbol of Object.keys(activeManifest.companies)) {
    const detail = await data.getCompanyDetail(symbol);
    const graph = chartData.buildCompanyChartData(detail);
    assert.equal(graph.dates.length, 60, `${symbol}: graph must contain 60 realized sessions`);
    assert.equal(graph.dates.at(-1), '2026-09-09', `${symbol}: graph must end on today's realized session`);
    assert.equal(graph.dates.includes('2026-09-10'), false, `${symbol}: graph must exclude tomorrow's forecast`);
    assert.equal(graph.actual.at(-1), 21, `${symbol}: graph must use today's official close`);
    assert.equal(graph.legacyStartDate, '2026-09-02', `${symbol}: graph must label legacy issuance start`);
    assert.equal(graph.legacyEndDate, '2026-09-07', `${symbol}: graph must label legacy issuance end`);
    assert.equal(graph.liveStartDate, '2026-09-08', `${symbol}: graph must use controlled promotion boundary`);
    for (const model of ['Lag-Informed Regression', 'ARIMA', 'LSTM']) {
      assert.equal(Number.isFinite(graph.byModel[model].at(-1)), true, `${symbol}: ${model} must be present today`);
    }
  }
  assert.equal((await data.getCompanies()).find((row) => row.symbol === 'ALI').predictedClose, 22);
  assert.equal((await data.getDashboard()).forecastDate, '2026-09-10');
  assert.equal((await data.getDashboard()).marketSummary.gainers, 15);

  const invalidComparisons = clone(versionedBatch);
  delete invalidComparisons.forecasts.ALI.comparisonForecasts.LSTM;
  writeBatch(invalidComparisons);
  assert.equal(await data.getOperationalBatch(), null);
  writeBatch(versionedBatch);

  writeBatch({ ...versionedBatch, manifestSha256: '0'.repeat(64) });
  assert.equal(await data.getOperationalBatch(), null);

  const invalidScope = clone(activeManifest);
  invalidScope.approval.scopes = ['scheduled_refresh'];
  writeManifest(invalidScope);
  writeBatch({ ...versionedBatch, manifestSha256: manifestHash() });
  assert.equal(await data.getOperationalBatch(), null);

  const invalidArtifact = clone(activeManifest);
  invalidArtifact.companies.ALI.artifact.sha256 = 'not-a-sha256';
  writeManifest(invalidArtifact);
  writeBatch({ ...versionedBatch, manifestSha256: manifestHash() });
  assert.equal(await data.getOperationalBatch(), null);

  writeManifest(activeManifest);
  writeBatch({ ...versionedBatch, developmentOnly: true, manifestSha256: manifestHash() });
  assert.equal(await data.getOperationalBatch(), null);
  writeBatch({ ...versionedBatch, forecasts: { ALI: versionedBatch.forecasts.ALI }, manifestSha256: manifestHash() });
  assert.equal(await data.getOperationalBatch(), null);

  const invalidActive = clone(activeManifest);
  invalidActive.status = 'pending';
  fs.writeFileSync(activeManifestPath, JSON.stringify(invalidActive));
  assert.equal(await data.getDeploymentManifest(), null);
  fs.writeFileSync(activeManifestPath, JSON.stringify(activeManifest));

  console.log('[frontend-test] PASS: schema-v1/v2 validation, company/dashboard overlays, and realized-only three-model graph history');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
