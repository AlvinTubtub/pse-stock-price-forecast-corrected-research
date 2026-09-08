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
process.chdir(temp);

const data = require(path.join(temp, 'data.cjs'));
const manifestPath = path.join(dest, 'deployment.json');
const activeManifestPath = path.join(dest, 'active-deployment.json');
const historicalManifest = JSON.parse(fs.readFileSync(manifestPath));
const activeManifest = JSON.parse(fs.readFileSync(activeManifestPath));
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
    promotionBoundary: { firstIssuedAt: '2026-09-07T18:00:00+08:00', firstTargetDate: targetDate },
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
    };
    batch.ohlcv[symbol] = [{ date: '2026-09-08', close: 20, open: 20, high: 21, low: 19, volume: 100 }];
  }
  return batch;
}

(async () => {
  assert.equal(activeManifest.schema_version, 2);
  assert.equal(data.deploymentVersion(await data.getDeploymentManifest()), activeManifest.deployment_version);

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
  const versionedBatch = makeBatch(activeManifest, 22, '2026-09-09');
  writeBatch(versionedBatch);
  const acceptedV2 = await data.getOperationalBatch();
  assert.equal(acceptedV2.deploymentVersion, activeManifest.deployment_version);
  assert.equal((await data.getCompanyDetail('ALI')).predictedClose, 22);
  assert.equal((await data.getCompanies()).find((row) => row.symbol === 'ALI').predictedClose, 22);
  assert.equal((await data.getDashboard()).forecastDate, '2026-09-09');
  assert.equal((await data.getDashboard()).marketSummary.gainers, 15);

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

  console.log('[frontend-test] PASS: schema-v1 compatibility, schema-v2 acceptance, manifest hashing, invalid-manifest rejection, and company/dashboard overlays');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
