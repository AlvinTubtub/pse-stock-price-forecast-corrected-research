// Exercise the actual server readers against isolated JSON fixtures.
const assert = require('node:assert/strict');
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
process.chdir(temp);
const data = require(path.join(temp, 'data.cjs'));
const manifest = JSON.parse(fs.readFileSync(path.join(dest, 'deployment.json')));
const write = (value) => fs.writeFileSync(path.join(dest, 'operational.json'), JSON.stringify(value));
(async () => {
  assert.equal(await data.getOperationalBatch(), null);
  const legacy = await data.getCompanyDetail('ALI');
  const batch = { manifestSha256: require('node:crypto').createHash('sha256').update(fs.readFileSync(path.join(dest, 'deployment.json'))).digest('hex'), deploymentVersion: manifest.promotion_id, developmentOnly: false, approvalStatus: 'approved',
    promotionBoundary: { firstIssuedAt: '2026-09-07T18:00:00+08:00', firstTargetDate: '2026-09-08' },
    forecasts: {}, history: [], ohlcv: {} };
  for (const symbol of Object.keys(manifest.companies)) {
    batch.forecasts[symbol] = { symbol, model: {lag_reg: 'Lag-Informed Regression', arima: 'ARIMA', lstm: 'LSTM'}[manifest.companies[symbol].model], coverage: 'post_promotion_prospective', predictedClose: 21, previousClose: 20,
      forecastFor: '2026-09-08', dataAsOf: '2026-09-07', issuedAt: '2026-09-07T18:00:00+08:00' };
    batch.ohlcv[symbol] = [{ date: '2026-09-07', close: 20, open: 20, high: 21, low: 19, volume: 100 }];
  }
  write({ ...batch, developmentOnly: true });
  assert.equal(await data.getOperationalBatch(), null);
  write({ ...batch, forecasts: { ALI: batch.forecasts.ALI } });
  assert.equal(await data.getOperationalBatch(), null);
  write({ ...batch, approvalStatus: 'pending' });
  assert.equal(await data.getOperationalBatch(), null);
  write(batch);
  const promoted = await data.getCompanyDetail('ALI');
  assert.equal(promoted.predictedClose, 21);
  assert.deepEqual(promoted.nextClose, { ...legacy.nextClose, lag: 21 });
  assert.equal(promoted.confidence, undefined);
  assert.deepEqual(promoted.backtestActual, legacy.backtestActual);
  assert.deepEqual(promoted.productionBacktestDates, legacy.productionBacktestDates);
  assert.deepEqual(promoted.ohlcv, batch.ohlcv.ALI);
  assert.equal((await data.getCompanies()).length, 15);
  assert.equal((await data.getDashboard()).marketSummary.gainers, 15);
  assert.equal((await data.getLatest()).forecastDate, '2026-09-08');
  console.log('[frontend-test] PASS: pending, smoke rejection, incomplete/unapproved rejection, forecast overlays, history preservation, fresh OHLCV, dashboard and latest metadata');
})().catch((error) => { console.error(error); process.exitCode = 1; });
