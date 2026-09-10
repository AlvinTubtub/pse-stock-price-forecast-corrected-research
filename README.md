# ForecastPH

[![Python 3.11](https://img.shields.io/badge/Python-3.11-blue.svg)](https://www.python.org/)
[![Next.js 14](https://img.shields.io/badge/Next.js-14-black.svg)](https://nextjs.org/)
[![Formal Study](https://img.shields.io/badge/Formal%20Study-Run%2002-success.svg)](frontend/public/forecasts/formal/FORMAL_CORRECTED_20260828_02.json)
[![Deployment](https://img.shields.io/badge/Deployment-Schema%20v2-blueviolet.svg)](backend/models/deployment/active.json)
[![Production](https://img.shields.io/badge/Production-Live-00b894.svg)](https://frontend-ten-xi-11.vercel.app/)

ForecastPH is a research and operational forecasting platform for next-session closing prices of 15 Philippine Stock Exchange companies. It compares Lag-Informed Regression, ARIMA, and LSTM under a chronological, leakage-controlled evaluation design, then serves approved forecasts through an artifact-backed Next.js dashboard.

Live dashboard: [frontend-ten-xi-11.vercel.app](https://frontend-ten-xi-11.vercel.app/)

> ForecastPH is an academic and educational project. Its forecasts are not financial advice.

## What the repository contains

- A Python 3.11 backend for official-data ingestion, validation, formal research, persisted-model inference, and artifact export.
- A Next.js 14 frontend for company forecasts, model comparisons, historical charts, operational status, and educational content.
- An immutable formal Run 02 research result separated from rolling operational forecasts.
- Versioned, hash-checked operational deployments with explicit authorization scopes.
- GitHub Actions workflows for daily data/inference updates and one separately authorized model refresh.

## Tracked companies

| Sector | Symbols |
| --- | --- |
| Financials | BPI, MBT, SECB |
| Industrial | JFC, MER, SHLPH |
| Property | ALI, MEG, SMPH |
| Services | GLO, ICT, PGOLD |
| Mining and Oil | APX, NIKL, SCC |

## Models

The formal study evaluates three principal model families and one benchmark:

- Lag-Informed Regression uses chronologically selected return lags and fold-local scaling.
- ARIMA uses bounded candidate selection and expanding-window validation. Walk-forward updates append newly observed values without re-estimating fixed coefficients.
- LSTM predicts changes in closing price with fold-local scaling, internal early stopping, and reconstruction to price levels.
- Naive Baseline is an evaluation benchmark, not a deployment candidate.

The operational deployment uses the approved model family and frozen configuration for each company. Daily inference loads persisted artifacts; it does not train, retune challengers, select models, or alter the formal study.

## Research and operational boundaries

ForecastPH keeps three kinds of evidence separate:

1. The formal Run 02 study is an immutable research snapshot with a fixed data cutoff and holdout evaluation.
2. Issued operational forecasts are immutable predictions tied to their original deployment and manifest hash.
3. Actual closing prices and forecast errors are attached only after the corresponding official target-session observation becomes available.

The approved formal run is `FORMAL_CORRECTED_20260828_02`, with a fixed August 28, 2026 data cutoff. Its verified identities are:

- Evidence archive SHA-256: `2b2ed0ca6b88ea6cfef5ac14013440da1c7c55c1d9f9640e04a595fdafca5d24`
- Formal summary SHA-256: `c0a5962709be16a82e5f5eeb634424ef0cad93a05d08db5c8af02e1d90ff5a6e`

The frontend artifact is stored at:

```text
frontend/public/forecasts/formal/FORMAL_CORRECTED_20260828_02.json
```

Normal data updates, inference, deployment refreshes, and frontend builds must not rewrite this formal artifact.

## Operational deployments

Deployment state lives under:

```text
backend/models/deployment/
├── active.json
├── approvals/
├── current/
└── versions/<DEPLOYMENT_VERSION>/
    ├── manifest.json
    └── artifacts/
```

The active pointer is changed atomically only after a complete deployment passes validation. A deployment contains all 15 approved company configurations and the persisted artifact for each selected model family.

The frontend explicitly supports both manifest generations:

- Schema v1 identifies the historical deployment with `promotion_id`.
- Schema v2 identifies a versioned deployment with `deployment_version`, verified status, approval scopes, artifact hashes, configuration hashes, and training cutoffs.

The frontend exports two deployment views:

- `deployment.json` is the manifest that issued the currently displayed forecast batch.
- `active-deployment.json` is the deployment currently authorized for production inference.

These versions can differ. Existing forecasts remain tied to their issuing deployment, while the active deployment is used for the next eligible issuance. `operational.json` is accepted only when its deployment identity, complete 15-company coverage, authorization state, model mapping, and exact issuing-manifest SHA-256 are valid.

## Forecast and error charts

Company pages display the latest 60 realized target sessions in both **Backtest: Predicted vs. Actual** and **Forecast Error Over Time**.

- The graphs end at the latest target session with an official actual close.
- Lag-Informed Regression, ARIMA, and LSTM are shown when the issued three-model snapshot exists for that target date.
- Pending next-session forecasts are shown in the Next-Day Prediction section, not in either realized-history graph.
- Forecast error is calculated as predicted close minus actual close.
- The production marker separates stored evaluation observations from prospective issued forecasts.

No missing historical forecast is reconstructed after the fact. No future actual or error is fabricated.

## Architecture

```text
Official PSE reports
        ↓
Validated OHLCV files in backend/data/raw/
        ↓
Approved persisted-model inference
        ↓
Complete operational batch + immutable issuance history
        ↓
Validated JSON export to frontend/public/forecasts/
        ↓
Next.js static/server-rendered pages
        ↓
Vercel Git deployment
```

Vercel does not run Python models. The frontend reads checked-in JSON artifacts and never trains models or writes forecast data.

## Repository layout

```text
.
├── .github/workflows/
│   ├── update_pipeline.yml       # daily official data and approved inference
│   └── train_models.yml          # separately authorized one-time refresh
├── backend/
│   ├── data/raw/                 # validated OHLCV CSV files
│   ├── models/deployment/        # manifests, active pointer, and artifacts
│   ├── operational/current.json  # complete approved operational batch
│   ├── production_history/       # issued three-model forecast ledger
│   ├── scripts/                  # exporters and validators
│   ├── services/                 # ingestion, forecasting, and deployment logic
│   └── tests/
├── frontend/
│   ├── public/forecasts/         # generated frontend data contract
│   ├── scripts/                  # frontend data and UI smoke tests
│   └── src/                      # Next.js App Router application
├── reports/run02-promotion/      # Run 02 operational review evidence
└── README.md
```

## Local setup

### Requirements

- Git
- Python 3.11
- Node.js 20 or a compatible current LTS release
- npm

### Clone the repository

```bash
git clone https://github.com/AlvinTubtub/pse-stock-price-forecast-corrected-research.git
cd pse-stock-price-forecast-corrected-research
```

### Create the Python environment

From the repository root:

```bash
python3.11 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
pip install -r backend/requirements-pipeline.txt
```

Use `backend/requirements-fast.txt` plus `backend/requirements-inference.txt` when reproducing the lighter daily CI environment.

### Install frontend dependencies

```bash
cd frontend
npm ci
```

The AI explanation endpoint is optional. To enable it locally:

```bash
cp .env.example .env.local
```

Set `GEMINI_API_KEY` in `frontend/.env.local`. Never commit the key.

## Run the frontend

From `frontend/`:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

To verify a production build:

```bash
npm run lint
npm run test:all
npm run build
npm run start
```

## Run the approved backend pipeline

Run commands from `backend/` with the repository virtual environment active.

### Daily official-data ingestion and inference

```bash
python run_pipeline.py --no-train
```

Despite the compatibility flag name, this command performs no model training. It ingests and validates official data, then runs inference with the single active persisted deployment. The operation publishes only a complete 15-company batch and preserves an existing same-target issuance.

Useful ingestion options:

```bash
python run_pipeline.py --no-download
python run_pipeline.py --no-inference
python run_pipeline.py --start-date 2026-09-01 --end-date 2026-09-08
```

Do not bypass calendar, freshness, approval, completeness, or manifest checks for production output.

### Export frontend artifacts

```bash
python scripts/export_forecast_artifacts.py
python -m scripts.validate_exports
```

The exporter writes generated files under `frontend/public/forecasts/`. Do not maintain forecast values through manual JSON edits; the next validated pipeline run will replace generated artifacts.

### Refresh an approved deployment

This is a separately authorized operation, not part of daily inference:

```bash
python -m services.model_selector --mode deployment-refresh --strict
```

Challenger retuning is also separate and must never automatically promote a model:

```bash
python -m services.model_selector --mode deployment-retune --symbols BPI
```

## Testing

### Backend

From `backend/`:

```bash
python -m pytest tests
python -m scripts.validate_exports
```

The backend suite covers data validation, production-history integrity, deployment refreshes, authorization scopes, artifact hashes, atomic activation, calendar behavior, and operational batches.

### Frontend

From `frontend/`:

```bash
npm run test:all
npm run lint
npm run build
```

The frontend tests cover formal model pages, comparison behavior, schema-v1/v2 manifests, manifest hashing, rejected invalid batches, company/dashboard overlays, and realized-only three-model graph history for all 15 companies.

## Automation

### Daily official-data and approved forecast refresh

`.github/workflows/update_pipeline.yml` is triggered by the `update-pse-data` repository dispatch or manually through GitHub Actions. The external schedule is Monday at 17:30 and Tuesday through Friday at 16:00 in Asia/Manila.

The workflow:

1. Checks the PSE trading calendar.
2. Installs the pinned fast and inference dependencies.
3. Runs official-data ingestion and approved persisted-model inference.
4. Exports and validates frontend artifacts.
5. Commits only when validated tracked artifacts changed.
6. Lets Vercel deploy the resulting `main` commit through Git integration.

### One-time approved model refresh

`.github/workflows/train_models.yml` has a date guard for November 3, 2026 UTC. It refits only approved frozen configurations, validates the versioned deployment, atomically updates the active pointer, exports the frontend artifacts, and commits the verified result. It does not perform challenger selection or alter the formal Run 02 study.

Both workflows share the `pse-pipeline` concurrency group so deployment refresh and inference cannot publish concurrently.

## Vercel deployment

The Vercel project uses `frontend/` as its Root Directory and deploys `main` through Git integration.

A successful Vercel build does not create a new forecast. Forecast values change only when a validated backend workflow commits new artifacts.

Production URL:

```text
https://frontend-ten-xi-11.vercel.app/
```

## Engineering rules

- Preserve the immutable formal study and all previously issued prediction values.
- Add actuals and errors only after official target-session data is available.
- Never issue a future-session forecast before its input session is complete and validated.
- Never mix companies, artifacts, or manifests across deployment versions.
- Never accept partial 15-company production batches.
- Never auto-promote a challenger or treat a deployment refresh as new formal evidence.
- Validate exports before committing or deploying them.
- Never commit credentials, tokens, or local environment files.

## Further documentation

- [Backend implementation guide](backend/README.md)
- [Historical Run 02 operational promotion review](reports/run02-promotion/REVIEW.md)
- [Completion report](COMPLETION_REPORT.md)
- [Model development audit and improvement report](Model_Development_Audit_and_Improvement_Report.docx)

## License and disclaimer

No license file is currently included in this repository. Unless a license is added, normal copyright restrictions apply.

ForecastPH is intended for research, education, and software demonstration. Historical performance does not guarantee future results. Users remain responsible for independent financial analysis and decisions.
