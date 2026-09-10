# Run 02 operational promotion review

This review describes the implementation currently on `main` through commit
`cf34752c08bd2a0e152e1c85c0576c5bf0a98a30`. The active operational deployment is approved,
complete for all 15 companies, and producing prospective forecasts. Formal Run 02 remains an
immutable research result and is not used as operational forecast history.

## Identity and approval

- Formal run: `FORMAL_CORRECTED_20260828_02`.
- Formal source-data cutoff: August 28, 2026.
- Approved formal implementation commit: `bfb33b8c184c87cc8828af5529410da94addd71c`.
- Evidence archive SHA-256: `2b2ed0ca6b88ea6cfef5ac14013440da1c7c55c1d9f9640e04a595fdafca5d24`.
- Formal frontend summary SHA-256: `c0a5962709be16a82e5f5eeb634424ef0cad93a05d08db5c8af02e1d90ff5a6e`.
- Original promotion identifier: `RUN02_OPS_20260907_01`.
- Controlled operational target boundary: September 8, 2026.
- Active deployment: `RUN02_OPS_20260908_105811Z`, activated September 8, 2026.
- Frozen configuration source manifest SHA-256: `1182b54f0290d50ed5160e1cfb1ff13a5b214796268769460f6cf4fa711aa179`.
- Active deployment manifest SHA-256: `9f48dd4c5e2623e3debd8b434a967dbbe4729e26d3bc17374cbcdf3b33284b0a`.
- Approval record: `RUN02_AUTH_20260908_01`, SHA-256
  `85c43a1e88b98f0f86d712892cb03bcfee6fc83a918064a92064c11a425a7f0c`.
- Approval status: approved for production inference and the separately scheduled refresh. Challenger
  retuning and automatic promotion remain unauthorized.
- Comparison manifest: `RUN02_COMPARISON_20260910_01`, SHA-256
  `ccc03428b302db82642970ae7ca1dd31cc30eaeed6d0b643d19fc489759a2377`.
- Comparison approval: `RUN02_COMPARISON_AUTH_20260910_01`, SHA-256
  `68efbb548fc5bb38c0ccc547b71f5caab235d131f984fc89e7c731efb4547b3b`.

## Frozen company mapping

The selected family is the lowest Run 02 holdout RMSE among the three principal model families.
Naive remains an evaluation benchmark and is not eligible for deployment. The selected families and
configurations are fixed; an operational run cannot search, retune, substitute, or promote a model.

| Company | Selected family | Frozen configuration |
|---|---|---|
| ALI | Lag-Informed Regression | alpha=0.1; PACF return lags=[5]; 32 candidate columns |
| APX | Lag-Informed Regression | alpha=0.01; PACF return lags=[1, 4, 6, 16]; 35 candidate columns |
| BPI | ARIMA | order=(1,1,1); trend=n; statespace; maxiter=2000 |
| GLO | ARIMA | order=(0,1,0); trend=n; statespace; maxiter=2000 |
| ICT | LSTM | lookback=30; hidden=25; learning rate=0.001; batch=16; epochs=47; seed=42 |
| JFC | Lag-Informed Regression | alpha=1.58489319246; PACF return lags=[4, 9, 16, 20]; 35 candidate columns |
| MBT | ARIMA | order=(2,1,0); trend=n; statespace; maxiter=2000 |
| MEG | Lag-Informed Regression | alpha=0.0158489319246; PACF return lags=[1]; 32 candidate columns |
| MER | Lag-Informed Regression | alpha=0.398107170553; PACF return lags=[1, 2, 8, 9, 11]; 36 candidate columns |
| NIKL | Lag-Informed Regression | alpha=0.0251188643151; PACF return lags=[13]; 32 candidate columns |
| PGOLD | ARIMA | order=(1,1,0); trend=n; statespace; maxiter=2000 |
| SCC | ARIMA | order=(0,1,0); trend=n; statespace; maxiter=2000 |
| SECB | ARIMA | order=(1,0,0); trend=n; statespace; maxiter=2000 |
| SHLPH | ARIMA | order=(0,1,3); trend=t; statespace; maxiter=2000 |
| SMPH | Lag-Informed Regression | alpha=0.0398107170553; PACF return lags=[1, 2]; 33 candidate columns |

The complete configurations and per-artifact hashes are stored in the active schema-v2 manifest.
Lag-Informed Regression re-estimates coefficients only during an authorized deployment refresh while
retaining its candidate columns, alpha, and PACF lag set. ARIMA retains its order and trend. LSTM
retains its architecture, fixed epoch count, and seed.

## Operational controls

Daily `run_pipeline.py --no-train` validates approval before ingestion and then uses
`operational_deployment.infer_daily`. It loads the active hash-checked persisted artifact for each
company's selected family and issues one operational next-session forecast. Under an independent
comparison-only approval, the same run loads the two non-selected persisted artifacts from a
dedicated 45-artifact hash-pinned manifest. It constructs a three-model shadow snapshot for every
company. Daily inference performs no fitting, hyperparameter search, model selection,
fallback-family substitution, or automatic promotion.

The separately authorized `deployment-refresh --strict` operation refits only each company's
selected family with its frozen configuration. It writes a new immutable version directory, reloads
and hash-checks every artifact, verifies training-data lineage and predictions, and updates the active
pointer atomically only after all 15 companies succeed.

Operational input and publication safeguards include:

- exact 15-company manifest and batch coverage;
- explicit approval scopes and hash-checked manifest identity;
- completed-session freshness and common source-data cutoff checks;
- rejection of missing, stale, malformed, non-finite, or changing inputs;
- one deployment lock across inference and refresh;
- preservation of the first forecast already issued for a target session;
- reconciliation of actuals and errors only after official target-session data arrives; and
- atomic publication only after the selected operational forecasts and all 45 comparison predictions
  succeed.

The current batch contains 15 forecasts using data through September 10 and targets September 11,
2026. Its immutable operational history contains 60 rows: 15 each for September 8, September 9,
September 10, and September 11. The first three target dates are realized; September 11 remains
pending.

## Formal and operational separation

The formal summary under `frontend/public/forecasts/formal/` is generated only by the dedicated
formal exporter, which refuses a non-identical overwrite. Normal ingestion, operational inference,
deployment refresh, reconciliation, and frontend export do not recompute or modify Run 02 evidence
or metrics.

Formal holdout predictions are never copied into operational history. Operational rows must include
their original issue time, target date, source-data hash, deployment version, manifest hash, selected
configuration, and artifact hash. A realized error is accepted only for a forecast issued before the
target session opened.

## Historical chart handling

Company Backtest and Forecast Error charts combine distinct sources without relabelling them:

- stored evaluation through August 28, 2026;
- legacy forecasts issued for September 2–7 target sessions; and
- controlled operational selected-model forecasts beginning September 8.

The chart window contains only the latest 60 realized target sessions. Pending September 11
forecasts appear in the next-session presentation and are excluded from realized-history charts.

Each company production-history ledger contains six realized three-model records for September 2,
3, 4, 7, 8, and 9. September 9 therefore displays Actual, Lag-Informed Regression, ARIMA, and LSTM
for all 15 companies. The September 10 target was issued before this comparison change and honestly
retains only its selected operational prediction. From September 8 onward, the selected line is the
controlled operational result; non-selected lines, when prospectively issued, are contemporaneous
comparison forecasts. They are not promoted models.

Beginning with the first new target issued after this comparison change is committed and run, the
daily controlled pipeline records all three model values in each operational issuance row. The
manifest-selected family remains the sole operational forecast; the other two are shadow comparisons.
The frontend displays those rows only after the target actual is available and deliberately leaves
older missing values absent instead of generating retrospective predictions.

## Frontend behavior

The frontend accepts an operational batch only when the issuing manifest is approved, complete,
hash-valid, production-scoped, and consistent with all 15 selected families. It safely rejects
development, partial, stale, or altered data. The Models page presents formal model performance
without exposing internal formal-run identifiers, code hashes, or repository links in the public UI.
Company pages display the active operational deployment, current next-session selected-model
forecast, explicit legacy and controlled boundaries, and honest realized error coverage.

## Workflow safety

- `.github/workflows/update_pipeline.yml` is enabled for `repository_dispatch` event
  `update-pse-data` and manual `workflow_dispatch`. Its intended external Cron-job.org schedule is
  Monday 17:30 and Tuesday–Friday 16:00 in `Asia/Manila`. The repository cannot verify the external
  Cron-job.org account configuration or token state.
- `.github/workflows/train_models.yml` is enabled only for cron `0 0 3 11 *`, corresponding to
  November 3 at 08:00 PHT. A UTC date guard permits execution only on `2026-11-03`, preventing the
  cron expression from running the refresh in later years.
- Both workflows use the `pse-pipeline` concurrency group, validate artifacts before committing,
  and have only `contents: write` permission.
- A successful artifact commit can trigger the connected Vercel project through its normal Git
  integration. Neither workflow contains a Vercel CLI deployment command.

## Verification completed September 10, 2026

- Backend: `python -m pytest -q` — 278 passed; no failures.
- Frontend: `npm run test:all` — all three frontend suites passed.
- TypeScript: `npx tsc --noEmit --incremental false` — passed.
- Production frontend build: `npm run build` — passed; 28 routes generated.
- Export validator: passed for all 15 companies with the approved formal result intact.
- Evidence archive verification: passed; archive SHA-256 and all 189 entries matched.
- Browser check: ALI company view rendered both chart boundaries and all three model series through
  September 9. The September 10 selected-only point accurately reflects its pre-change issuance.
  Synthetic frontend assertions verify three-model rendering for newly issued comparison rows.

## Current assessment

**GO for continued complete 15-company selected-model operational inference**, subject to the normal
calendar, freshness, approval, manifest, and artifact checks at execution. The fail-closed behavior
must remain in place.

The controlled three-model shadow issuance is now implemented. Its first production target will be
the next target that does not already have an immutable issuance when the updated daily workflow
runs. Existing same-target forecasts remain unchanged, so gaps from targets issued before this
change—September 10 and the already-issued September 11 target—are intentionally not backfilled.

## Review and later commit

Run from the repository root:

```bash
git status --short
git diff --check
git diff -- frontend/README.md backend/README.md reports/run02-promotion/REVIEW.md COMPLETION_REPORT.md
```

After review, the documentation can be committed and pushed separately:

```bash
git add frontend/README.md backend/README.md reports/run02-promotion/REVIEW.md COMPLETION_REPORT.md
git diff --cached --check
git diff --cached
git commit -m "Update operational promotion documentation"
git push origin main
```
