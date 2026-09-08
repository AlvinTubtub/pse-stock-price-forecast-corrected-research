# ForecastPH
[![Python 3.11](https://img.shields.io/badge/python-3.11-blue.svg)](https://www.python.org/downloads/release/python-3110/)
[![Next.js 14](https://img.shields.io/badge/Next.js-14-black.svg)](https://nextjs.org/)
[![Formal Study](https://img.shields.io/badge/Formal%20Study-FORMAL__CORRECTED__20260828__02-success.svg)](https://github.com/AlvinTubtub/pse-stock-price-forecast-corrected-research/releases/tag/formal-corrected-20260828-02)
[![Active Deployment](https://img.shields.io/badge/Deployment-Verified%20(Schema%20v2)-blueviolet.svg)](backend/models/deployment/active.json)
[![Dashboard Status](https://img.shields.io/badge/Production-Live-emerald.svg)](https://pse-stock-price-forecast-research.vercel.app/)
ForecastPH is a research and operational forecasting platform for next-session closing prices of 15 Philippine Stock Exchange (PSE) companies. It rigorously compares Lag-Informed Regression, ARIMA, and LSTM under a chronological, leakage-controlled evaluation design, serving authorized daily forecasts through a high-performance Next.js dashboard.
**Live Production Dashboard:** [pse-stock-price-forecast-research.vercel.app](https://pse-stock-price-forecast-research.vercel.app/)
> **Academic and Educational Notice:** ForecastPH is an academic and empirical research project. The outputs, forecasts, and statistical comparisons do not constitute financial, investment, or trading advice.
---
## Core Capabilities
- **Python 3.11 Backend**: End-to-end official data ingestion, cryptographic validation, formal research evaluation, persisted-model inference, and artifact generation.
- **Next.js 14 Frontend**: Responsive dashboard featuring company forecasts, model comparisons, historical backtest error charts, operational status telemetry, and interactive educational resources.
- **Immutable Formal Research (Run 02)**: Complete separation between frozen historical benchmark evidence (`FORMAL_CORRECTED_20260828_02`) and ongoing daily operational forecasts.
- **Audited Deployment System**: Versioned, hash-verified operational deployments governed by explicit authorization records and cryptographic checksums.
- **Automated Ingestion & Inference CI/CD**: GitHub Actions workflows for automated post-close market data ingestion, calendar validation, operational inference, export verification, and automatic Vercel synchronization.
---
## Tracked Companies
The platform tracks 15 representative equities across 5 principal PSE sectors:
| Sector | Ticker Symbols |
| :--- | :--- |
| **Financials** | `BPI`, `MBT`, `SECB` |
| **Industrial** | `JFC`, `MER`, `SHLPH` |
| **Property** | `ALI`, `MEG`, `SMPH` |
| **Services** | `GLO`, `ICT`, `PGOLD` |
| **Mining and Oil** | `APX`, `NIKL`, `SCC` |
---
## Models & Methodology
The formal research framework evaluates three principal model families against an essential evaluation benchmark:
1. **Lag-Informed Regression**: Utilizes chronologically selected returns lags with strict fold-local scaling and no future lookahead.
2. **ARIMA**: Leverages bounded candidate parameter grid selection and expanding-window validation. Walk-forward testing appends realized market observations without unapproved coefficient re-estimation.
3. **LSTM**: Deep recurrent neural architecture predicting closing price changes using fold-local feature normalization, internal validation early stopping, and accurate level reconstruction.
4. **Naive Baseline**: Carries forward the previous session's closing price. Serves strictly as a statistical benchmark, never as a deployment candidate.
### Operational Inference vs. Retraining
Operational production uses the approved model family and frozen configuration selected for each company. Daily inference runs strictly against persisted model weights (`.pkl` and `.pth`). It does not retrain models, retune hyperparameters, select alternative challengers, or mutate formal research artifacts.
---
## Strict Research & Operational Boundaries
ForecastPH maintains an absolute separation between research evaluation and live operations:
1. **Formal Run 02 Study**: An immutable research snapshot with a fixed data cutoff (`2026-08-28`), frozen code commit, and independently verifiable evidence archive:
   - **Formal Run ID**: `FORMAL_CORRECTED_20260828_02`
   - **Evidence Archive SHA-256**: `2b2ed0ca6b88ea6cfef5ac14013440da1c7c55c1d9f9640e04a595fdafca5d24`
   - **Formal Summary SHA-256**: `c0a5962709be16a82e5f5eeb634424ef0cad93a05d08db5c8af02e1d90ff5a6e`
   - **Release Evidence**: [formal-corrected-20260828-02](https://github.com/AlvinTubtub/pse-stock-price-forecast-corrected-research/releases/tag/formal-corrected-20260828-02)
   - **Frontend Artifact Path**: `frontend/public/forecasts/formal/FORMAL_CORRECTED_20260828_02.json`
2. **Issued Operational Forecasts**: Prospective next-session predictions tied directly to the issuing deployment version and manifest hash. Once issued, past predictions are immutable.
3. **Realized Actuals & Errors**: Official target-session closing prices and forecast errors are recorded only after the corresponding PSE trading session has officially completed.
---
## Operational Deployment System
Deployment governance resides under `backend/models/deployment/`:
```text
backend/models/deployment/
├── active.json               # Atomic pointer to the verified active deployment
├── approvals/                # Signed human and automated authorization records
├── current/                  # Local operational artifacts (legacy/backward compatibility)
└── versions/
    └── <DEPLOYMENT_VERSION>/
        ├── manifest.json     # Cryptographically sealed configuration & artifact hashes
        └── artifacts/        # Persisted weights (.pkl, .pth) for all 15 equities
Manifest Schema Generations
The platform explicitly validates two manifest generations:

Schema v1: Identifies deployment via promotion_id (e.g., historical Run 02 operational baseline).
Schema v2: Comprehensive deployment schema containing deployment_version, status (verified), explicit authorization scopes (production_inference, scheduled_refresh), runtime details, training cutoffs, configuration hashes, and individual model artifact SHA-256 checksums.
Frontend Manifest Separation
The frontend exposes two distinct views:

deployment.json: The specific manifest that issued the currently displayed forecast batch.
active-deployment.json: The active deployment currently authorized for future production inference.
A prospective forecast batch (operational.json) is accepted only when it exhibits complete 15-company coverage, authorized status, valid model mappings, and an exact matching manifest SHA-256 digest.

Forecast & Historical Backtest Charts
Every company dashboard renders the latest 60 realized target sessions across two visual modules:

Backtest: Predicted vs. Actual: Compares realized closes against historical out-of-sample predictions.
Forecast Error Over Time: Plots point prediction error (
Forecast Error
=
Predicted Close
−
Actual Close
Forecast Error=Predicted Close−Actual Close).
Realization Rules
Charts terminate at the latest official market session with confirmed closing data.
Lag-Informed Regression, ARIMA, and LSTM curves appear only when a genuine historical prediction exists for that target date.
Next-session pending forecasts are isolated in the Next-Day Prediction card and are never plotted on the historical realized curves.
Stored research evaluation data and prospective production forecasts are visually demarcated by a vertical production marker. No historical values are reconstructed in retrospect.
System Architecture
text


Official Daily PSE Quotation Reports (PDF / EDGE)
                       ↓
Validated OHLCV Records (backend/data/raw/)
                       ↓
Calendar & Freshness Gatekeeping (services/pse_calendar.py)
                       ↓
Persisted Model Inference using Active Deployment Manifest
                       ↓
Complete 15-Company Operational Batch + Production History Ledger
                       ↓
Cryptographic Export & Validation (frontend/public/forecasts/)
                       ↓
Next.js 14 Static / ISR Generation
                       ↓
Vercel Edge Deployment (Git Integration)
Note: Vercel never executes Python models or modifies forecast data. The frontend operates strictly as a static/client renderer of validated JSON artifacts committed to the repository.

Repository Structure
text


.
├── .github/workflows/
│   ├── update_pipeline.yml          # Daily market data ingestion and inference
│   └── train_models.yml             # Authorized one-time deployment refresh
├── backend/
│   ├── data/raw/                    # Validated official OHLCV CSV records
│   ├── models/deployment/           # Manifests, active pointer, approvals, versions
│   ├── operational/current.json     # Complete active 15-company operational batch
│   ├── production_history/          # Immutable historical issuance ledger
│   ├── scripts/                     # Artifact exporters and manifest validators
│   ├── services/                    # Calendar, ingestion, forecasting, and selection logic
│   └── tests/                       # Complete pytest test suite (274 tests)
├── frontend/
│   ├── public/forecasts/            # Generated frontend data artifacts
│   ├── scripts/                     # Data integrity and UI smoke tests
│   └── src/                         # Next.js 14 App Router application
├── reports/run02-promotion/         # Formal Run 02 operational review documentation
└── README.md
Local Setup & Development
Prerequisites
Git
Python 3.11
Node.js 20 LTS and npm
1. Clone the Repository
bash


git clone https://github.com/AlvinTubtub/pse-stock-price-forecast-corrected-research.git
cd pse-stock-price-forecast-corrected-research
2. Configure Python Environment
From the repository root:

bash


python3.11 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r backend/requirements-pipeline.txt
For lightweight daily inference verification, you may alternatively install backend/requirements-fast.txt and backend/requirements-inference.txt.

3. Configure Frontend Environment
From frontend/:

bash


cd frontend
npm ci
(Optional) Configure the Gemini AI explanation endpoint locally:

bash


cp .env.example .env.local
Add your GEMINI_API_KEY to frontend/.env.local (never commit API keys).

Running the Application
Frontend Development Server
From frontend/:

bash


npm run dev
Navigate to http://localhost:3000.

To run full frontend verification:

bash


npm run lint
npm run test:all
npm run build
Daily Ingestion and Inference Pipeline
From backend/ with the virtual environment activated:

bash


python run_pipeline.py --no-train
This command does not train models. It ingests official PSE market data, validates calendar schedules and price integrity, executes inference using the active deployment, updates the operational batch, and appends to the production history ledger.

Useful pipeline options:

bash


# Skip downloading; run inference using existing raw data
python run_pipeline.py --no-download
# Ingest data only; skip inference
python run_pipeline.py --no-inference
# Process specific date range
python run_pipeline.py --start-date 2026-09-01 --end-date 2026-09-08
Exporting and Validating Frontend Artifacts
bash


python scripts/export_forecast_artifacts.py
python -m scripts.validate_exports
Authorized Model Refreshes
Model refits are strictly separated from daily operational inference and require explicit authorization:

bash


# Strict refit of approved configurations (no retuning)
python -m services.model_selector --mode deployment-refresh --strict
# Controlled challenger retune (never auto-promoted)
python -m services.model_selector --mode deployment-retune --symbols BPI
Verification & Testing
Backend Test Suite
From backend/:

bash


python -m pytest tests
python -m scripts.validate_exports
The backend test suite covers data validation, calendar edge cases, production history ledger immutability, deployment refresh mechanics, manifest schema validation, SHA-256 integrity checks, and operational batch completeness.

Frontend Test Suite
From frontend/:

bash


npm run test:all
npm run lint
npm run build
Tests cover manifest schema handling (v1 and v2), statistical gatekeeping displays (Holm-corrected Diebold-Mariano tests), invalid batch rejections, company dashboard routing, and realized-only 60-session chart rendering across all 15 equities.

Automation & CI/CD
Daily Ingestion & Inference Workflow
.github/workflows/update_pipeline.yml executes on trading days via repository dispatch or manual trigger (Monday at 17:30, Tuesday–Friday at 16:00 Asia/Manila).

The workflow:

Validates the PSE trading calendar.
Ingests official quotation data and validates continuity.
Executes inference via persisted models in the active deployment.
Exports and validates frontend JSON artifacts.
Commits new artifacts to main only when validated changes exist.
Triggers Vercel Git deployment automatically.
Scheduled Refresh Guard
.github/workflows/train_models.yml includes an execution guard for November 3, 2026 UTC. It performs authorized frozen configuration refits without modifying formal research baselines.

Both workflows operate within the pse-pipeline concurrency group to prevent concurrent publishing.

Production Deployment
The production website is deployed on Vercel with frontend/ as the Root Directory, tracking the main branch.

Production URL:

text


https://pse-stock-price-forecast-research.vercel.app/
Core Engineering Rules
Preserve Immutable Research: Never overwrite formal run evidence (FORMAL_CORRECTED_20260828_02).
Cryptographic Traceability: All deployments must maintain verified manifest hashes and artifact digests.
No Lookahead / Leakage: Never issue a forecast for a target session before its input session has officially closed and been validated.
Completeness Invariant: Reject partial batches; operational publication requires valid predictions for all 15 equities.
Post-Market Error Evaluation: Actuals and errors are attached only after official market data is realized.
No Unaudited Auto-Promotion: Challenger retuning never automatically replaces an active production model.
License & Disclaimer
This project is licensed for research, academic, and demonstration purposes. Unless an explicit license is added, standard copyright restrictions apply.

ForecastPH provides statistical forecasts and empirical model comparisons for educational and research evaluation. Past performance and backtested metrics do not guarantee future stock price movements. Always consult licensed financial professionals before making investment decisions.
