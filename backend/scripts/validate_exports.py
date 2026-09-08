"""Post-export validation for the frontend JSON artifacts.

Runs as the last check before the Fast Pipeline commits/pushes anything —
after export_forecast_artifacts.py has written frontend/public/forecasts/.
Confirms the export actually produced a complete, consistent 15-ticker
dashboard rather than silently committing a partial/broken data set.

This does NOT re-validate OHLCV data (that already happens earlier, both
inside services/pdf_pipeline/pipeline.py post-merge and via
services/data_validator.py) — it only checks the shape of what
export_forecast_artifacts.py just wrote.

Usage:
    python backend/scripts/validate_exports.py

Exit codes:
    0  all checks passed
    1  one or more checks failed
"""
from __future__ import annotations

import json
import math
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent  # backend/
REPO_ROOT = BASE_DIR.parent
FORECASTS_DIR = REPO_ROOT / "frontend" / "public" / "forecasts"

sys.path.insert(0, str(BASE_DIR))
from services.pdf_pipeline.config import TARGET_COMPANIES  # noqa: E402

EXPECTED_TICKERS = sorted(TARGET_COMPANIES.keys())
BACKTEST_MODELS = {"Lag-Informed Regression", "ARIMA", "LSTM", "Naive baseline"}
PRODUCTION_BACKTEST_MODELS = {"Lag-Informed Regression", "ARIMA", "LSTM"}
FORMAL_RUN_ID = "FORMAL_CORRECTED_20260828_02"
FORMAL_CODE_COMMIT = "bfb33b8c184c87cc8828af5529410da94addd71c"
FORMAL_ARCHIVE_SHA256 = "2b2ed0ca6b88ea6cfef5ac14013440da1c7c55c1d9f9640e04a595fdafca5d24"
FORMAL_MODEL_IDS = {"lag_reg", "arima", "lstm", "naive"}


def _load(path: Path) -> dict | list | None:
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text())
    except Exception as exc:
        raise AssertionError(f"{path} is not valid JSON: {exc}") from exc


def _validate_formal_study(errors: list[str]) -> None:
    path = FORECASTS_DIR / "formal" / f"{FORMAL_RUN_ID}.json"
    formal = _load(path)
    if not isinstance(formal, dict):
        errors.append(f"Missing or invalid approved formal-study dataset: {path}")
        return
    if formal.get("schemaVersion") != 1 or formal.get("kind") != "immutable_formal_study":
        errors.append("formal study: unsupported schema or artifact kind")
    if formal.get("runId") != FORMAL_RUN_ID or formal.get("status") != "complete":
        errors.append("formal study: approved run identity/status is invalid")
    identity = formal.get("identity", {})
    if identity.get("repositoryCommit") != FORMAL_CODE_COMMIT:
        errors.append("formal study: repository commit does not match the approved runner")
    if identity.get("archiveSha256") != FORMAL_ARCHIVE_SHA256:
        errors.append("formal study: evidence archive SHA-256 does not match the audited release")
    data = formal.get("data", {})
    expected_data = {
        "companyCount": 15,
        "rowsPerCompany": 1624,
        "totalRows": 24360,
        "developmentPairsPerCompany": 1380,
        "holdoutPairsPerCompany": 243,
        "totalHoldoutPredictions": 14580,
        "cutoffDate": "2026-08-28",
    }
    for key, expected_value in expected_data.items():
        if data.get(key) != expected_value:
            errors.append(f"formal study: {key}={data.get(key)!r}, expected {expected_value!r}")
    conclusion = formal.get("conclusion", {})
    if conclusion.get("principalRmseWins") != {"lag_reg": 7, "arima": 7, "lstm": 1}:
        errors.append("formal study: principal RMSE win counts must remain 7/7/1")
    if conclusion.get("dominantModel") is not None or conclusion.get("dominanceThreshold") != 8:
        errors.append("formal study: no model should be reported as meeting the 8-of-15 threshold")
    significant = {(row.get("symbol"), row.get("model")) for row in conclusion.get("significantVsNaive", [])}
    if significant != {("ICT", "lag_reg"), ("MBT", "lag_reg")}:
        errors.append("formal study: significant-vs-Naive findings do not match the audit")

    rows = formal.get("perCompany")
    if not isinstance(rows, list):
        errors.append("formal study: perCompany must be a list")
        return
    symbols = [row.get("symbol") for row in rows if isinstance(row, dict)]
    if sorted(symbols) != EXPECTED_TICKERS or len(symbols) != len(set(symbols)):
        errors.append("formal study: per-company coverage must contain all 15 companies exactly once")
    metric_row_count = 0
    for row in rows:
        if not isinstance(row, dict):
            continue
        metrics_by_model = row.get("metrics")
        if not isinstance(metrics_by_model, dict) or set(metrics_by_model) != FORMAL_MODEL_IDS:
            errors.append(f"formal study: {row.get('symbol')} has incomplete model metrics")
            continue
        for model, metric in metrics_by_model.items():
            metric_row_count += 1
            if not isinstance(metric, dict):
                errors.append(f"formal study: {row.get('symbol')}/{model} metric is malformed")
                continue
            for key in ("rmse", "mae", "mase", "r2"):
                value = metric.get(key)
                if not isinstance(value, (int, float)) or not math.isfinite(value):
                    errors.append(f"formal study: {row.get('symbol')}/{model}/{key} is not finite")
    if metric_row_count != 60:
        errors.append(f"formal study: found {metric_row_count} metric rows, expected 60")


def main() -> int:
    errors: list[str] = []

    companies = _load(FORECASTS_DIR / "companies.json")
    if companies is None:
        errors.append(f"Missing {FORECASTS_DIR / 'companies.json'}")
    else:
        found_symbols = sorted(c["symbol"] for c in companies)
        missing = sorted(set(EXPECTED_TICKERS) - set(found_symbols))
        extra = sorted(set(found_symbols) - set(EXPECTED_TICKERS))
        if missing:
            errors.append(f"companies.json is missing ticker(s): {', '.join(missing)}")
        if extra:
            errors.append(f"companies.json has unexpected ticker(s): {', '.join(extra)}")
        if len(found_symbols) != len(EXPECTED_TICKERS):
            errors.append(
                f"companies.json has {len(found_symbols)} companies, expected {len(EXPECTED_TICKERS)}"
            )

    dashboard = _load(FORECASTS_DIR / "dashboard.json")
    if dashboard is None:
        errors.append(f"Missing {FORECASTS_DIR / 'dashboard.json'}")
    else:
        if dashboard.get("missingCompanies"):
            errors.append(f"dashboard.json reports missingCompanies: {dashboard['missingCompanies']}")
        if dashboard.get("totalCompanies") != len(EXPECTED_TICKERS):
            errors.append(
                f"dashboard.json totalCompanies={dashboard.get('totalCompanies')}, "
                f"expected {len(EXPECTED_TICKERS)}"
            )

    latest = _load(FORECASTS_DIR / "latest.json")
    if latest is None:
        errors.append(f"Missing {FORECASTS_DIR / 'latest.json'}")
    elif latest.get("status") == "error":
        errors.append("latest.json status is 'error' — refusing to publish a failed run's artifacts")

    metrics = _load(FORECASTS_DIR / "metrics.json")
    if metrics is None:
        errors.append(f"Missing {FORECASTS_DIR / 'metrics.json'}")
    elif isinstance(metrics, dict):
        per_company = metrics.get("perCompany", {})
        for symbol in EXPECTED_TICKERS:
            if symbol in per_company:
                comp_metric = per_company[symbol]
                if "naiveComparison" not in comp_metric:
                    errors.append(f"metrics.json: {symbol} missing naiveComparison")
                elif comp_metric["naiveComparison"] is not None and not isinstance(comp_metric["naiveComparison"], dict):
                    errors.append(f"metrics.json: {symbol} naiveComparison must be dict or null")

    _validate_formal_study(errors)

    for symbol in EXPECTED_TICKERS:
        company_path = FORECASTS_DIR / "company" / f"{symbol}.json"
        history_path = FORECASTS_DIR / "history" / f"{symbol}.json"
        if not company_path.exists():
            errors.append(f"Missing {company_path}")
        if not history_path.exists():
            errors.append(f"Missing {history_path}")
        detail = _load(company_path)
        if not isinstance(detail, dict):
            continue
        if "naiveComparison" not in detail:
            errors.append(f"{symbol}: missing naiveComparison in company detail")
        elif detail["naiveComparison"] is not None:
            nc = detail["naiveComparison"]
            if not isinstance(nc, dict):
                errors.append(f"{symbol}: naiveComparison must be a dict or null")
            else:
                for req_key in ("model_a", "model_b", "direction", "beats_naive_rmse", "significantly_beats_naive", "holm_adjusted_p_value"):
                    if req_key not in nc:
                        errors.append(f"{symbol}: naiveComparison missing {req_key}")
        dates = detail.get("backtestDates")
        actual = detail.get("backtestActual")
        by_model = detail.get("backtestByModel")
        methodology = detail.get("backtestMethodology")
        if not isinstance(dates, list) or len(dates) != 60 or dates != sorted(dates) or len(set(dates)) != 60:
            errors.append(f"{symbol}: backtestDates must contain exactly 60 unique chronological sessions")
            continue
        if not isinstance(actual, list) or len(actual) != len(dates):
            errors.append(f"{symbol}: backtestActual does not align with backtestDates")
        if not isinstance(by_model, dict) or set(by_model) != BACKTEST_MODELS:
            errors.append(f"{symbol}: backtestByModel must contain exactly the four audited models")
        elif any(not isinstance(values, list) or len(values) != len(dates) for values in by_model.values()):
            errors.append(f"{symbol}: a model prediction series does not align with backtestDates")
        if methodology != {"source": "audited_oos_holdout", "alignment": "common_target_date", "window": 60}:
            errors.append(f"{symbol}: backtest methodology metadata is missing or invalid")
        production_dates = detail.get("productionBacktestDates")
        production_actual = detail.get("productionBacktestActual")
        production_by_model = detail.get("productionBacktestByModel")
        if not isinstance(production_dates, list) or production_dates != sorted(production_dates) or len(production_dates) != len(set(production_dates)) or len(production_dates) > 60:
            errors.append(f"{symbol}: production backtest dates must be unique, chronological, and no longer than 60 sessions")
        elif not isinstance(production_actual, list) or len(production_actual) != len(production_dates):
            errors.append(f"{symbol}: production actuals do not align with production dates")
        elif not isinstance(production_by_model, dict) or set(production_by_model) != PRODUCTION_BACKTEST_MODELS:
            errors.append(f"{symbol}: production predictions must contain exactly the three production models")
        elif any(not isinstance(values, list) or len(values) != len(production_dates) for values in production_by_model.values()):
            errors.append(f"{symbol}: production prediction series do not align with production dates")

    from services.operational_deployment import load_manifest, read_json, validate_batch
    try:
        active_manifest, _ = load_manifest(required_scope="production_inference")
        if _load(FORECASTS_DIR / "active-deployment.json") != active_manifest:
            errors.append("operational deployment: active-deployment.json does not match the active backend manifest")
        operational = FORECASTS_DIR / "operational.json"
        if operational.exists():
            payload = read_json(operational)
            manifest, sha = load_manifest(version=payload["deploymentVersion"])
            validate_batch(payload, manifest, sha)
        else:
            load_manifest(required_scope="production_inference")
            print("[validate] Approved manifest valid; full operational generation pending (legacy snapshot only).")
    except Exception as exc:
        errors.append(f"operational deployment: {exc}")

    print("=" * 60)
    print("Validating exported frontend artifacts...")
    print(f"Directory: {FORECASTS_DIR}")
    print("=" * 60)

    if errors:
        print(f"FAILED — {len(errors)} issue(s):")
        for e in errors:
            print(f"  - {e}")
        return 1

    print(f"OK — {len(EXPECTED_TICKERS)}/{len(EXPECTED_TICKERS)} companies present, "
          "operational exports consistent, approved formal study intact.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
