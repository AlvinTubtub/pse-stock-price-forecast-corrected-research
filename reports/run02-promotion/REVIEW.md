# Run 02 operational promotion review

Implemented only in `/Users/alvintubtub/Downloads/pse-stock-price-forecast-corrected-research`, branch `codex/run02-operational-promotion`.

**GO for a manual local full 15-company generation using the pinned runtime, subject to the input freshness checks at execution.** No full 15-company model generation was performed. No schedule, remote job, Vercel deployment, commit, or push was enabled or executed.

## Identity and approval

- Promotion: `RUN02_OPS_20260907_01`, September 7, 2026.
- Formal source: `FORMAL_CORRECTED_20260828_02`.
- Approved formal implementation commit: `bfb33b8c184c87cc8828af5529410da94addd71c`.
- Formal source-data commit: `2e72058057f5ba2ef903147c8390c3f05f41ffe3`.
- Evidence archive SHA-256: `2b2ed0ca6b88ea6cfef5ac14013440da1c7c55c1d9f9640e04a595fdafca5d24` (computed from the original archive, read-only).
- Formal source-data cutoff: August 28, 2026; each company's source hash is in the manifest.
- Reviewed deployment manifest SHA-256: `16dc7ee566e6f24692729774db7e17d4cf5749f3a862992a8acbba273d9bc591`.
- Approval status: `approved`; scope: `manual_local_operational_generation`; authority: the user's instruction in this task. Approval explicitly excludes scheduled workflows and production deployment.
- The commit above identifies the approved **formal source code**, not this uncommitted integration. New artifacts record hashes of the actual fitting/feature/promotion implementation and exact runtime package versions. Review and commit this integration separately; no integration commit is falsely claimed here.

## Frozen company mapping

The chosen family is the lowest Run 02 holdout RMSE among the three principal models; ties follow lag_reg, arima, lstm. Naive remains a benchmark. This operational choice uses the completed study and is not a fresh unbiased performance evaluation or a claim of superiority to naive.

| Company | Model ID | Frozen configuration |
|---|---|---|
| ALI | lag_reg | alpha=0.1; PACF return lags=[5]; 32 frozen candidate columns |
| APX | lag_reg | alpha=0.01; PACF return lags=[1, 4, 6, 16]; 35 frozen candidate columns |
| BPI | arima | order=(1, 1, 1); trend=n; statespace, maxiter=2000; confirmed convergence required |
| GLO | arima | order=(0, 1, 0); trend=n; statespace, maxiter=2000; confirmed convergence required |
| ICT | lstm | lookback=30; hidden=25; learning rate=0.001; batch=16; epochs=47; seed=42 |
| JFC | lag_reg | alpha=1.58489319246; PACF return lags=[4, 9, 16, 20]; 35 frozen candidate columns |
| MBT | arima | order=(2, 1, 0); trend=n; statespace, maxiter=2000; confirmed convergence required |
| MEG | lag_reg | alpha=0.0158489319246; PACF return lags=[1]; 32 frozen candidate columns |
| MER | lag_reg | alpha=0.398107170553; PACF return lags=[1, 2, 8, 9, 11]; 36 frozen candidate columns |
| NIKL | lag_reg | alpha=0.0251188643151; PACF return lags=[13]; 32 frozen candidate columns |
| PGOLD | arima | order=(1, 1, 0); trend=n; statespace, maxiter=2000; confirmed convergence required |
| SCC | arima | order=(0, 1, 0); trend=n; statespace, maxiter=2000; confirmed convergence required |
| SECB | arima | order=(1, 0, 0); trend=n; statespace, maxiter=2000; confirmed convergence required |
| SHLPH | arima | order=(0, 1, 3); trend=t; statespace, maxiter=2000; confirmed convergence required |
| SMPH | lag_reg | alpha=0.0398107170553; PACF return lags=[1, 2]; 33 frozen candidate columns |

Every full configuration is in `backend/deployments/RUN02_OPS_20260907_01.json`. LASSO retains the ordered candidate feature matrix inferred from the final Run 02 diagnostics coefficient keys, including zero coefficients, and the final PACF lag subset. Coefficients and scaler statistics are re-estimated; the candidate set and alpha are not reselected. An all-zero Run 02 fit does not mean that an empty feature matrix should be fitted. LSTM retains Run 02's selected epochs and seed; the older refresh routine's epoch-selection step is bypassed.

## Previous pipeline and integration

Previously, the exporter used `best_models.json`, falling back to the lowest non-naive MASE in cached metrics. Daily inference loaded three persisted model families from deployment/current, falling back to legacy directories. The earlier refresh obtained configuration metadata from those artifacts/manifests, preserved legacy family choices, and refitted all three families. Its LSTM path reselected epochs.

Now `run_pipeline.py` validates approval before official PDF ingestion, always disables legacy training, then invokes the approved generator. `scripts.daily_inference.run_daily_inference` and `model_selector.refresh_deployment_all` also delegate to it. Old helper functions remain for historical artifact inspection and existing tests; they do not choose the active Run 02 deployment. A legacy retuned challenger cannot change the pinned Run 02 pointer.

The generator requires an explicitly approved, hash-pinned manifest with all 15 companies. It validates all source CSVs before fitting, requires current completed-session data and a target session that has not opened, fits only each selected family, rejects nonconvergence/non-finite predictions, and verifies that inputs have not changed while fitting. No search, PACF selection, epoch selection, fallback family, or automatic promotion runs. Calendar rules come from the repository's PSE calendar; official data ingestion remains the repository's existing PDF pipeline. No external reports were downloaded for this task.

A lock prevents simultaneous writes to an output directory. `backend/operational/current.json` contains the full batch, latest OHLCV, prospective issuance ledger, manifest/source/implementation hashes, runtime versions, and first-issue/first-target promotion boundary. It is replaced atomically only after every company succeeds. A failed fit leaves the previous complete batch untouched. Repeat issuance for the same target preserves the first forecast; a revised source for an already-issued target fails for review. Actuals and errors are filled only for already-issued prospective records.

`scripts/export_forecast_artifacts.py` now exports this separately to `frontend/public/forecasts/operational.json`, validating the complete batch. It does not overwrite legacy artifacts. The frontend validates the deployment hash, coverage and family mapping before using an operational batch. `/operations` displays the version, 15-company mapping, current forecasts and post-promotion coverage. Global status and company pages explicitly identify the legacy snapshot while full generation is pending. Fresh forecasts and OHLCV overlay the old display only after a complete valid batch exists.

## Import and preservation

`imported-files.json` is the exact allowlist and original SHA-256 record for 13 imported Formal Study Results files. These cover the immutable exporter/test/data, validation, frontend study UI/types/readers/AI context, and related documentation. Original workflow changes and the old workflow test were inspected and adapted to disabled execution instead of blindly copied. `formal_evidence/`, manuscript drafts, virtual environments, generated caches and unrelated files were not imported.

The formal exporter was run against the original evidence directory read-only. Its regenerated summary was byte-identical to the imported summary: 15 companies, 60 canonical metric rows, 14,580 holdout predictions. No formal metric was recalculated or changed.

`preservation.json` records 784 original file hashes checked with zero content changes. Original uncommitted Git status remained unchanged. Target raw CSVs, persisted models, prediction caches, `best_models.json`, statistical tests, legacy production ledgers, and company/history JSON artifacts also remained unchanged.

## Historical chart handling

Pre-promotion company charts retain the existing stored evaluation (60 sessions, June 4–August 28) and four realized legacy issued sessions (September 2–7 for ALI/BPI). Their original missing sessions remain missing. These are labelled pre-promotion evaluation/legacy issued history. The compact formal dataset is used for immutable study tables; it is never a live ledger source.

Post-promotion prediction/error charts are separate on `/operations`, identified by deployment version and first-issue/target boundary. They use only records issued before the target session, after actualization. Initial post-promotion history is empty; development smoke results do not count. No holdout-to-live conversion, invented retrospective refit backtest, interpolation, or promotion-era relabelling occurs. Stored MASE/RMSE on legacy pages are expressly pre-promotion metrics, not measured accuracy of the new refits.

## Verification

- `tests.txt`: 72 targeted Python tests passed in the pinned model environment. Coverage includes immutable formal identity/export, exact 15-company mapping, rejected mutations/missing approval, incomplete universe, stale data, fixed LASSO/LSTM policy, entrypoint routing, atomic batch failure, repeat issuance, reconciliation, malformed history and disabled workflows. Earlier legacy test expectations were updated where the operational contract deliberately changed from partial legacy inference to strict approved batches.
- `frontend-tests.txt`: server-reader tests passed for pending state, smoke/incomplete/unapproved rejection, active forecast overlays, unchanged legacy history, fresh OHLCV and consistent dashboard/latest metadata.
- TypeScript: `tsc --noEmit --incremental false` passed.
- Artifact validator: 15/15 legacy company files consistent, approved formal results intact, approved operational manifest valid; full generation explicitly reported pending.
- Browser: local `/operations`, `/compare`, `/companies/ALI` returned successful rendered pages. Verified 15-company mapping, zero post-promotion coverage, Run 02 immutable identity/conclusion, and ALI's pre-promotion label. Screenshot visually inspected; no browser errors or Next.js error overlay. No production build or deployment was attempted.
- `preflight.json`: all 15 source CSVs have 1,629 rows through September 7, 2026, targeting September 8. This was validation only, without a full model run.

## ALI/BPI development smoke

`smoke-pinned/current.json` and `smoke-pinned.log` record actual fresh refits:

| Company | Selected configuration | Data through | Next session | Forecast |
|---|---|---|---|---|
| ALI | LASSO alpha 0.1, frozen 32 candidate features | 2026-09-07 | 2026-09-08 | PHP 15.08 |
| BPI | ARIMA (1,1,1), trend n, converged | 2026-09-07 | 2026-09-08 | PHP 105.16 |

Both use 1,629 rows and are marked `developmentOnly: true`; their issuance history is empty. They were not exported to the frontend as operational forecasts. The first smoke under NumPy 2.4.6 is retained in `smoke/current.json`; it produced identical prices. The final smoke used repository-pinned NumPy 1.26.4, pandas 3.0.5, scikit-learn 1.9.0, SciPy 1.17.1, statsmodels 0.14.6, torch 2.13.0 and joblib 1.5.3 on Python 3.11.15.

## Remaining limitations and next step

No blocker remains for a **manual local first full generation** using those pinned dependencies and fresh official inputs. Only ALI and BPI received real model smoke fits, as requested; the first 15-company run must still demonstrate convergence for every selected family, including ICT's 47-epoch LSTM. If any fails, no partial operational batch publishes. The full post-promotion ledger and measured errors do not exist yet.

The pinned NumPy and pytest overlay resides in `/tmp/run02-promotion-deps`; recreate a normal environment with `backend/requirements-pipeline.txt` if that temporary folder disappears. No shared environment or original repository environment was changed. Calendar maintenance and verified official-input sourcing continue to be operational prerequisites.

Scheduling, remote workflow execution and Vercel deployment remain disabled and require a separate user-authorized change. Both workflow jobs have `if: ${{ false }}`, no schedule or external dispatch triggers, read-only Git permissions, and no commit/push step.

## Manual execution after review (not executed)

From this repository, with the verified temporary runtime still present:

```bash
cd /Users/alvintubtub/Downloads/pse-stock-price-forecast-corrected-research
PYTHONPATH=/tmp/run02-promotion-deps:backend /opt/anaconda3/envs/pse-backend/bin/python backend/scripts/run_operational.py
PYTHONPATH=/tmp/run02-promotion-deps:backend /opt/anaconda3/envs/pse-backend/bin/python backend/scripts/export_forecast_artifacts.py
PYTHONPATH=/tmp/run02-promotion-deps:backend /opt/anaconda3/envs/pse-backend/bin/python backend/scripts/validate_exports.py
```

If the source CSVs are stale, use the official ingestion entrypoint first; do not bypass freshness checks or run the smoke command as live generation:

```bash
PYTHONPATH=/tmp/run02-promotion-deps:backend /opt/anaconda3/envs/pse-backend/bin/python backend/run_pipeline.py --no-train
```

## Exact review and commit commands (not executed)

`changed-files.txt` lists every changed/new review file, including this report. It excludes all ignored build/test caches and virtual environments.

```bash
cd /Users/alvintubtub/Downloads/pse-stock-price-forecast-corrected-research
test "$(git branch --show-current)" = "codex/run02-operational-promotion"
git status --short
git diff --check
git diff --stat
git diff
cat reports/run02-promotion/changed-files.txt
```

After reviewing the new files as well as the tracked diff:

```bash
git add --pathspec-from-file=reports/run02-promotion/changed-files.txt
git diff --cached --check
git diff --cached --stat
git diff --cached
git commit -m "Add controlled Run 02 operational promotion with frozen manifests"
```

No push command is needed for this local review. Do not run any of these commands in the original repository.
