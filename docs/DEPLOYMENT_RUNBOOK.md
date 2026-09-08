# ForecastPH Deployment Lifecycle Runbook

This document describes the controlled deployment lifecycle for operational forecasting models in ForecastPH.

## Controlled Architecture & Guardrails

The deployment lifecycle enforces a strict separation between immutable formal research benchmarks and operational production models:

1. **Immutable Formal Research:** Stored under `results/formal/FORMAL_CORRECTED_20260828_02/`. Never retrained, modified, or overwritten by daily inference or deployment jobs.
2. **Approved Deployment Configurations:** Recorded in `backend/models/deployment/current/deployment_manifest.json` under `approved_configurations`.
3. **Challenger-Only Retuning:** Hyperparameter search evaluates candidate configurations and writes only into `models/deployment/challengers/<CHALLENGER_ID>/`. It does not promote models automatically.
4. **Human Review & Explicit Approval:** A human operator inspects challenger validation diagnostics and promotes approved configurations via `--confirm-approved`.
5. **Scheduled Monthly Refit:** The approved configurations are refitted on fresh validated data monthly (`0 0 1 * *`, 00:00 UTC / 08:00 PHT on the 1st of each month). Daily inference uses persisted artifacts without training.

> [!NOTE]
> Full 15-ticker LSTM challenger retuning evaluates 48 configurations across 5 expanding-window folds and 3 tuning seeds (720 fits per ticker, or 10,800 fits across all 15 tickers). Consequently, retuning is performed incrementally one ticker at a time as a deliberate, controlled operational process.

---

## Step-by-Step Operational Lifecycle

### Step 1: Retune One Ticker at a Time (Challenger-Only)

Run the retuning CLI for a single ticker to generate a candidate challenger:

```bash
cd backend
python -m services.model_selector --mode deployment-retune --symbol BPI
```

This generates:
- Artifacts: `models/deployment/challengers/<CHALLENGER_ID>/`
  - `lag_regression/BPI.pkl`
  - `arima/BPI.pkl`
  - `lstm/BPI.pth`
- Manifest: `models/deployment/challengers/<CHALLENGER_ID>/challenger_manifest.json`

The generated manifest records:
- `"status": "challenger_only"`
- `"automatic_promotion": false`
- Winning fold results and complete configuration search evidence in `lstm_tuning_diagnostics.configuration_results`.

### Step 2: Inspect Challenger Diagnostics

Examine the candidate configuration and cross-validation diagnostics:

```bash
cat models/deployment/challengers/<CHALLENGER_ID>/challenger_manifest.json
```

Verify:
- `mean_validation_rmse` and `validation_rmse_std` across folds.
- Convergence of ARIMA order and trend.
- PACF-selected lags and LASSO alpha for Lag-Informed Regression.
- LSTM lookback, hidden size, learning rate, and batch size.

### Step 3: Manually Approve Each Reviewed Ticker

Once verified by a human reviewer, promote the challenger configurations into `models/deployment/current/`:

```bash
python -m services.model_selector --mode deployment-approve --challenger-id <CHALLENGER_ID> --symbols BPI --confirm-approved
```

Approval enforces:
- Explicit `--confirm-approved` flag (prevents accidental promotion).
- Atomic update of `models/deployment/current/deployment_manifest.json`.
- Preservation of existing model-family selections in `best_models.json`.
- Retention of approved configurations for all previously promoted tickers.

Repeat Steps 1–3 for each of the 15 canonical tickers until all 15 have approved configurations.

### Step 4: Execute Strict Scheduled Refresh

Refit all 15 approved configurations on current validated PSE OHLCV data:

```bash
python -m services.model_selector --mode deployment-refresh --strict
```

Strict refresh guarantees:
- All 15 canonical tickers are present with valid OHLCV data.
- Only previously approved configurations are refitted.
- No hyperparameter search or formal evaluation is invoked.
- The resulting manifest records `"operation": "refresh"`.

### Step 5: Export and Validate Frontend Artifacts

Export the newly updated operational models and legacy snapshots:

```bash
python scripts/export_forecast_artifacts.py
python scripts/validate_exports.py
```

`validate_exports.py` will verify:
- All 15 company JSON files exist in `frontend/public/forecasts/company/`.
- `metrics.json` and `dashboard.json` are consistent.
- `naiveComparison` benchmark evidence is present for each company.
- Immutable formal study records remain intact.

### Step 6: Verify Complete Universe Coverage

Confirm that `backend/models/deployment/current/deployment_manifest.json` contains `approved_configurations` for all 15 tickers:

```bash
python -c "
import json
manifest = json.load(open('models/deployment/current/deployment_manifest.json'))
approved = manifest.get('approved_configurations', {})
assert len(approved) == 15, f'Expected 15 approved configurations, found {len(approved)}'
print(f'All {len(approved)} approved configurations present and verified.')
"
```
