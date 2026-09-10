> **Run 02 operational control (September 8, 2026):** Daily inference uses each
> company's selected artifact from one approved, persisted, hash-checked deployment
> plus two comparison-only artifacts, and performs no daily fitting or tuning. The
> separately authorized deployment
> refresh refits only the selected families with frozen configurations, builds an
> immutable version directory, and activates it atomically.
>
> See [promotion mapping, safety rules, tests and run commands](../reports/run02-promotion/REVIEW.md).

# ForecastPH — Backend (Data/ML Pipeline)

ForecastPH forecasts next-session closing prices for selected PSE-listed companies. **This directory
is the data/ML pipeline only** — it scrapes, cleans, engineers features, trains, evaluates, and
produces forecasts, then exports the results as static JSON consumed by the frontend.

This is one half of a monorepo — see the [repo root README](../README.md) for the overall layout.
The UI lives in the sibling `../frontend/` directory (Next.js, deployed on Vercel). It contains no
Python and calls no backend — it reads the JSON files this pipeline's GitHub Actions workflows
commit straight to `../frontend/public/forecasts/`. Because both live in the same repo, that commit
*is* the frontend's data update, and Vercel's own Git integration (Root Directory: `frontend/`)
redeploys automatically on every push — no deploy hook or cross-repo wiring required.

**This directory is a pure, read-only-to-the-frontend data pipeline.** There is no server, no API,
and no upload/retraining capability triggered from the UI — every number the frontend shows comes
from files already committed here by the automated pipeline described below.
`scripts/export_forecast_artifacts.py` is the main backend-to-frontend adapter. It validates and
reshapes raw OHLCV, approved deployment state, `operational/current.json`, production history,
legacy prediction caches, and formal-study presentation data into the JSON contract the frontend
expects. It runs near the end of both GitHub Actions workflows below and is followed by the export
validator.

> The previous Streamlit UI (`app.py`, `ui/`, `pages_app/`) has been removed — it's fully superseded
> by `../frontend/`.

## Features

- Home dashboard with project overview
- Company list and sector browsing
- Company details with historical charts, next-day forecast, and actual-vs-predicted backtests
- Model comparison across forecasting methods (RMSE/MAE/MASE/R²)
- Educational section explaining OHLCV and forecasting models
- About page for project context and capstone background
- A "data last refreshed" indicator sourced directly from the automated pipeline's own run metadata

## Architecture

```text
Cron-job.org (Mon 17:30; Tue–Fri 16:00)     GitHub Actions (2026-11-03 08:00 PHT)
        │  POST repository_dispatch                  │  schedule trigger
        ▼                                             ▼
.github/workflows/update_pipeline.yml       .github/workflows/train_models.yml
        │  ("Fast Pipeline")                          │  ("Heavy Training")
        ▼                                             ▼
run_pipeline.py --no-train                  model_selector --mode deployment-refresh --strict
  1. Download latest PSE EDGE disclosures      1. Load approved configurations
  2. Extract and validate PDF tables           2. Refit only each company's selected family
  3. Update OHLCV datasets                        with its frozen configuration
     (data/raw/<SYMBOL>.csv)                   3. Preserve approved model families and metrics
  4. Update latest_processed.json              4. Atomically activate a versioned deployment
  5. Issue one selected operational forecast and
     three-model comparison snapshot per company
        │
        ▼
Commit changed artifacts only
(idempotent — no-op if nothing changed)               │
        │                                             ▼
        │                                    Commit changed artifacts only
        │                                    (idempotent — no-op if nothing changed)
        ▼                                             │
        └──────────────────┬──────────────────────────┘
                            ▼
        Vercel (Root Directory: frontend/) auto-redeploys from the new commit
        via its normal Git integration — no deploy hook needed
                            │
                            ▼
        Dashboard reflects the latest data/models — no user interaction required
```

Data, selected-model inference, and three-model comparison issuance refresh daily on trading days; approved deployment
configurations have one authorized frozen-configuration refit on November 3, 2026 — see
"Automated Pipeline" below for why, and the runtime numbers behind that
split.

The frontend (`../frontend/`) only ever:
- reads operational JSON exported by `scripts/export_forecast_artifacts.py` and the separately generated immutable formal-study JSON
- displays company details and rolling next-day forecasts separately from the approved formal-study metrics and statistical findings

The frontend never downloads PDFs, processes data, retrains models, executes any forecasting pipeline, or writes anything back to the repository. There is no "Update Data" page, no upload widget, and no button anywhere in the app that triggers processing — the only way data changes is a commit from the automated pipeline landing in the repo.

## Tech Stack

- Python
- Pandas
- NumPy
- scikit-learn
- Statsmodels (ADF test, CV-scored ARIMA order search, Ljung-Box diagnostics)
- Torch
- Joblib (model persistence)
- pdfplumber, requests (PDF ingestion pipeline)

## Model Training Pipeline

Training happens exclusively inside the automated pipeline (never in the frontend):

```text
PSE EDGE PDF -> PDF Extraction -> CSV Generation -> Data Validation
    -> Feature Engineering -> Model Training (x3) -> Model Evaluation
    -> Statistical Significance Tests -> Best Model Selection
    -> Saved Models -> export_forecast_artifacts.py -> Frontend Dashboard (read-only)
```

Lag-Informed Regression and LSTM predict next-day **ΔClose** =
Close(t+1) − Close(t). ARIMA models the closing-price level and performs
differencing internally according to its selected order. All three produce
the same next-day closing-price output and are evaluated on identical target
dates in peso terms.

- `services/feature_engineering.py` — lag features + technical indicators
  (EMA 10/20, RSI 14, MACD/Signal, Bollinger Bands, daily return, rolling
  volatility, High-Low and Open-Close spreads) plus the expanded return
  feature set (lagged returns 1-20, rolling return mean/volatility at
  5/10/20, high-low range %, log volume, rolling volume means) used only by
  Lag-Informed Regression. ARIMA and LSTM use their own model-specific inputs.
- `services/time_series_cv.py` — shared expanding-window rolling-origin
  CV splitter (5 folds, shrinking only for short series), used by both
  the regression's lambda selection and the ARIMA order search.
- `services/forecasting/lag_regression.py` — training-only StandardScaler
  -> PACF-assisted lag selection -> LASSO as the *final* estimator (no
  secondary OLS refit), lambda chosen by 5-fold expanding-window CV over
  the predeclared expanded 10^-4 through 10^3 grid. The full grid evidence
  is retained, and a boundary winner blocks formal finalization.
- `services/forecasting/arima_model.py` — ADF stationarity test +
  (p, d, q) search restricted to p<=3, d<=2, q<=3, scored by
  expanding-window rolling-origin CV with walk-forward one-step
  forecasting (not AIC), plus Ljung-Box residual diagnostics.
- `services/forecasting/lstm_model.py` — single LSTM layer + linear head,
  predicting scaled ΔClose (Min-Max scaler fit on the training split
  only), hyperparameters chosen by grid search over lookback
  (5/10/20/30), hidden units (25/50/100), learning rate (0.01/0.001), and
  batch size (16/32) — 48 configurations. Every configuration is evaluated
  on the same five target-date folds using seeds 42, 123, and 2026; all 720
  fold/seed results are retained. A stopping-tail epoch choice is followed by
  a fresh seed-42 refit on every development sequence.
- `services/corporate_actions.py` — keeps every validated raw-Close row in
  the primary analysis, never removes observations because of large errors,
  and records a separate sensitivity analysis when verified event dates are
  supplied.
- `services/evaluation.py` — shared RMSE/MAE/MASE/R² metrics (computed on
  reconstructed peso prices; MASE is scaled against the in-sample naive
  one-step forecast), plus the cross-model statistical-significance
  suite: Diebold-Mariano with Newey-West HAC variance and the
  Harvey-Leybourne-Newbold small-sample correction (within each company),
  Holm-Bonferroni correction, a Friedman rank test and Holm-adjusted
  Wilcoxon signed-rank post-hoc tests (across companies), and a
  best-model consistency check (lowest RMSE on >=8 of 15 companies).
- `services/model_selector.py` — keeps formal evaluation, scheduled
  deployment refresh, and manual challenger retuning as explicit operations.
  Refresh reads approved configuration metadata and never reruns formal tests.

Deployment refresh is decoupled from data ingestion and formal evaluation:
`refresh_deployment_all()` is called directly by
`.github/workflows/train_models.yml` (one-time, year-guarded), *not* by every run of
`services/pdf_pipeline/pipeline.py`/`run_pipeline.py` (Fast Pipeline,
Monday-Friday — see "Automated Pipeline" below for the full split and
why). `run_pipeline.py` still supports training inline via its
`train_models=True` default, for local/manual use:

```bash
python -m services.model_selector --mode deployment-refresh  # refit approved configurations
python -m services.model_selector --mode deployment-retune --symbols BPI  # manual challenger only
python scripts/smoke_formal_runner.py --symbols BPI --epochs 2  # development only; writes no formal run
python run_pipeline.py                     # ingest + train in one go (local/dev; CI never does both together)
python run_pipeline.py --no-train           # ingest new data only, skip retraining (what the Fast Pipeline runs)
```

### Frontend result separation

The deployed site reads two independent presentation contracts:

- `frontend/public/forecasts/*.json` contains rolling operational data and
  next-session forecasts. The daily pipeline may update these files.
- `frontend/public/forecasts/formal/FORMAL_CORRECTED_20260828_02.json`
  contains the approved immutable research summary. Daily inference and
  deployment refreshes do not generate or overwrite it.

The formal file was generated once from the completed evidence directory:

```bash
python backend/scripts/export_formal_study_results.py \
  --run-dir formal_evidence/FORMAL_CORRECTED_20260828_02 \
  --output frontend/public/forecasts/formal/FORMAL_CORRECTED_20260828_02.json \
  --archive-sha256 2b2ed0ca6b88ea6cfef5ac14013440da1c7c55c1d9f9640e04a595fdafca5d24 \
  --source-data-commit 2e72058057f5ba2ef903147c8390c3f05f41ffe3
```

The exporter refuses to overwrite a non-identical formal JSON file. The normal
export validator checks its run ID, code identity, evidence hash, company
coverage, metric completeness, 7–7–1 RMSE counts, and statistical conclusions
on every automated update.

An optional formal corporate-action registry is passed with
`--corporate-actions-file`. It must be reviewed before the run and use this
shape:

```json
{
  "schema_version": 1,
  "review_status": "complete",
  "reviewed_symbols": ["BPI"],
  "review_period": {
    "start_date": "2025-09-02",
    "end_date": "2026-08-28"
  },
  "events": [
    {
      "symbol": "BPI",
      "event_date": "2026-01-05",
      "event_type": "stock_split",
      "source": "exchange disclosure reference"
    }
  ]
}
```

`reviewed_symbols` must cover every requested company and `review_period` must
cover every formal holdout target date. The reviewed 15-company registry for
the frozen August 28, 2026 experiment is
`config/formal_corporate_actions_20250902_20260828.json`. The registry hash
becomes part of the resume contract, so its contents cannot change during a
resumed run. If no reviewed registry is supplied, the formal evidence records
that limitation rather than claiming that no events occurred.

The expensive ARIMA and LSTM searches run only during explicitly requested
manual challenger retuning or formal research. The one-time workflow performs
fixed-configuration refresh only and fails without scheduled-refresh authorization.

## Project Structure

This directory is one half of the monorepo — see the [repo root README](../README.md) for
`../frontend/`'s structure.

```text
backend/
├── run_pipeline.py            # headless CLI entrypoint for the Fast Pipeline (and local dev)
├── requirements-fast.txt      # deps for the Fast Pipeline (no ML stack)
├── requirements-pipeline.txt  # deps for the Heavy Training pipeline / local full-pipeline dev
├── README.md
├── data/
│   ├── raw/                # <TICKER>.csv — the data the frontend's exported JSON is built from
│   ├── pdf_reports/        # staged PSE EDGE EOD PDFs (gitignored, except bundled samples)
│   └── pdf_pipeline/       # intermediate ETL artifacts + pipeline.log (gitignored)
├── models/
│   ├── deployment/         # active pointer, approval records, immutable versions, selected artifacts
│   ├── lag_regression/     # <TICKER>.pkl
│   ├── arima/              # <TICKER>.pkl
│   └── lstm/                # <TICKER>.pth
├── operational/current.json # complete approved current batch + selected-model issuance history
├── production_history/      # historical contemporaneous three-model comparison ledgers
├── prediction_cache/        # <TICKER>.json — cached metrics/predictions, read by the export script
├── best_models.json         # {"<TICKER>": "<best model label>"} per ticker, lowest RMSE
├── statistical_tests.json   # cross-model significance tests (DM/HLN, Friedman, Wilcoxon-Holm, consistency check)
├── latest_processed.json    # metadata about the most recent automated pipeline run
├── scripts/
│   └── export_forecast_artifacts.py   # reshapes the above into ../frontend/public/forecasts/*.json
└── services/
    ├── data_loader.py
    ├── data_validator.py
    ├── feature_engineering.py   # lag + technical-indicator + return features, shared by all models
    ├── time_series_cv.py        # shared expanding-window rolling-origin CV splitter
    ├── evaluation.py            # shared RMSE/MAE/MASE/R² metrics + statistical significance suite
    ├── model_selector.py        # trains all 3 models per ticker, saves them, picks the best
    ├── forecasting/
    │   ├── __init__.py
    │   ├── lag_regression.py
    │   ├── arima_model.py
    │   └── lstm_model.py
    └── pdf_pipeline/       # PDF ingestion pipeline (download, parser, cleaner, validator, merge)
        ├── config.py
        ├── downloader.py
        ├── parser.py
        ├── cleaner.py
        ├── validator.py
        ├── merge.py
        └── pipeline.py     # single orchestration layer: ingestion -> training -> metadata
```

The root `.github/workflows/` (not inside `backend/`) runs everything below against these paths —
see the repo root README for exactly how.

## Requirements

- Python 3.10 or newer
- pip

Running the actual dashboard UI is a separate, Node-based step — see
[`../frontend/README.md`](../frontend/README.md). This directory only produces the data it reads.

## Data Format

Each company CSV in `data/raw/` contains: `Date, Open, High, Low, Close, Volume`, named by ticker symbol (e.g. `ALI.csv`, `BPI.csv`, ...). The full list of 15 tracked tickers: ALI, APX, BPI, GLO, ICT, JFC, MBT, MEG, MER, NIKL, PGOLD, SCC, SECB, SHLPH, SMPH.

## Notes

- `SECB.csv` replaces `BDO.csv` throughout the project.
- `services/data_loader.py` maps ticker symbols to the company metadata used in the dashboard.
- If a company CSV or trained model is missing, the app shows a placeholder or an in-app "not processed yet" message instead of failing — see [Architecture](#architecture).

## Automated Pipeline

The pipeline is split across two workflows so the expensive part doesn't
run daily:

| | `.github/workflows/update_pipeline.yml` ("Fast Pipeline") | `.github/workflows/train_models.yml` ("Heavy Training") |
|---|---|---|
| Does | PDF ingestion, approved selected-model inference, three-model shadow comparison issuance, export and validation (`python backend/run_pipeline.py --no-train`) | Refits each company's selected family with its frozen approved configuration (`python -m services.model_selector --mode deployment-refresh --strict`) |
| Schedule | Monday 5:30 PM; Tuesday-Friday 4:00 PM Philippine Time | November 3, 2026 at 8:00 AM Philippine Time |
| Trigger | External: [Cron-job.org](https://cron-job.org) `repository_dispatch` (no GitHub-native cron) | GitHub Actions' own `schedule: cron` |
| Dependencies | `backend/requirements-fast.txt` plus `backend/requirements-inference.txt` | `backend/requirements-pipeline.txt` (complete refit and validation stack) |
| Typical runtime | A couple of minutes | Refit-dependent; no scheduled ARIMA/LSTM grid search |
| Commits | `backend/data/raw/`, `backend/latest_processed.json`, `backend/operational/current.json`, `frontend/public/forecasts/` | `backend/models/deployment/versions/`, `backend/models/deployment/active.json`, approval record, and validated exports |

Both share the `pse-pipeline` concurrency group, so they queue instead of
racing each other if a run overlaps. The one-time refresh uses the validated
official data already present in the checkout.

### Setting up the Cron-job.org trigger (Fast Pipeline only)

Heavy Training needs no external setup — it's a native GitHub Actions
`schedule: cron` trigger, already configured in `train_models.yml`. Only
the Fast Pipeline needs Cron-job.org:

1. Create a GitHub Personal Access Token with `repo` + `workflow` scope (a fine-grained token scoped to just this repo's contents+actions permissions also works).
2. In Cron-job.org, create a new job with:
   - **Schedule**: create two jobs in timezone `Asia/Manila`: Monday at 17:30, and Tuesday-Friday at 16:00.
   - **Request type**: Custom HTTP request (`POST`)
   - **URL**: `https://api.github.com/repos/<OWNER>/<REPO>/dispatches`
   - **Headers**:
     - `Accept: application/vnd.github+json`
     - `Authorization: Bearer <YOUR_GITHUB_PAT>`
     - `X-GitHub-Api-Version: 2022-11-28`
   - **Body**: `{"event_type": "update-pse-data"}`
3. Save. Cron-job.org will now POST to GitHub on that schedule, which fires the `repository_dispatch` trigger and starts the Fast Pipeline workflow — no polling, no GitHub Actions schedule minute-drift.

**Never commit the PAT to this repository.** Store it only in Cron-job.org's own encrypted request-header field.

GitHub Actions' cron for the one-time refresh can be delayed by a few minutes.
The explicit `2026-11-03` UTC guard prevents recurrence in later years.

### What each workflow does

**Fast Pipeline** (Monday 17:30; Tuesday-Friday 16:00 Philippine time):

1. Checks out the repo and installs `backend/requirements-fast.txt` and `backend/requirements-inference.txt`.
2. Checks the maintained PSE trading calendar and skips the remaining data steps successfully when the exchange is closed.
3. Runs `python backend/run_pipeline.py --no-train`, which downloads new EOD reports, extracts, cleans, validates, and merges them into `backend/data/raw/`, then writes `backend/latest_processed.json`. It validates the approved active deployment, issues one selected operational forecast per company, and records a three-model shadow comparison snapshot for the same target. All 45 predictions must succeed before the batch is written. It performs no model fitting, retuning, model selection, or automatic promotion.
4. Exports and validates `frontend/public/forecasts/*.json`, including the approved formal identity and complete operational batch.
5. Stages raw data, processing metadata, the operational ledger, and frontend exports. If nothing changed, the job finishes successfully without an empty commit; otherwise it commits and pushes.
6. Vercel can redeploy the frontend commit through the repository's Git integration.

**One-time Deployment Refresh** (November 3, 2026 at 08:00 PHT):

1. Checks out the repo (already current through Friday, via the week's Fast Pipeline commits) and installs `backend/requirements-pipeline.txt`.
2. Runs `python -m services.model_selector --mode deployment-refresh --strict` (from `backend/`), which refits only each company's approved selected family using its frozen configuration and preserves formal metrics and model-family choices.
3. Exports and validates the frontend artifacts after the complete refit succeeds.
4. Stages the new immutable version, manifest, active pointer, approval record, operational ledger, and validated frontend exports.
5. If something changed, commits and pushes; Vercel can redeploy automatically through its Git integration.

Both workflows are granted only `contents: write` — nothing else.

### Manual / ops trigger (workflow_dispatch)

For a maintainer testing or backfilling outside the scheduled daily run, use
**Actions → Daily official-data and approved forecast refresh → Run workflow**. The one-time
November 3 deployment refresh intentionally has no `workflow_dispatch` trigger. Challenger
retuning and promotion use explicit researcher-only commands and are never automatic.

### Running it locally

From the repo root:

```bash
pip install -r backend/requirements-fast.txt       # PDF ingestion
pip install -r backend/requirements-inference.txt  # selected and comparison persisted-artifact inference
pip install -r backend/requirements-pipeline.txt   # complete refit/formal-development stack

python backend/run_pipeline.py                     # ingest official data and issue approved forecasts
python backend/run_pipeline.py --no-download       # process staged PDFs, then issue approved forecasts
python backend/run_pipeline.py --no-train          # compatibility spelling used by the Fast Pipeline; no daily fitting occurs
python backend/run_pipeline.py --no-inference      # ingest only; do not issue forecasts
python backend/run_pipeline.py --start-date 2026-07-01 --end-date 2026-07-27
cd backend && python -m services.model_selector --mode deployment-refresh  # refresh approved models
python backend/scripts/export_forecast_artifacts.py  # refresh frontend/public/forecasts/ from whatever's on disk
```

Exit code `0` means success (including "nothing new to do"); exit code `1` means a real failure — check `backend/data/pdf_pipeline/pipeline.log`.

### Disabling automation

- In GitHub: **Actions → \<workflow name\> → ⋯ → Disable workflow** (do this for each of the two workflows independently).
- Or delete/rename the corresponding file under `.github/workflows/`.
- Independently, pause or delete the Cron-job.org job — that alone stops new Fast Pipeline runs from being triggered, without touching anything in this repo (Heavy Training is unaffected, since it doesn't depend on Cron-job.org).

### Idempotency / duplicate-run protection

Re-running the daily workflow on data it already has is safe and a no-op at
the commit layer: `merge_into_raw()` upserts by date, same-target operational
issuance preserves the first forecast, and the workflow's `git diff --cached`
check prevents empty commits. The deployment refresh validates every refitted
artifact before atomically replacing the active pointer; a failed or incomplete
15-company refresh leaves the previous deployment active.

## About the Forecasting Models

The dashboard compares three forecasting approaches, each predicting
next-day ΔClose and reconstructing a peso price from it (see "Model
Training Pipeline" above for each model's methodology):

- Lag-Informed Regression
- ARIMA
- LSTM

against a naive (yesterday's close) baseline, using:

- RMSE
- MAE
- MASE
- R²

Formal evaluation compares all three model families with the Naive benchmark.
Daily controlled operation still recognizes only the selected family recorded
for each company in the active deployment manifest as the operational forecast.
During the same run, it now loads the two non-selected families from the
separate hash-pinned comparison manifest and records an immutable three-model
shadow snapshot before the target session. Comparison approval explicitly
forbids fitting, model selection, and automatic promotion. A failure in any of
the 45 predictions prevents the complete batch from being written. Once the
official close arrives, all three issued values can appear in the Backtest and
Forecast Error charts. Missing retrospective forecasts are never manufactured.

Cross-model significance is assessed with Diebold-Mariano (Newey-West HAC
variance, HLN small-sample correction) within each company, and a
Friedman rank test with Holm-adjusted Wilcoxon signed-rank post-hoc tests
across all companies — see `statistical_tests.json`, written only by an
explicit formal-evaluation run.

## Disclaimer

This dashboard is intended for academic, educational, and analytical decision-support purposes only. It is not financial advice and should not be used as the sole basis for investment decisions.

## License

For academic and internal project use.
