# ForecastPH

**Cross-Sector Next-Day Stock Price Forecasting of Selected PSE-Listed Companies Using Lag-Informed Regression, ARIMA, and LSTM**
ForecastPH is a research and operational forecasting platform for next-session closing prices of 15 Philippine Stock Exchange companies. It compares Lag-Informed Regression, ARIMA, and LSTM under a chronological, leakage-controlled evaluation design, then serves approved forecasts through a static Next.js dashboard.

ForecastPH is a full-stack stock forecasting and research platform for selected companies listed on the Philippine Stock Exchange (PSE). It compares three forecasting approaches—**Lag-Informed Regression**, **ARIMA**, and **LSTM**—using a leakage-controlled, chronological, out-of-sample evaluation methodology.
Live dashboard: [frontend-ten-xi-11.vercel.app](https://frontend-ten-xi-11.vercel.app/)

The system provides next-trading-session forecasts, model evaluation metrics, interactive historical charts, 60-session backtests, forecast-error visualization, model comparison, an AI-assisted explanation layer, and an administrative management interface.
> ForecastPH is an academic and educational project. Its forecasts are not financial advice.

The repository contains both the **forecasting backend** and the **Next.js frontend** used for the deployed ForecastPH dashboard.
## What the repository contains

---
- A Python 3.11 backend for official-data ingestion, validation, formal research, persisted-model inference, and artifact export.
- A Next.js 14 frontend for company forecasts, model comparisons, historical charts, operational status, and educational content.
- An immutable formal Run 02 research result separated from rolling operational forecasts.
- Versioned, hash-checked operational deployments with explicit authorization scopes.
- GitHub Actions workflows for daily data/inference updates and one separately authorized model refresh.

## Table of Contents
## Tracked companies

- [Project Overview](#project-overview)
- [Research Objective](#research-objective)
- [Tracked Companies](#tracked-companies)
- [Forecasting Models](#forecasting-models)
- [Corrected Research Methodology](#corrected-research-methodology)
- [Model Evaluation](#model-evaluation)
- [Statistical Testing](#statistical-testing)
- [Backtest Methodology](#backtest-methodology)
- [Formal Research vs Deployment](#formal-research-vs-deployment)
- [System Architecture](#system-architecture)
- [Frontend Features](#frontend-features)
- [Admin Features](#admin-features)
- [Project Structure](#project-structure)
- [Installation](#installation)
- [Running the Backend](#running-the-backend)
- [Running the Frontend](#running-the-frontend)
- [Testing](#testing)
- [Forecast Artifact Generation](#forecast-artifact-generation)
- [Deployment Workflow](#deployment-workflow)
- [Scheduled Model Lifecycle](#scheduled-model-lifecycle)
- [Vercel Deployment](#vercel-deployment)
- [Important Methodology Notes](#important-methodology-notes)
- [Research Interpretation](#research-interpretation)
- [Technology Stack](#technology-stack)
- [Disclaimer](#disclaimer)

---

## Project Overview

ForecastPH is designed to support beginner and intermediate users who want to understand how different forecasting models behave across multiple sectors of the Philippine stock market.

The system separates computationally intensive forecasting from frontend delivery:

```text
PSE Market Data
      │
      ▼
Data Processing / Feature Engineering
      │
      ├── Lag-Informed Regression
      ├── ARIMA
      └── LSTM
      │
      ▼
Evaluation / Model Selection
      │
      ▼
Deployment Forecast Artifacts
      │
      ▼
frontend/public/forecasts/
      │
      ▼
Next.js Dashboard
      │
      ▼
Vercel
```

The frontend primarily consumes generated forecast artifacts rather than executing model training inside Vercel.

---

## Research Objective

The project evaluates whether different forecasting approaches provide different levels of next-day closing-price forecasting accuracy across selected PSE-listed companies and sectors.

The three principal forecasting models are:

1. **Lag-Informed Regression**
2. **ARIMA**
3. **Long Short-Term Memory (LSTM)**

A **Naive Baseline** is also included as a benchmark.

The primary forecasting target is:

```text
Next trading session closing price
```

The project does not assume that one model must be superior for every company.

---

## Tracked Companies

ForecastPH currently covers **15 PSE-listed companies across five sectors**.

| Sector | Companies |
|---|---|
| Sector | Symbols |
| --- | --- |
| Financials | BPI, MBT, SECB |
| Industrial | MER, JFC, SHLPH |
| Property | MEG, ALI, SMPH |
| Services | GLO, PGOLD, ICT |
| Mining & Oil | APX, NIKL, SCC |

Total:

```text
15 companies
5 sectors
3 principal forecasting models
1 naive benchmark
```

---

## Forecasting Models

### Lag-Informed Regression

The regression pipeline uses lag-based features derived from historical observations.

The corrected methodology includes:

- chronological training and validation;
- PACF applied to training-period daily returns;
- fold-specific PACF during rolling validation;
- feature selection without future leakage;
- `StandardScaler` fitted independently inside each rolling fold;
- no future information used in preprocessing;
- genuine out-of-sample prediction generation.

The model is designed to provide a comparatively interpretable statistical forecasting approach.

---

### ARIMA

ForecastPH uses AutoRegressive Integrated Moving Average models for univariate time-series forecasting.

The corrected ARIMA methodology includes:

- bounded ARIMA candidate search;
- chronological expanding-window validation;
- candidate completeness across validation folds;
- finite prediction validation;
- ADF-supported differencing prioritization;
- hold-out evaluation on unseen observations;
- convergence metadata recording;
- Ljung-Box diagnostics on formal hold-out forecast errors.

For walk-forward forecasting, the deployed implementation uses:

```python
append(actual, refit=False)
```

This updates the ARIMA model state using newly observed values while preserving the estimated coefficients.

Therefore, the methodology should be described as:

> One-step-ahead walk-forward forecasting with fixed estimated ARIMA parameters. At each forecast origin, the newly observed value updates the model state without re-estimating the ARIMA coefficients.

---

### LSTM

The formal LSTM implementation predicts **daily changes in closing price**, rather than directly fitting raw closing-price levels.

Key methodology:

- univariate `ΔClose` target;
- Min-Max scaling fitted using training data only;
- five-fold expanding-window cross-validation;
- fold-specific scaling;
- early stopping based only on an internal tail of the fold-training data;
- validation folds remain untouched by early stopping;
- original-price reconstruction before evaluation;
- hyperparameter selection using mean reconstructed-price RMSE;
- fresh final model refit after hyperparameter selection;
- frozen hold-out evaluation.

Hyperparameter grid:

| Parameter | Values |
|---|---|
| Lookback | 5, 10, 20, 30 |
| Hidden units | 25, 50, 100 |
| Learning rate | 0.01, 0.001 |
| Batch size | 16, 32 |

Total configurations:

```text
4 × 3 × 2 × 2 = 48
```

With five validation folds:

```text
48 × 5 = 240 cross-validation fits per company
```

A fresh final LSTM is then fitted after hyperparameter selection.

Maximum epochs:

```text
200
```

Early-stopping patience:

```text
10
```

Random seed:

```text
42
```

---

## Corrected Research Methodology

ForecastPH separates:

```text
development data
```

from:

```text
formal hold-out data
```

using chronological splitting.

The formal methodology uses approximately:

```text
85% development
15% hold-out
```

No random train/test shuffling is used.

The final audited formal evaluation uses **target-date alignment**, ensuring that all forecasting models are evaluated against the same observations.

For each company:

```text
Lag-Informed Regression
ARIMA
LSTM
Naive Baseline
```

must share the same formal hold-out target dates.

This prevents misleading comparisons caused by evaluating models on different subsets of the test period.

---

## Model Evaluation

ForecastPH reports the following forecasting metrics.

### RMSE

Root Mean Squared Error:

```text
Lower = better
```

RMSE gives greater weight to relatively large forecast errors.

---

### MAE

Mean Absolute Error:

```text
Lower = better
```

MAE represents the average absolute difference between predicted and actual closing prices.

---

### MASE

Mean Absolute Scaled Error compares model forecast error with an in-sample naive benchmark scale.

Interpretation:

```text
MASE < 1  → test-set MAE is lower than in-sample naive error scale
MASE = 1  → test-set MAE is approximately equal to in-sample naive scale
MASE > 1  → test-set MAE is larger than in-sample naive scale
```

A common development-period naive MAE denominator is used per company so models remain comparable. Note that MASE < 1 indicates lower error relative to this in-sample baseline scale; it does not by itself establish statistically significant outperformance over the holdout Naive forecast, which requires formal hypothesis testing (Diebold-Mariano test with Holm correction).

---

### R²

R² is provided as a supplementary goodness-of-fit measure.

It must **not** be interpreted as forecast confidence or prediction probability.

---

## Statistical Testing

ForecastPH includes formal statistical testing in addition to descriptive error metrics.

### Level 1: Model vs Naive Baseline
| Industrial | JFC, MER, SHLPH |
| Property | ALI, MEG, SMPH |
| Services | GLO, ICT, PGOLD |
| Mining and Oil | APX, NIKL, SCC |

Each principal model is tested against the naive benchmark.
## Models

Primary loss:
The formal study evaluates three principal model families and one benchmark:

```text
Squared forecast error
```

Robustness loss:

```text
Absolute forecast error
```

Testing includes:

- Diebold-Mariano testing;
- Newey-West HAC variance;
- Harvey-Leybourne-Newbold correction;
- Holm multiple-comparison correction.

Only models that significantly outperform the Naive Baseline in the predefined favorable direction can proceed to the principal pairwise comparison stage.

---

### Level 2: Principal Model Comparison

Pairwise principal-model comparisons are performed only when at least two models pass the Naive gate for a company.

This prevents declaring one sophisticated model superior to another when neither can establish evidence of improvement over the baseline.

---

### Moving-Block Bootstrap

ForecastPH also applies moving-block bootstrap procedures to preserve temporal dependence.

Configuration:

```text
Bootstrap repetitions: 5000
Random seed: 42
```

---

### Across-Company Comparison

Unrounded company-level MASE values are used for overall model comparison.

Models included:

```text
Lag-Informed Regression
ARIMA
LSTM
Naive Baseline
```

The analysis uses:

1. Friedman rank test;
2. fixed-seed permutation robustness testing;
3. Wilcoxon post-hoc testing only when the overall test is significant;
4. Holm correction for multiple comparisons.

This avoids unnecessary post-hoc inference when the global null hypothesis is not rejected.

---

## Backtest Methodology

The dashboard contains:

### Backtest: Predicted vs. Actual — Last 60 Sessions

The chart must display genuine historical out-of-sample forecasts rather than reconstructed or artificially shifted values.

Correct data flow:

```text
chronological historical observations
        │
        ▼
genuine OOS / walk-forward forecasts
        │
        ▼
target-date alignment
        │
        ▼
common sessions across models
        │
        ▼
latest 60 common trading sessions
        │
        ▼
frontend JSON
        │
        ▼
Vercel chart
```

The frontend consumes:

```text
backtestDates
backtestActual
backtestByModel
```

from:

```text
frontend/public/forecasts/company/<SYMBOL>.json
```

These fields should be generated automatically by the backend artifact exporter.

They should **not be maintained through manual JSON editing**.

---

### Forecast Error Over Time

Forecast Error Over Time must use the exact same aligned observations used by the 60-session backtest.

The error definition is:

```text
Forecast Error = Actual Close - Predicted Close
```

Therefore:

```text
positive error → model predicted below actual
negative error → model predicted above actual
zero error     → exact prediction
```

Both charts must share:

- identical dates;
- identical actual closing prices;
- identical model prediction arrays;
- identical out-of-sample methodology.

---

## Formal Research vs Deployment

ForecastPH deliberately separates immutable research evidence from operational forecasting.

### Formal Research Artifacts
- Lag-Informed Regression uses chronologically selected return lags and fold-local scaling.
- ARIMA uses bounded candidate selection and expanding-window validation. Walk-forward updates append newly observed values without re-estimating fixed coefficients.
- LSTM predicts changes in closing price with fold-local scaling, internal early stopping, and reconstruction to price levels.
- Naive Baseline is an evaluation benchmark, not a deployment candidate.

Formal research runs are stored under:
The operational deployment uses the approved model family and frozen configuration for each company. Daily inference loads persisted artifacts; it does not train, retune challengers, select models, or alter the formal study.

```text
backend/results/formal/<RUN_ID>/
```
## Research and operational boundaries

Example structure:
ForecastPH keeps three kinds of evidence separate:

```text
backend/results/formal/<RUN_ID>/
├── split_manifest.json
├── methodology_manifest.json
├── data_manifest.json
├── statistical_tests.json
├── finalized.json
└── per_company/
    └── <SYMBOL>/
        ├── holdout_predictions.csv
        ├── metrics.json
        └── diagnostics.json
```
1. The formal Run 02 study is an immutable research snapshot with a fixed data cutoff and holdout evaluation.
2. Issued operational forecasts are immutable predictions tied to their original deployment and manifest hash.
3. Actual closing prices and forecast errors are attached only after the corresponding official target-session observation becomes available.

Formal runs are intended to be:
The approved formal run is `FORMAL_CORRECTED_20260828_02`. Its frontend artifact is stored at:

```text
immutable
reproducible
auditable
frontend/public/forecasts/formal/FORMAL_CORRECTED_20260828_02.json
```

Once finalized, they should not be modified by normal deployment operations.
Normal data updates, inference, deployment refreshes, and frontend builds must not rewrite this formal artifact.

Finalization also requires complete tuning and policy evidence: all 48 LSTM
configurations across five folds and three seeds, the complete expanded LASSO
alpha grid with a non-boundary winner, and the raw-Close corporate-action
policy. Valid observations remain in the primary analysis. Verified event
dates, when available, are flagged by forecast target date and used only in a
separate sensitivity analysis; observations are never removed merely because
the model error or price movement is large.
## Operational deployments

---
Deployment state lives under:

### Deployment Artifacts

Operational models are separate from formal research artifacts.

Versioned layout:

```text
backend/models/deployment/
├── active.json
├── approvals/
├── versions/<DEPLOYMENT_VERSION>/
│   ├── artifacts/
│   └── manifest.json
└── current/  # superseded record retained for audit
├── current/
└── versions/<DEPLOYMENT_VERSION>/
    ├── manifest.json
    └── artifacts/
```

Deployment models may be retrained according to the production schedule.
The active pointer is changed atomically only after a complete deployment passes validation. A deployment contains all 15 approved company configurations and the persisted artifact for each selected model family.

Formal artifacts are evidence for the research study.
The frontend explicitly supports both manifest generations:

Deployment artifacts are used for live forecasts.
- Schema v1 identifies the historical deployment with `promotion_id`.
- Schema v2 identifies a versioned deployment with `deployment_version`, verified status, approval scopes, artifact hashes, configuration hashes, and training cutoffs.

These two concerns must not be mixed.
The frontend exports two deployment views:

---

## System Architecture
- `deployment.json` is the manifest that issued the currently displayed forecast batch.
- `active-deployment.json` is the deployment currently authorized for production inference.

```text
                     ┌─────────────────────┐
                     │   PSE Market Data   │
                     └─────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │ Data Ingestion       │
                    │ & Preprocessing      │
                    └──────────┬───────────┘
                               │
             ┌─────────────────┼─────────────────┐
             │                 │                 │
             ▼                 ▼                 ▼
      ┌────────────┐    ┌────────────┐    ┌────────────┐
      │ Lag-Reg    │    │   ARIMA    │    │    LSTM    │
      └──────┬─────┘    └──────┬─────┘    └──────┬─────┘
             │                 │                 │
             └─────────────────┼─────────────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │ Evaluation           │
                    │ RMSE / MAE / MASE    │
                    │ R² / Statistical     │
                    │ Testing              │
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │ Deployment Artifacts │
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │ JSON Export          │
                    └──────────┬───────────┘
                               │
                               ▼
               frontend/public/forecasts/
                               │
                               ▼
                    ┌──────────────────────┐
                    │ Next.js Frontend     │
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │       Vercel         │
                    └──────────────────────┘
```
These versions can differ. Existing forecasts remain tied to their issuing deployment, while the active deployment is used for the next eligible issuance. `operational.json` is accepted only when its deployment identity, complete 15-company coverage, authorization state, model mapping, and exact issuing-manifest SHA-256 are valid.

---
## Forecast and error charts

## Frontend Features
Company pages display the latest 60 realized target sessions in both **Backtest: Predicted vs. Actual** and **Forecast Error Over Time**.

ForecastPH includes:
- The graphs end at the latest target session with an official actual close.
- Lag-Informed Regression, ARIMA, and LSTM are shown when the issued three-model snapshot exists for that target date.
- Pending next-session forecasts are shown in the Next-Day Prediction section, not in either realized-history graph.
- Forecast error is calculated as predicted close minus actual close.
- The production marker separates stored evaluation observations from prospective issued forecasts.

- company overview pages;
- sector pages;
- model-performance comparison;
- historical OHLCV visualization;
- next-day prediction chart;
- Backtest: Predicted vs. Actual;
- Forecast Error Over Time;
- latest 60-session visualization;
- Naive Baseline comparison;
- RMSE, MAE, MASE, and R²;
- selected-model indicators;
- interactive chart controls;
- dark and light themes;
- responsive dashboard layout;
- beginner-oriented explanations;
- Learn Stocks page;
- About page;
- AI assistant;
- starter questions.
No missing historical forecast is reconstructed after the fact. No future actual or error is fabricated.

Chart interactions include:
## Architecture

```text
+             Zoom In
−             Zoom Out
Box Zoom      Select chart range
Pan           Move horizontally
Reset         Restore full view
Mouse Wheel   Zoom
Mouse Drag    Pan
Double Click  Reset view
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

---

## Admin Features

The ForecastPH administrative interface provides management functionality separate from the public dashboard.
Vercel does not run Python models. The frontend reads checked-in JSON artifacts and never trains models or writes forecast data.

Administrative areas may include:
## Repository layout

```text
/admin
/admin/models
/admin/audit
/admin/calendar
/admin/ai
/admin/pipeline
```

The admin system supports configuration such as:

- site configuration;
- content configuration;
- navigation;
- frontend feature toggles;
- AI assistant configuration;
- pipeline status;
- model information;
- PSE calendar management;
- health monitoring;
- audit information;
- manual pipeline controls.

Configuration may be persisted in PostgreSQL rather than static frontend configuration files.

---

## Project Structure

A simplified repository structure:

```text
pse-stock-price-forecast/
│
.
├── .github/workflows/
│   ├── update_pipeline.yml       # daily official data and approved inference
│   └── train_models.yml          # separately authorized one-time refresh
├── backend/
│   ├── data/
│   ├── models/
│   │   └── deployment/
│   │       └── current/
│   ├── results/
│   │   └── formal/
│   ├── scripts/
│   │   └── export_forecast_artifacts.py
│   ├── services/
│   │   ├── forecasting/
│   │   ├── evaluation.py
│   │   └── ...
│   ├── tests/
│   └── requirements.txt
│
│   ├── data/raw/                 # validated OHLCV CSV files
│   ├── models/deployment/        # manifests, active pointer, and artifacts
│   ├── operational/current.json  # complete approved operational batch
│   ├── production_history/       # issued three-model forecast ledger
│   ├── scripts/                  # exporters and validators
│   ├── services/                 # ingestion, forecasting, and deployment logic
│   └── tests/
├── frontend/
│   ├── public/
│   │   └── forecasts/
│   │       └── company/
│   ├── src/
│   │   ├── app/
│   │   ├── components/
│   │   └── lib/
│   ├── package.json
│   └── next.config.*
│
├── .github/
│   └── workflows/
│
├── README.md
└── ...
│   ├── public/forecasts/         # generated frontend data contract
│   ├── scripts/                  # frontend data and UI smoke tests
│   └── src/                      # Next.js App Router application
├── reports/run02-promotion/      # Run 02 operational review evidence
└── README.md
```

Exact internal paths may vary as the project evolves.
## Local setup

---
### Requirements

## Installation
- Git
- Python 3.11
- Node.js 20 or a compatible current LTS release
- npm

### Prerequisites

Recommended:
### Clone the repository

```text
Python 3.11
Node.js
npm
Git
```

Clone the repository:

```bash
git clone https://github.com/AlvinTubtub/pse-stock-price-forecast.git
cd pse-stock-price-forecast
git clone https://github.com/AlvinTubtub/pse-stock-price-forecast-corrected-research.git
cd pse-stock-price-forecast-corrected-research
```

---

## Running the Backend
### Create the Python environment

Move to the backend:
From the repository root:

```bash
cd backend
```

Create a virtual environment:

```bash
python3.11 -m venv .venv
```

Activate it on macOS/Linux:

```bash
source .venv/bin/activate
```

On Windows PowerShell:

```powershell
.venv\Scripts\Activate.ps1
```

Upgrade pip:

```bash
python -m pip install --upgrade pip
```

Install backend dependencies:

```bash
pip install -r requirements.txt
pip install -r backend/requirements-pipeline.txt
```

---

## Running the Frontend
Use `backend/requirements-fast.txt` plus `backend/requirements-inference.txt` when reproducing the lighter daily CI environment.

From the project root:
### Install frontend dependencies

```bash
cd frontend
npm ci
```

Install dependencies:
The AI explanation endpoint is optional. To enable it locally:

```bash
npm install
cp .env.example .env.local
```

Run development mode:

```bash
npm run dev
```

Then open:

```text
http://localhost:3000
```
Set `GEMINI_API_KEY` in `frontend/.env.local`. Never commit the key.

---

## Testing
## Run the frontend

Backend tests should be executed before deployment or methodology changes are merged.

From:

```text
backend/
```

run:
From `frontend/`:

```bash
.venv/bin/python -m pytest -q
```

or, with the virtual environment activated:

```bash
python -m pytest -q
npm run dev
```

The full automated test suite covers forecasting, artifact handling, statistical evaluation, diagnostics, and methodology-related safeguards.
Open [http://localhost:3000](http://localhost:3000).

Also useful:

```bash
python -m compileall -q services scripts
```

From the repository root:
To verify a production build:

```bash
git diff --check
```

---

## Forecast Artifact Generation

The Vercel frontend does not independently calculate the forecasting results shown in company pages.

Forecast artifacts are generated by the backend and exported to:

```text
frontend/public/forecasts/
```

Company-level output:

```text
frontend/public/forecasts/company/<SYMBOL>.json
```

Typical company JSON fields may include:

```json
{
  "symbol": "BPI",
  "dataAsOf": "YYYY-MM-DD",
  "forecastDate": "YYYY-MM-DD",
  "previousClose": 0,
  "predictedClose": 0,
  "model": "ARIMA",
  "metrics": {},
  "nextClose": {},
  "backtestDates": [],
  "backtestActual": [],
  "backtestByModel": {}
}
```

The exact structure is determined by the exporter.

The export path includes:

```text
backend/scripts/export_forecast_artifacts.py
```

Generated frontend JSON should be treated as a **presentation artifact**, not the authoritative model-training source.

Do not manually edit forecast values as a long-term solution because generated files may be overwritten by subsequent pipeline runs.

The Models page deliberately separates two datasets:

- **Formal Study Results** come from the immutable approved run
  `FORMAL_CORRECTED_20260828_02`, with data through August 28, 2026.
- **Operational Forecasts** come from the rolling daily pipeline and target the
  next PSE trading session. They may change as new validated observations arrive.

The daily pipeline never recomputes or overwrites the formal-study dataset.

---

## Deployment Workflow

The intended live forecasting workflow is:

```text
1. Obtain newest PSE market data
2. Validate and preprocess data
3. Update deployment dataset
4. Use the single active persisted deployment for inference
5. Generate next-session predictions
6. Generate deployment backtests
7. Align backtest target dates
8. Select latest 60 common sessions
9. Export frontend JSON
10. Publish updated artifacts
11. Redeploy / refresh Vercel
```

This ensures the dashboard reflects backend-generated results rather than manually modified frontend data.

---

## Scheduled Model Lifecycle

ForecastPH separates model retraining from normal daily forecasting.

### One-Time Deployment Refitting

Scheduled:

```text
November 3, 2026 — 8:00 AM PHT
```

The scheduled refresh should:

```text
latest main branch
→ corrected deployment methodology
→ refit the already approved configurations
→ updated deployment metadata
```

This job does not rerun the formal experiment, retune hyperparameters, or
automatically promote challengers. Retuning is a separate researcher-initiated
process and should normally wait for substantially more prospective evidence
(approximately 60 new sessions unless a predeclared drift trigger is met).
The workflow has a 2026 date guard. After that date, refreshes require a new,
explicitly reviewed authorization and workflow change; no recurring refresh is implied.

---

### Daily Market Processing / Inference

The forecasting pipeline may run after the relevant PSE trading-session data becomes available.

The production process should use the newest validated market observations and the latest deployment models.

Daily inference should not modify finalized formal research runs.

---

## Vercel Deployment

Vercel serves the Next.js frontend.

A typical update cycle is:

```text
backend pipeline
→ updated frontend-readable artifacts
→ GitHub main
→ Vercel deployment
→ updated public dashboard
npm run lint
npm run test:all
npm run build
npm run start
```

A Vercel redeployment alone does **not** recalculate forecasts.
## Run the approved backend pipeline

If the generated forecast JSON has not changed, a new Vercel build can still display the same forecast values.
Run commands from `backend/` with the repository virtual environment active.

Therefore:
### Daily official-data ingestion and inference

```text
corrected source code
≠ automatically corrected live forecast artifacts
```bash
python run_pipeline.py --no-train
```

The full live update requires:

```text
corrected code
+ regenerated deployment results
+ regenerated frontend JSON
+ published artifacts
+ Vercel refresh/deployment
```
Despite the compatibility flag name, this command performs no model training. It ingests and validates official data, then runs inference with the single active persisted deployment. The operation publishes only a complete 15-company batch and preserves an existing same-target issuance.

---
Useful ingestion options:

## Important Methodology Notes

### No Random Train/Test Shuffle

Financial time series must maintain chronological order.

The methodology therefore avoids random train/test splitting.

---

### No Future Leakage

Preprocessing that learns parameters from data must be fitted only using information available at the corresponding forecast origin.

Examples include:

```text
scalers
PACF-based lag selection
feature selection
LSTM normalization
```bash
python run_pipeline.py --no-download
python run_pipeline.py --no-inference
python run_pipeline.py --start-date 2026-09-01 --end-date 2026-09-08
```

---

### No Backfilling From Future Observations

Formal backtests must not use future observations to fill unavailable historical feature values.

Backtests should be genuine historical forecasts.

---

### Common Target Dates
Do not bypass calendar, freshness, approval, completeness, or manifest checks for production output.

All models being compared must predict the same target sessions.
### Export frontend artifacts

Model arrays must not simply be truncated to the same length without checking dates.

Correct comparison requires:

```text
date-indexed alignment
```bash
python scripts/export_forecast_artifacts.py
python -m scripts.validate_exports
```

---

### Naive Baseline

The Naive Baseline assumes:

```text
Tomorrow's close = Today's close
```
The exporter writes generated files under `frontend/public/forecasts/`. Do not maintain forecast values through manual JSON edits; the next validated pipeline run will replace generated artifacts.

It is included as a meaningful forecasting benchmark.
### Refresh an approved deployment

A complex forecasting model should not automatically be considered useful simply because it produces predictions.
This is a separately authorized operation, not part of daily inference:

---

### Model Selection

The lowest RMSE principal model can be reported descriptively for each company.

However, descriptive RMSE ranking must be distinguished from formal statistical evidence.

A model can have the lowest RMSE without demonstrating statistically significant superiority.

---

### Full Precision

Evaluation calculations should preserve full numeric precision.

Rounding belongs in the frontend presentation layer.

---

### RSI Edge Cases

RSI feature calculation should correctly handle:

```text
gain-only periods → near 100
loss-only periods → 0
flat periods      → neutral 50
```

---

## Research Interpretation

Correcting the methodology improves the **validity, reproducibility, and comparability** of the forecasting experiment.

It can also improve model selection because hyperparameters and models are chosen using more defensible out-of-sample procedures.

However:

> Methodological correction does not guarantee that every corrected forecast will have a lower error than every forecast generated under the previous implementation.

Forecast accuracy remains an empirical result.

The correct interpretation is:

```text
Better methodology
→ more trustworthy evaluation
→ better protection against leakage and optimistic bias
→ more defensible model selection
→ potentially better generalization
```bash
python -m services.model_selector --mode deployment-refresh --strict
```

not:

```text
Better methodology
→ guaranteed perfect or universally superior forecasts
```

Financial markets remain noisy and affected by information unavailable to purely historical forecasting models.

---

## Formal Audit Principles

The audited implementation is designed around the following principles:
Challenger retuning is also separate and must never automatically promote a model:

```text
✓ chronological evaluation
✓ common hold-out dates
✓ genuine out-of-sample predictions
✓ no array-length truncation as alignment
✓ fold-specific preprocessing
✓ training-only scaling
✓ fold-specific PACF
✓ proper LSTM validation separation
✓ fresh LSTM final refit
✓ original-scale model selection
✓ strict ARIMA candidate validation
✓ ARIMA convergence recording
✓ date-indexed Naive baseline
✓ Naive-first statistical gatekeeping
✓ DM testing with HAC / HLN correction
✓ Holm multiple-testing correction
✓ moving-block bootstrap
✓ Friedman overall comparison
✓ conditional Wilcoxon post-hoc testing
✓ unrounded statistical calculations
✓ residual diagnostics
✓ formal/deployment artifact separation
✓ immutable finalized research runs
✓ reproducible metadata and manifests
```bash
python -m services.model_selector --mode deployment-retune --symbols BPI
```

---
## Testing

## Reproducibility
### Backend

Formal evaluation runs should contain enough information to identify:
From `backend/`:

- dataset version;
- data cutoff;
- company universe;
- train/hold-out split;
- model configuration;
- dependencies;
- source-code commit;
- statistical settings;
- generated artifacts;
- artifact SHA-256 hashes.

A finalized formal run should therefore represent a reproducible research snapshot rather than a continuously changing deployment output.

---

## Technology Stack

### Backend

```text
Python
Pandas
NumPy
scikit-learn
statsmodels
PyTorch
SciPy
```bash
python -m pytest tests
python -m scripts.validate_exports
```

### Forecasting

```text
Lag-Informed Regression
ARIMA
LSTM
Naive Baseline
```
The backend suite covers data validation, production-history integrity, deployment refreshes, authorization scopes, artifact hashes, atomic activation, calendar behavior, and operational batches.

### Frontend

```text
Next.js
React
TypeScript
Tailwind CSS
Recharts
From `frontend/`:

```bash
npm run test:all
npm run lint
npm run build
```

### Infrastructure
The frontend tests cover formal model pages, comparison behavior, schema-v1/v2 manifests, manifest hashing, rejected invalid batches, company/dashboard overlays, and realized-only three-model graph history for all 15 companies.

```text
GitHub
GitHub Actions
Vercel
PostgreSQL / Neon
```
## Automation

---
### Daily official-data and approved forecast refresh

## Research Scope
`.github/workflows/update_pipeline.yml` is triggered by the `update-pse-data` repository dispatch or manually through GitHub Actions. The external schedule is Monday at 17:30 and Tuesday through Friday at 16:00 in Asia/Manila.

ForecastPH is designed for next-trading-session closing-price forecasting using historical market data.
The workflow:

The project does not attempt to predict every possible market-moving event.
1. Checks the PSE trading calendar.
2. Installs the pinned fast and inference dependencies.
3. Runs official-data ingestion and approved persisted-model inference.
4. Exports and validates frontend artifacts.
5. Commits only when validated tracked artifacts changed.
6. Lets Vercel deploy the resulting `main` commit through Git integration.

Unexpected factors may include:
### One-time approved model refresh

- macroeconomic announcements;
- company disclosures;
- earnings surprises;
- political developments;
- geopolitical shocks;
- regulatory actions;
- natural disasters;
- changes in investor sentiment;
- abnormal liquidity;
- extraordinary corporate events.
`.github/workflows/train_models.yml` has a date guard for November 3, 2026 UTC. It refits only approved frozen configurations, validates the versioned deployment, atomically updates the active pointer, exports the frontend artifacts, and commits the verified result. It does not perform challenger selection or alter the formal Run 02 study.

These limitations should be considered when interpreting any model forecast.
Both workflows share the `pse-pipeline` concurrency group so deployment refresh and inference cannot publish concurrently.

---
## Vercel deployment

## Disclaimer
The Vercel project uses `frontend/` as its Root Directory and deploys `main` through Git integration.

ForecastPH is an academic and educational forecasting system.
A successful Vercel build does not create a new forecast. Forecast values change only when a validated backend workflow commits new artifacts.

The forecasts, model rankings, backtests, statistical results, and dashboard outputs are provided for:
Production URL:

```text
research
education
model comparison
data-analysis demonstration
https://frontend-ten-xi-11.vercel.app/
```

They are **not financial advice**, investment recommendations, trading signals, or guarantees of future market performance.

Stock prices are inherently uncertain, and historical predictive performance does not guarantee future results.
## Engineering rules

Users should conduct independent research and consult qualified financial professionals before making investment decisions.

---

## Repository
- Preserve the immutable formal study and all previously issued prediction values.
- Add actuals and errors only after official target-session data is available.
- Never issue a future-session forecast before its input session is complete and validated.
- Never mix companies, artifacts, or manifests across deployment versions.
- Never accept partial 15-company production batches.
- Never auto-promote a challenger or treat a deployment refresh as new formal evidence.
- Validate exports before committing or deploying them.
- Never commit credentials, tokens, or local environment files.

```text
https://github.com/AlvinTubtub/pse-stock-price-forecast
```
## Further documentation

---
- [Backend implementation guide](backend/README.md)
- [Run 02 operational promotion review](reports/run02-promotion/REVIEW.md)
- [Completion report](COMPLETION_REPORT.md)
- [Model development audit and improvement report](Model_Development_Audit_and_Improvement_Report.docx)

## Project
## License and disclaimer

**ForecastPH**
No license file is currently included in this repository. Unless a license is added, normal copyright restrictions apply.

> Cross-Sector Next-Day Stock Price Forecasting of Selected PSE-Listed Companies: A Comparative Study of Lag-Informed Regression, ARIMA, and LSTM.
ForecastPH is intended for research, education, and software demonstration. Historical performance does not guarantee future results. Users remain responsible for independent financial analysis and decisions.
