# ForecastPH Deployment Runbook

## Operating contract

Formal evidence for `FORMAL_CORRECTED_20260828_02` is immutable. Operational
models live in `backend/models/deployment/versions/<DEPLOYMENT_VERSION>/`; each
version contains its own manifest and 15 selected-model artifacts. The atomic
`backend/models/deployment/active.json` pointer selects the production version.
The superseded `current/` deployment and its manual-only approval remain
unchanged for audit and historical forecast validation.

The authorization record under `backend/models/deployment/approvals/` must grant
`production_inference` for live forecasts and `scheduled_refresh` for the
one-time workflow. Missing or incompatible scope stops the operation. It does
not authorize challenger retuning or automatic promotion.

## Schedule

- Daily external dispatch: Monday at 17:30 and Tuesday–Friday at 16:00,
  Asia/Manila. It runs data ingestion, persisted-model inference, export, and
  validation. Daily inference calls no training or fitting function.
- One-time refresh: November 3, 2026 at 08:00 Asia/Manila (00:00 UTC), using
  GitHub cron `0 0 3 11 *` plus an exact `2026-11-03` UTC date guard.
- After November 3, the guard skips later annual matches. Any later refresh
  needs a new reviewed authorization and workflow change. There is no monthly,
  Sunday, or automatic recurring model refresh.

## Run daily inference

From `backend/`, using the compatible environment:

```bash
../.venv/bin/python -m scripts.daily_inference
../.venv/bin/python -m scripts.export_forecast_artifacts
../.venv/bin/python -m scripts.validate_exports
```

Inference takes the same deployment lock as refresh, resolves the active pointer
once, validates the manifest and approval, hash-checks each artifact before
loading, validates the loaded configuration and training lineage, and issues one
15-company batch from that fixed version. An existing same-target issuance is
preserved exactly. Actualization may add observed prices and errors only.

## Run the authorized fixed-configuration refresh

```bash
cd backend
../.venv/bin/python -m services.model_selector --mode deployment-refresh --strict
```

The refresh:

1. Validates the exact 15 Run 02 selected families and configurations.
2. Validates `scheduled_refresh` authorization and all official input data.
3. Fits preprocessing only on the current operational training rows.
4. Writes each selected artifact into a new staging version.
5. Reloads it, validates configuration and lineage, and compares a test prediction.
6. Records training cutoff, row count, source hash, configuration hash, artifact
   hash, code revision/diff identity, and runtime versions.
7. Confirms every source file hash is unchanged.
8. Validates the complete manifest, renames the staging directory to its immutable
   version, and atomically replaces only `active.json`.

Any failure before pointer replacement leaves the active deployment and forecast
history unchanged. A failure during pointer replacement leaves the prior pointer
active; the completed inactive version can be inspected or removed separately.

## Challenger work

Retuning remains a separate, manual research operation and cannot be triggered by
the daily or one-time fixed-configuration workflows:

```bash
cd backend
../.venv/bin/python -m services.model_selector --mode deployment-retune --symbols BPI
```

Reviewing or promoting a challenger requires its own explicit decision. Never
rewrite formal Run 02 evidence to reflect an operational challenger.

## Release verification

```bash
.venv/bin/python -m pytest backend/tests -q
cd frontend
npm test
npm run lint
npm run build
cd ..
.venv/bin/python backend/scripts/validate_exports.py
.venv/bin/python -c "import yaml; yaml.safe_load(open('.github/workflows/train_models.yml')); yaml.safe_load(open('.github/workflows/update_pipeline.yml')); print('workflow YAML OK')"
git diff --check
```

Before pushing, confirm `git check-ignore` does not exclude `active.json`, the
approval record, the complete version directory, the operational ledger, or the
frontend exports. After pushing, run the daily workflow once, confirm its result,
then verify the Vercel production deployment and the repository's actual production
domain. Compare all 15 published rows with the exported artifact, including price,
data date, target session, model family, deployment version, and manifest hash.

Use “Verified Run 02 configuration” only for an issuance whose artifact hash,
configuration, approval, and data lineage passed validation. The label verifies
provenance, not predictive accuracy.
