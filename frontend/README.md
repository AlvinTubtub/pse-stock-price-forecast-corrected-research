# ForecastPH — Frontend (Next.js, Vercel)

A Next.js 14 (App Router) dashboard for PSE stock forecasts. It contains no Python, model inference,
database, or data-mutation API. Dashboard pages read repository-managed JSON files from
`public/forecasts/` at build/request time. The optional `/api/chat` route sends educational
questions to Gemini using server-side credentials; it does not generate or modify forecasts.

This is one half of a monorepo — see the [repo root README](../README.md) for the overall layout.
Those JSON files are produced and committed by the sibling `../backend/` pipeline's GitHub Actions
workflows (see `../backend/README.md` and `../backend/scripts/export_forecast_artifacts.py`). This
forecast pages never fetch model results from a remote API and never run model inference — they use
plain `fs.readFile` calls against files already in this repository when Vercel builds it.

## Local development

```bash
npm install
npm run dev
```

Open http://localhost:3000. The app reads whatever JSON currently exists under `public/forecasts/`
— that's committed to the repo, so a normal `git pull` keeps it current; no separate copy step is
needed (unlike a two-repo setup).

## Data contract

```
public/forecasts/
  dashboard.json        # home page summary: totals, sectors, top gainer/loser, pipeline status
  latest.json           # lightweight freshness indicator (forecast date, last run, status)
  metrics.json          # aggregate + per-company model performance (RMSE/MAE/MASE/R²)
  companies.json        # flat list for the Company List page + search
  company/<SYMBOL>.json # full detail: OHLCV, backtest series, per-model metrics
  history/<SYMBOL>.json # full OHLCV history (superset of company/<SYMBOL>.json's trimmed series)
  operational.json      # approved 15-company issuance batch and prospective operational history
  deployment.json       # manifest that issued the current operational batch
  active-deployment.json # currently active verified deployment manifest
  formal/FORMAL_CORRECTED_20260828_02.json # immutable formal-study presentation data
```

If a file or ticker is missing, the relevant page renders a "not available yet" state instead of
throwing — a ticker the pipeline hasn't processed yet simply won't appear in `companies.json`.

The server-side readers accept operational data only when its manifest is explicitly approved,
hash-valid, complete for all 15 companies, and marked for production use. Development batches,
partial batches, invalid hashes, and unapproved manifests are ignored safely.

## Forecast and chart boundaries

The frontend keeps three kinds of results separate:

- **Formal Study Results** are read only from the immutable Run 02 formal JSON. They remain fixed
  at the August 28, 2026 source-data cutoff and are never treated as operational history.
- **Legacy issued history** covers target sessions from September 2 through September 7, 2026.
- **Controlled operational history** begins with the September 8, 2026 target session. The active
  deployment version is `RUN02_OPS_20260908_105811Z`.

The Backtest and Forecast Error charts contain only realized target sessions. All 15 company charts
retain contemporaneous Lag-Informed Regression, ARIMA, and LSTM predictions through September 9.
The September 10 target was issued before scheduled three-model comparison support and therefore
retains only its selected operational prediction. From the September 8 promotion boundary onward,
only the manifest-selected family is the controlled operational forecast; the other model lines are
comparison forecasts that were issued before the target session. Each future scheduled daily refresh
issues the selected operational prediction and an approved three-model comparison snapshot together;
the batch is written only after all 15 companies and all three families succeed. The UI never creates
a missing historical prediction after the actual close is known.

The next-session cards and forecast chart use the current approved operational batch. At the
September 10 data cutoff, that batch targets September 11, 2026. That target was also issued before
this change; the first complete scheduled three-model snapshot will be attached to the next target
that does not already have an immutable issuance.

## Frontend validation

From `frontend/`:

```bash
npm run test:all
npx tsc --noEmit --incremental false
npm run build
```

The operational-data test covers schema-v1/v2 manifest validation, rejected incomplete or
unapproved batches, the September 8 chart boundary, realized-only chart data, and three-model
coverage on the latest checked-in realized session for every company.

## Deploying to Vercel

1. Import the repo root into Vercel. Framework preset: **Next.js** (auto-detected).
2. **Root Directory**: Project Settings → Root Directory → `frontend/`. This is the only
   monorepo-specific setting needed.
3. Forecast pages require no environment variables. To enable the optional AI assistant, configure
   `GEMINI_API_KEY` as a server-side Vercel environment variable. Never expose it through a
   `NEXT_PUBLIC_*` variable.
4. Every commit that touches `frontend/public/forecasts/**` (i.e. every pipeline run in
   `../backend/`) triggers a new Vercel deployment automatically via Vercel's normal Git
   integration — no deploy hook, no cross-repo wiring, since it's all one push to one repo now.
5. The project has no Vercel cron job or database. It uses one server route for the optional AI
   assistant, and `next.config.js` sets `images.unoptimized = true`.

## What was intentionally left out

The original HTML prototype included a "Live Prediction" flow (upload a CSV, run a prediction in the
browser). That required Python model inference at request time, which conflicts directly with the
"no backend, no Python on Vercel" requirement. `/live` now explains this trade-off instead of silently
breaking; see the repo root README's architecture notes for the reasoning.
