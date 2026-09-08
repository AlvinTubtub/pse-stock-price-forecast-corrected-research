# ForecastPH
**Cross-Sector Next-Day Stock Price Forecasting of Selected PSE-Listed Companies**  
*A Comparative Study of Lag-Informed Regression, ARIMA, and LSTM with Operational Prospective Deployment*
[![Daily Ingestion & Inference](https://github.com/AlvinTubtub/pse-stock-price-forecast-corrected-research/actions/workflows/update_pipeline.yml/badge.svg)](https://github.com/AlvinTubtub/pse-stock-price-forecast-corrected-research/actions/workflows/update_pipeline.yml)
[![Live Website](https://img.shields.io/badge/Live%20Website-pse--stock--price--forecast.vercel.app-00DC82?style=flat&logo=vercel)](https://pse-stock-price-forecast.vercel.app/)
[![Python 3.11](https://img.shields.io/badge/Python-3.11-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![Next.js 14](https://img.shields.io/badge/Next.js-14.2-black?logo=next.js&logoColor=white)](https://nextjs.org/)
[![Formal Run](https://img.shields.io/badge/Formal%20Audit-FORMAL__CORRECTED__20260828__02-blueviolet)](https://github.com/AlvinTubtub/pse-stock-price-forecast-corrected-research/releases/tag/formal-corrected-20260828-02)
ForecastPH is an academic and operational forecasting platform for next-session closing prices across 15 high-liquidity companies listed on the Philippine Stock Exchange (PSE). It rigorously contrasts **Lag-Informed Regression (LASSO)**, **ARIMA**, and **LSTM** under strict chronological, leakage-controlled evaluation protocols, and serves automated daily prospective forecasts via a high-performance, dark-themed Next.js dashboard.
> **Disclaimer:** ForecastPH is developed strictly for research, academic evaluation, and software demonstration purposes. Its forecasts, metrics, and educational AI responses are not financial advice, investment recommendations, or guarantees of future market performance.
---
## Live Application
- **Production Dashboard:** [https://pse-stock-price-forecast.vercel.app/](https://pse-stock-price-forecast.vercel.app/)
- **Audited Evidence Release:** [Release formal-corrected-20260828-02](https://github.com/AlvinTubtub/pse-stock-price-forecast-corrected-research/releases/tag/formal-corrected-20260828-02)
---
## Key Features
1. **Strict Research & Operational Boundaries**:
   - **Frozen Formal Study (`FORMAL_CORRECTED_20260828_02`)**: Immutable pre-promotion baseline with identical out-of-sample holdout periods (Sep 2, 2025 to Aug 28, 2026; 243 pairs per company).
   - **Prospective Operational Tracking**: Verifiable post-promotion forward-testing starting Sep 7, 2026. Daily forecasts are issued before market open and locked in an append-only ledger before actuals are attached.
2. **Canonical Unified Deployment System**:
   - All 45 verified model configurations (`lag_reg`, `arima`, `lstm`) across 15 PSE equities are maintained in one authoritative manifest: `backend/models/deployment/current/deployment_manifest.json` (SHA-256: `1182b54f...`).
3. **Decoupled Workflows**:
   - **Daily Inference (`infer_daily`)**: Runs after market close on PSE trading sessions. Uses persisted approved model artifacts only; never fits parameters, tunes hyperparameters, or modifies formal study metrics.
   - **Scheduled Refresh (`scheduled_refresh`)**: Controlled, atomic refitting of approved model architectures without hyperparameter drift or challenger auto-promotion.
4. **Methodology-Aligned Statistical Evaluation**:
   - Diebold-Mariano tests with Harvey-Leybourne-Newbold (HLN) small-sample corrections and Holm-Bonferroni Family-Wise Error Rate (FWER) control.
   - Clear scientific separation between scale-adjusted error ($MASE < 1.0$) and true statistical outperformance over the holdout Naive persistence benchmark.
5. **Interactive Next.js Dashboard**:
   - Full candlestick OHLCV charts with volume indicators.
   - Synchronized 60-session backtest visualizations displaying audited holdout data alongside verified live prospective forecasts.
   - Integrated Gemini-powered AI Assistant (`gemini-3.5-flash-lite` with `gemini-3.5-flash` resilience) configured with strict research guardrails.
---
## Tracked Companies Universe
ForecastPH monitors 15 high-liquidity PSE equities across 5 sectors:
| Sector | Tickers | Description |
| :--- | :--- | :--- |
| **Financials** | `BPI`, `MBT`, `SECB` | Banking, commercial lending, and financial institutions |
| **Industrial** | `JFC`, `MER`, `SHLPH` | Food service, power utility distribution, and energy |
| **Property** | `ALI`, `MEG`, `SMPH` | Real estate development, malls, and commercial leasing |
| **Services** | `GLO`, `ICT`, `PGOLD` | Telecommunications, international port management, and retail |
| **Mining & Oil** | `APX`, `NIKL`, `SCC` | Precious metals, nickel extraction, and energy resources |
---
## Forecasting Models & Formal Evaluation
### Model Implementations
- **Lag-Informed Regression**: Feature-engineered linear model combining PACF-selected return lags, rolling return means/volatilities, Bollinger Bands, RSI, MACD, and volume indicators. Fold-isolated `StandardScaler` prevents temporal data leakage.
- **ARIMA**: State-space autoregressive integrated moving average with bounded search over $(p, d, q)$ and trend parameters. Daily operational updates append newly observed prices via `model.append(..., refit=False)` without re-estimating coefficients.
- **LSTM**: Recurrent neural network modeling normalized price deltas with fold-isolated `MinMaxScaler`, internal validation early stopping, and residual reconstruction to nominal price levels.
- **Naive Baseline**: One-step persistence model ($\hat{y}_{t+1} = y_t$). Serves as the primary null hypothesis benchmark.
### Formal Study Holdout Summary (`FORMAL_CORRECTED_20260828_02`)
- **Holdout Period**: September 2, 2025 – August 28, 2026 (243 common target trading sessions).
- **Principal Selection**: Per-company winners selected strictly by lowest holdout RMSE among the three trained candidates:
  - **ARIMA (8 companies)**: `BPI`, `GLO`, `MBT`, `NIKL`, `PGOLD`, `SCC`, `SECB`, `SHLPH`
  - **Lag-Informed Regression (5 companies)**: `ALI`, `APX`, `MEG`, `MER`, `SMPH`
  - **LSTM (2 companies)**: `ICT`, `JFC`
- **Benchmark Outperformance**: Under Holm-adjusted Diebold-Mariano tests against the holdout Naive baseline, only **ICT** ($p_{\text{adj}} = 0.04176$) and **MBT** ($p_{\text{adj}} = 0.00259$) achieved statistically significant superior accuracy at $\alpha = 0.05$. For all other 13 companies, the null hypothesis of equal predictive accuracy to Naive persistence cannot be rejected.
---
## System Architecture
```text
       [ PSE EDGE Official End-of-Day PDF Reports ]
                           │
                           ▼ (Cron: Mon 17:30, Tue-Fri 16:00 PHT)
       [ GitHub Actions: update_pipeline.yml ]
         ├── Ingest and parse official PDF reports
         ├── Validate OHLCV data & append to backend/data/raw/*.csv
         ├── Check PSE Trading Calendar (services/pse_calendar.py)
         └── Run Headless Persisted Inference (run_pipeline.py --no-train)
                           │
                           ▼
       [ Authoritative Operational Deployment ]
         ├── backend/models/deployment/current/deployment_manifest.json
         ├── Persisted Models: arima/*.pkl, lag_regression/*.pkl, lstm/*.pth
         └── Prospective History: backend/operational/current.json
                           │
                           ▼
       [ Frontend Static Exporter: export_forecast_artifacts.py ]
         ├── Export JSON to frontend/public/forecasts/
         └── Strict Validation: validate_exports.py (15/15 companies check)
                           │
                           ▼
       [ Automated Git Commit & Push to main ]
                           │
                           ▼
       [ Vercel Production Deployment (Next.js 14 SSG/SSR) ]
         └── Live Dashboard: https://pse-stock-price-forecast.vercel.app/
Repository Structure
text


.
├── .github/workflows/
│   ├── update_pipeline.yml          # Daily PSE EOD ingestion & approved inference
│   └── train_models.yml             # Separately authorized scheduled refresh
├── backend/
│   ├── data/raw/                    # Official OHLCV historical CSV files (2020–present)
│   ├── models/deployment/current/   # Authoritative manifest & 45 persisted models
│   ├── operational/current.json     # Prospective issuance ledger & operational batch
│   ├── production_history/          # Issued three-model forecast history CSVs
│   ├── prediction_cache/            # Intermediate prediction cache & backtests
│   ├── scripts/
│   │   ├── daily_inference.py       # Daily CLI entrypoint
│   │   ├── export_forecast_artifacts.py  # Frontend JSON contract generator
│   │   ├── export_operational.py    # Operational ledger exporter
│   │   ├── validate_exports.py      # Pre-commit artifact shape validator
│   │   └── verify_evidence_archive.py    # Stream validator for research archives
│   ├── services/
│   │   ├── feature_engineering.py   # Leakage-free technical feature extraction
│   │   ├── model_selector.py        # Retuning, approval, and refresh logic
│   │   ├── operational_deployment.py# infer_daily & scheduled_refresh engines
│   │   ├── pdf_pipeline/            # PDF downloader, parser, and cleaner
│   │   └── pse_calendar.py          # PSE trading calendar and holiday validator
│   └── tests/                       # 274 backend pytest unit and integration tests
├── docs/
│   └── DEPLOYMENT_RUNBOOK.md        # Comprehensive operator deployment runbook
├── frontend/
│   ├── public/forecasts/            # Flat JSON contracts read by the UI
│   ├── scripts/                     # Frontend data integrity & smoke tests
│   └── src/
│       ├── app/                     # Next.js App Router (Pages & Chat API route)
│       ├── components/              # Recharts visualizations & UI modules
│       └── lib/                     # Server-side data readers, types & Gemini AI
├── reports/
│   ├── FORMAL_CORRECTED_20260828_02/# Audit evidence retrieval & SHA manifests
│   └── run02-promotion/             # Operational promotion review & boundary checks
└── README.md
Local Setup & Development
Prerequisites
Git
Python 3.11 (matches production runtime)
Node.js 20 LTS & npm
1. Clone the Repository
bash


git clone https://github.com/AlvinTubtub/pse-stock-price-forecast-corrected-research.git
cd pse-stock-price-forecast-corrected-research
2. Backend Setup
bash


# Create and activate Python virtual environment
python3.11 -m venv .venv
source .venv/bin/activate
# Upgrade pip and install pipeline dependencies
pip install --upgrade pip
pip install -r backend/requirements-fast.txt
pip install -r backend/requirements-inference.txt
# For full retuning / training environments:
pip install -r backend/requirements-pipeline.txt
3. Frontend Setup
bash


cd frontend
npm ci
# Optional: Configure Gemini API key for local chatbot testing
cp .env.example .env.local
# Set GEMINI_API_KEY in frontend/.env.local (do not commit)
cd ..
Running Operational Workflows
All operational commands must be executed from the repository root with .venv active:

Run Daily Official Ingestion & Inference
bash


python backend/run_pipeline.py --no-train
Ingests official PSE EOD reports, verifies calendar rules, loads approved persisted models, predicts next-day closing prices, and updates backend/operational/current.json.

Export & Validate Frontend Artifacts
bash


python backend/scripts/export_forecast_artifacts.py
python backend/scripts/validate_exports.py
Generates static JSON files under frontend/public/forecasts/ and validates 15/15 company coverage, backtest consistency, and schema compliance.

Scheduled Deployment Refresh (Separately Authorized)
bash


# Strictly refit approved models on new data without altering configurations:
python -m backend.services.model_selector --mode deployment-refresh --strict
Run Frontend Locally
bash


cd frontend
npm run dev
Open http://localhost:3000 in your browser.

Testing & Quality Gates
Run the complete test suite locally before pushing changes:

bash


# 1. Backend Pytest Suite (274 unit and integration tests)
.venv/bin/pytest backend/tests/ -q
# 2. Frontend Test Suite (Schema, model pages, smoke tests)
npm --prefix frontend run test:all
# 3. Next.js Production Build Verification (28/28 static pages compiled)
npm --prefix frontend run build
# 4. Git Formatting & Whitespace Cleanliness
git diff --check
Engineering Rules & Guardrails
Research Immutability: Never overwrite, recalculate, or modify artifacts belonging to FORMAL_CORRECTED_20260828_02.
Zero Stale Forecasts: Never publish past forecasts as current. If market data has not advanced, the pipeline reports no_files and leaves verified prospective targets unchanged.
No Request-Time Fitting: Vercel executes zero Python code and never trains models. All forecasts are pre-computed, hash-verified, and statically exported.
Complete 15-Company Universes: Partial company batches are strictly rejected by both backend validators and frontend consumers.
No Force Pushing: Maintain clean, fast-forward linear history on main.
Academic & Technical Documentation
Deployment Runbook
: Step-by-step procedures for operators, challenger retuning, and scheduled refreshes.
Evidence Retrieval Guide
: Verification instructions for the 189-member formal audit release archive.
Operational Promotion Review
: Detailed verification boundary and approval documentation.
Backend Architecture Guide
: Detailed ML modeling specifications, feature pipelines, and state-space equations.
License
This codebase is licensed under standard institutional copyright for academic and research evaluation. All rights reserved.
