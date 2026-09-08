"""Approved Run 02 refits and prospective history; never selects or retunes."""
from __future__ import annotations

import copy
import hashlib
import json
import logging
import importlib.metadata
import platform
import shutil
import warnings
import math
import os
import tempfile
from datetime import datetime, time, timedelta, timezone
from pathlib import Path

import numpy as np
import pandas as pd

from services.data_validator import validate_ohlcv_csv
from services.pdf_pipeline.config import TARGET_COMPANIES
from services.pse_calendar import get_calendar

log = logging.getLogger(__name__)
BASE = Path(__file__).resolve().parents[1]
CANONICAL_MANIFEST_PATH = BASE / "models/deployment/current/deployment_manifest.json"
MANIFEST_DIR = CANONICAL_MANIFEST_PATH.parent
OUTPUT = BASE / "operational"
PHT = timezone(timedelta(hours=8))
PROMOTION = "RUN02_OPS_20260907_01"
REVIEWED_MANIFEST_SHA256 = "1182b54f0290d50ed5160e1cfb1ff13a5b214796268769460f6cf4fa711aa179"
RUN_ID = "FORMAL_CORRECTED_20260828_02"
CODE = "bfb33b8c184c87cc8828af5529410da94addd71c"
ARCHIVE = "2b2ed0ca6b88ea6cfef5ac14013440da1c7c55c1d9f9640e04a595fdafca5d24"
LABELS = {"lag_reg": "Lag-Informed Regression", "arima": "ARIMA", "lstm": "LSTM"}


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def read_json(path: Path) -> dict:
    def unique(pairs):
        result = {}
        for key, value in pairs:
            if key in result:
                raise ValueError(f"Duplicate JSON key: {key}")
            result[key] = value
        return result
    return json.loads(path.read_text(), object_pairs_hook=unique,
                      parse_constant=lambda value: (_ for _ in ()).throw(ValueError(value)))


def load_manifest(directory: Path | None = None) -> tuple[dict, str]:
    """Require full universe, valid approval, and pinned study identity from canonical manifest."""
    if directory is not None:
        if directory.is_file():
            path = directory
        elif (directory / "deployment_manifest.json").is_file():
            path = directory / "deployment_manifest.json"
        elif (directory / f"{PROMOTION}.json").is_file():
            path = directory / f"{PROMOTION}.json"
        elif (directory / "active.json").is_file():
            active = read_json(directory / "active.json")
            path = directory / active.get("manifest", f"{PROMOTION}.json")
        else:
            path = directory / "deployment_manifest.json"
    else:
        path = CANONICAL_MANIFEST_PATH

    sha = digest(path)
    manifest = read_json(path)
    expected = {"schema_version": 1, "promotion_id": PROMOTION, "formal_run_id": RUN_ID,
                "approved_code_commit": CODE, "evidence_archive_sha256": ARCHIVE,
                "source_data_cutoff": "2026-08-28", "promotion_date": "2026-09-07"}
    if any(manifest.get(k) != v for k, v in expected.items()):
        raise ValueError("Deployment identity is invalid")
    approval = manifest.get("approval", {})
    if (approval.get("status") != "approved" or approval.get("scope") != "manual_local_operational_generation"
            or not approval.get("authority") or approval.get("date") != manifest["promotion_date"]
            or approval.get("scheduled_workflows") is not False or approval.get("production_deployment") is not False):
        raise ValueError("Deployment lacks explicit approval for manual local generation")
    study_path = BASE.parent / "frontend/public/forecasts/formal" / f"{RUN_ID}.json"
    if digest(study_path) != manifest.get("formal_summary_sha256"):
        raise ValueError("Immutable formal summary hash mismatch")
    study = read_json(study_path)
    if manifest.get("source_data_commit") != study["identity"]["sourceDataCommit"]:
        raise ValueError("Source data commit mismatch")
    companies = manifest.get("companies", {})
    if set(companies) != set(TARGET_COMPANIES):
        raise ValueError("Manifest must contain exactly all 15 companies")
    from services.feature_engineering import REGRESSION_FEATURE_COLUMNS, RETURN_LAG_COLUMNS
    for row in study["perCompany"]:
        symbol = row["symbol"]
        item = companies[symbol]
        model = item.get("model")
        config = item.get("configuration", {})
        if (model != row["principalWinnerByRmse"] or item.get("source_data_cutoff") != manifest["source_data_cutoff"]
                or item.get("source_data_sha256") != row["dataSha256"]):
            raise ValueError(f"{symbol}: selection or source identity differs from Run 02")
        if model == "lag_reg":
            lags = config.get("pacf_selected_lags", [])
            if not lags or any(type(n) is not int or not 1 <= n <= 20 for n in lags) or len(set(lags)) != len(lags):
                raise ValueError(f"{symbol}: invalid frozen PACF lags")
            columns = [c for c in REGRESSION_FEATURE_COLUMNS if c not in RETURN_LAG_COLUMNS or c in {f"return_lag_{n}" for n in lags}]
            expected_config = dict(alpha=row["configuration"]["lagRegression"]["alpha"], candidate_features=columns,
                                   pacf_selected_lags=lags, max_iter=50000, tol=0.001, seed=42,
                                   target="next_close_delta", scaler="StandardScaler")
        elif model == "arima":
            formal = row["configuration"]["arima"]
            expected_config = dict(order=formal["order"], trend=formal["trend"], method="statespace", maxiter=2000, target="Close")
        elif model == "lstm":
            formal = row["configuration"]["lstm"]
            expected_config = dict(lookback=formal["lookback"], hidden_size=formal["hiddenSize"], learning_rate=formal["learningRate"],
                                   batch_size=formal["batchSize"], fixed_epochs=formal["fixedEpochs"], seed=formal["finalFitSeed"],
                                   input_design="univariate_close_delta", scaler="MinMaxScaler", optimizer="Adam", loss="MSELoss")
        else:
            raise ValueError(f"{symbol}: unsupported model")
        if config != expected_config:
            raise ValueError(f"{symbol}: incomplete or altered frozen configuration")
    if directory is not None and directory.resolve() != CANONICAL_MANIFEST_PATH.parent.resolve() and sha != digest(CANONICAL_MANIFEST_PATH):
        raise ValueError("Manifest differs from reviewed Run 02 configuration")
    log.info("Validated approved deployment %s (%s)", PROMOTION, sha)
    return manifest, sha


def predict_persisted(df: pd.DataFrame, symbol: str, item: dict, base_dir: Path = BASE) -> float:
    """Load persisted approved model artifact and forecast one step ahead; never fit or retrain."""
    from services.forecasting import arima_model, lag_regression, lstm_model
    model_family = item["model"]
    current_dir = base_dir / "models/deployment/current"
    if model_family == "lag_reg":
        artifact_path = current_dir / "lag_regression" / f"{symbol}.pkl"
        artifact = lag_regression.load(artifact_path)
        value = lag_regression.predict_next(artifact, df)
    elif model_family == "arima":
        artifact_path = current_dir / "arima" / f"{symbol}.pkl"
        model = arima_model.load(artifact_path)
        close = df["Close"].astype(float)
        endog = pd.Series(model.model.endog.flatten(), name="Close")
        n_endog = len(endog)
        if n_endog > len(close):
            raise ValueError(
                f"{symbol} ARIMA model was trained on {n_endog} obs, but current data has {len(close)} rows."
            )
        historical_close = close.iloc[:n_endog].reset_index(drop=True)
        endog_aligned = endog.reset_index(drop=True)
        diff = np.abs(historical_close.values - endog_aligned.values)
        if float(np.max(diff)) > 1e-3:
            raise ValueError(f"{symbol} ARIMA model/data lineage mismatch against model.model.endog.")
        new_close = close.iloc[n_endog:]
        if len(new_close) > 0:
            log.info("%s ARIMA: appending %d new observation(s) with refit=False", symbol, len(new_close))
            model = model.append(new_close.values, refit=False)
        value = arima_model.predict_next(model)
    elif model_family == "lstm":
        artifact_path = current_dir / "lstm" / f"{symbol}.pth"
        artifact = lstm_model.load(artifact_path)
        value = lstm_model.predict_next(artifact, df)
    else:
        raise ValueError(f"{symbol}: unsupported model {model_family}")
    if not math.isfinite(float(value)) or value <= 0:
        raise ValueError("Model produced a non-finite or non-positive price")
    return round(float(value), 2)


def refit_predict(df: pd.DataFrame, item: dict, return_artifact: bool = False):
    """Fresh model and scaler, frozen structure; returns predicted_value (or (value, fitted_artifact) if return_artifact=True)."""
    from services.forecasting import arima_model, lag_regression, lstm_model
    config = item["configuration"]
    if item["model"] == "lag_reg":
        frozen = lag_regression.LagRegressionDeploymentConfig(
            config["alpha"], tuple(config["candidate_features"]), tuple(config["pacf_selected_lags"])
        )
        from sklearn.exceptions import ConvergenceWarning
        with warnings.catch_warnings():
            warnings.simplefilter("error", ConvergenceWarning)
            artifact = lag_regression.refit_deployment_lag_regression(df, frozen)
        value = lag_regression.predict_next(artifact, df)
        fitted = artifact
    elif item["model"] == "arima":
        frozen = arima_model.ARIMAConfiguration(tuple(config["order"]), config["trend"])
        fitted = arima_model.refit_deployment_arima(df, frozen)
        value = arima_model.predict_next(fitted)
    else:
        artifact = lstm_model.refit_frozen_lstm(df, config)
        value = lstm_model.predict_next(artifact, df)
        fitted = artifact
    if not math.isfinite(float(value)) or value <= 0:
        raise ValueError("Model produced a non-finite or non-positive price")
    rounded = round(float(value), 2)
    if return_artifact:
        return rounded, fitted
    return rounded


def atomic_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    encoded = json.dumps(payload, indent=2, allow_nan=False) + "\n"
    fd, temporary = tempfile.mkstemp(prefix=".pending-", dir=path.parent)
    try:
        with os.fdopen(fd, "w") as stream:
            stream.write(encoded)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def validate_data(path: Path, *, now: datetime, development: bool):
    df = validate_ohlcv_csv(path)
    if len(df) < 1624 or df["Date"].iloc[0].date().isoformat() != "2020-01-02":
        raise ValueError(f"{path.stem}: incomplete official source history")
    numeric = df[["Open", "High", "Low", "Close", "Volume"]].to_numpy(dtype=float)
    if not np.isfinite(numeric).all():
        raise ValueError(f"{path.stem}: non-finite OHLCV")
    last = df["Date"].iloc[-1].date()
    cal = get_calendar()
    if last > now.date() or last.isoformat() < "2026-08-28":
        raise ValueError(f"{path.stem}: invalid data cutoff {last}")
    target = cal.next_trading_day(last)
    if not development:
        # After today's close, today's official close is required; before close use the prior session.
        expected = now.date()
        if now.time() < time(15, 30) or not cal.is_trading_day(expected):
            expected -= timedelta(days=1)
            while not cal.is_trading_day(expected):
                expected -= timedelta(days=1)
        if last != expected or datetime.combine(target, time(9, 30), tzinfo=PHT) <= now:
            raise ValueError(f"{path.stem}: stale data {last}; latest completed official session {expected} required")
    return df, target.isoformat()


def infer_daily(*, raw_dir: Path = BASE / "data/raw", output: Path = OUTPUT,
                symbols: list[str] | None = None, development: bool = False,
                now: datetime | None = None, manifest_dir: Path | None = None) -> dict:
    """Daily operational inference using persisted approved artifacts; no training or refitting."""
    manifest, sha = load_manifest(manifest_dir)
    now = (now or datetime.now(PHT)).astimezone(PHT)
    symbols = sorted(TARGET_COMPANIES) if symbols is None else symbols
    if len(set(symbols)) != len(symbols) or not symbols or not set(symbols) <= set(TARGET_COMPANIES):
        raise ValueError("Invalid symbol list")
    if development:
        if set(symbols) != {"ALI", "BPI"} or output.resolve() == OUTPUT.resolve() or BASE.parent / "frontend" in output.resolve().parents:
            raise ValueError("Development smoke must use ALI/BPI and an isolated non-production output")
    elif set(symbols) != set(TARGET_COMPANIES):
        raise ValueError("Operational generation requires all 15 companies")
    if now.date().isoformat() < manifest["promotion_date"]:
        raise ValueError("Cannot issue forecasts before approval")

    input_hashes = {s: digest(raw_dir / f"{s}.csv") for s in symbols}
    inputs = {s: validate_data(raw_dir / f"{s}.csv", now=now, development=development) for s in symbols}
    if len({target for _, target in inputs.values()}) != 1:
        raise ValueError("Company source-data cutoffs differ")

    output.mkdir(parents=True, exist_ok=True)
    lock = output / ".generation.lock"
    try:
        fd = os.open(lock, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    except FileExistsError as exc:
        raise ValueError("Generation already in progress; inspect lock before retrying") from exc
    os.close(fd)

    try:
        current = output / "current.json"
        previous = read_json(current) if current.exists() else {}
        if previous and (previous.get("manifestSha256") != sha or previous.get("developmentOnly") != development):
            raise ValueError("Existing ledger belongs to a different deployment or mode")
        if previous and not development:
            validate_batch(previous, manifest, sha)

        history = previous.get("history", [])
        forecasts = {}
        for symbol in symbols:
            df, target = inputs[symbol]
            source_hash = digest(raw_dir / f"{symbol}.csv")
            item = manifest["companies"][symbol]

            actuals = dict(zip(df["Date"].dt.strftime("%Y-%m-%d"), df["Close"].astype(float)))
            for record in history:
                if record["symbol"] == symbol and record["actual"] is None and record["forecastFor"] in actuals:
                    record["actual"] = actuals[record["forecastFor"]]
                    record["error"] = record["predictedClose"] - record["actual"]

            existing = next((r for r in history if r["symbol"] == symbol and r["forecastFor"] == target), None)
            if existing:
                if existing["sourceDataSha256"] != source_hash:
                    raise ValueError(f"{symbol}: source revised after issuance; manual review required")
                forecasts[symbol] = existing.copy()
                continue

            log.info("Predicting %s using persisted %s artifact on %d rows", symbol, item["model"], len(df))
            value = predict_persisted(df, symbol, item)
            record = {"symbol": symbol, "model": LABELS[item["model"]], "predictedClose": value,
                      "previousClose": float(df["Close"].iloc[-1]), "dataAsOf": df["Date"].iloc[-1].date().isoformat(),
                      "forecastFor": target, "issuedAt": now.isoformat(), "actual": None, "error": None,
                      "deploymentVersion": PROMOTION, "manifestSha256": sha, "formalRunId": RUN_ID,
                      "sourceDataSha256": source_hash, "configuration": item["configuration"],
                      "coverage": "development_smoke" if development else "post_promotion_prospective"}
            forecasts[symbol] = record
            if not development:
                history.append(record.copy())
            log.info("%s prediction complete: %.2f for %s (%s)", symbol, value, target, record["coverage"])

        payload = {"schemaVersion": 1, "deploymentVersion": PROMOTION, "manifestSha256": sha,
                   "formalRunId": RUN_ID, "approvalStatus": "approved", "promotionDate": manifest["promotion_date"],
                   "developmentOnly": development, "generatedAt": now.isoformat(),
                   "promotionBoundary": previous.get("promotionBoundary") or {"firstIssuedAt": now.isoformat(), "firstTargetDate": next(iter(forecasts.values()))["forecastFor"]},
                   "forecasts": forecasts, "history": history,
                   "ohlcv": {s: [{"date": row.Date.date().isoformat(), "open": float(row.Open), "high": float(row.High),
                                  "low": float(row.Low), "close": float(row.Close), "volume": int(row.Volume)}
                                 for row in df.itertuples()] for s, (df, _) in inputs.items()}}
        payload["runtime"] = {"python": platform.python_version(), **{
            package: importlib.metadata.version(package) for package in
            ("numpy", "pandas", "scikit-learn", "scipy", "statsmodels", "torch", "joblib")}}
        payload["implementationSha256"] = {str(path.relative_to(BASE)): digest(path) for path in [
            Path(__file__), BASE / "services/feature_engineering.py",
            *sorted((BASE / "services/forecasting").glob("*_model.py")), BASE / "services/forecasting/lag_regression.py"]}
        if development:
            payload["ohlcv"] = {}
        if any(digest(raw_dir / f"{s}.csv") != input_hashes[s] for s in symbols):
            raise ValueError("Source data changed during generation; retry the complete batch")
        if not development:
            validate_batch(payload, manifest, sha)
        atomic_json(current, payload)
        log.info("Published complete %d-company daily inference to %s", len(forecasts), current)
        return payload
    finally:
        lock.unlink(missing_ok=True)


def scheduled_refresh(*, raw_dir: Path = BASE / "data/raw", output: Path = OUTPUT,
                      symbols: list[str] | None = None, development: bool = False,
                      now: datetime | None = None, manifest_dir: Path | None = None,
                      strict: bool = False) -> dict:
    """Scheduled model refresh: refits all approved models on current validated data and persists artifacts."""
    from services.forecasting import arima_model, lag_regression, lstm_model
    manifest, _ = load_manifest(manifest_dir)
    now = (now or datetime.now(PHT)).astimezone(PHT)
    symbols = sorted(TARGET_COMPANIES) if symbols is None else symbols
    if strict and set(symbols) != set(TARGET_COMPANIES):
        raise ValueError("Strict scheduled refresh requires all 15 canonical companies")
    if len(set(symbols)) != len(symbols) or not symbols or not set(symbols) <= set(TARGET_COMPANIES):
        raise ValueError("Invalid symbol list")
    if now.date().isoformat() < manifest["promotion_date"]:
        raise ValueError("Cannot issue forecasts before approval")

    input_hashes = {s: digest(raw_dir / f"{s}.csv") for s in symbols}
    inputs = {s: validate_data(raw_dir / f"{s}.csv", now=now, development=development) for s in symbols}
    if len({target for _, target in inputs.values()}) != 1:
        raise ValueError("Company source-data cutoffs differ")

    output.mkdir(parents=True, exist_ok=True)
    lock = output / ".generation.lock"
    try:
        fd = os.open(lock, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    except FileExistsError as exc:
        raise ValueError("Refresh already in progress; inspect lock before retrying") from exc
    os.close(fd)

    staging_dir = Path(tempfile.mkdtemp(prefix=".refresh_staging_", dir=BASE / "models/deployment"))
    try:
        # Refit models in staging: if any model fails, staging is cleaned up and current deployment is preserved
        fitted_results = {}
        for symbol in symbols:
            df, target = inputs[symbol]
            item = manifest["companies"][symbol]
            log.info("Scheduled refresh: refitting %s (%s) on %d rows", symbol, item["model"], len(df))
            value, artifact = refit_predict(df, item, return_artifact=True)
            model_folder = "lag_regression" if item["model"] == "lag_reg" else item["model"]
            staged_folder = staging_dir / model_folder
            staged_folder.mkdir(parents=True, exist_ok=True)
            if item["model"] == "lag_reg":
                lag_regression.save(artifact, staged_folder / f"{symbol}.pkl")
            elif item["model"] == "arima":
                arima_model.save(artifact, staged_folder / f"{symbol}.pkl")
            elif item["model"] == "lstm":
                lstm_model.save(artifact, staged_folder / f"{symbol}.pth")
            fitted_results[symbol] = (value, target, digest(raw_dir / f"{symbol}.csv"), item)

        # All refits succeeded: atomically persist refreshed artifacts to models/deployment/current/
        target_current = CANONICAL_MANIFEST_PATH.parent
        new_artifact_hashes = copy.deepcopy(manifest.get("artifact_hashes", {}))
        for symbol in symbols:
            item = manifest["companies"][symbol]
            model_folder = "lag_regression" if item["model"] == "lag_reg" else item["model"]
            ext = "pth" if item["model"] == "lstm" else "pkl"
            staged_file = staging_dir / model_folder / f"{symbol}.{ext}"
            dest_file = target_current / model_folder / f"{symbol}.{ext}"
            dest_file.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(staged_file, dest_file)
            if symbol not in new_artifact_hashes:
                new_artifact_hashes[symbol] = {}
            new_artifact_hashes[symbol][model_folder] = digest(dest_file)

        # Update canonical manifest with operation: "refresh"
        updated_manifest = copy.deepcopy(manifest)
        updated_manifest["operation"] = "refresh"
        updated_manifest["last_refit_at"] = now.isoformat()
        updated_manifest["artifact_hashes"] = new_artifact_hashes
        atomic_json(CANONICAL_MANIFEST_PATH, updated_manifest)
        new_sha = digest(CANONICAL_MANIFEST_PATH)

        # Update forecasts ledger (even if a forecast for target already exists)
        current = output / "current.json"
        previous = read_json(current) if current.exists() else {}
        history = previous.get("history", [])
        forecasts = {}
        for symbol in symbols:
            df, _ = inputs[symbol]
            value, target, source_hash, item = fitted_results[symbol]
            record = {"symbol": symbol, "model": LABELS[item["model"]], "predictedClose": value,
                      "previousClose": float(df["Close"].iloc[-1]), "dataAsOf": df["Date"].iloc[-1].date().isoformat(),
                      "forecastFor": target, "issuedAt": now.isoformat(), "actual": None, "error": None,
                      "deploymentVersion": PROMOTION, "manifestSha256": new_sha, "formalRunId": RUN_ID,
                      "sourceDataSha256": source_hash, "configuration": item["configuration"],
                      "coverage": "development_smoke" if development else "post_promotion_prospective"}
            forecasts[symbol] = record
            if not development:
                existing_idx = next((i for i, r in enumerate(history) if r["symbol"] == symbol and r["forecastFor"] == target), None)
                if existing_idx is not None:
                    history[existing_idx] = record.copy()
                else:
                    history.append(record.copy())

        payload = {"schemaVersion": 1, "deploymentVersion": PROMOTION, "manifestSha256": new_sha,
                   "formalRunId": RUN_ID, "approvalStatus": "approved", "promotionDate": manifest["promotion_date"],
                   "developmentOnly": development, "generatedAt": now.isoformat(),
                   "promotionBoundary": previous.get("promotionBoundary") or {"firstIssuedAt": now.isoformat(), "firstTargetDate": next(iter(forecasts.values()))["forecastFor"]},
                   "forecasts": forecasts, "history": history,
                   "ohlcv": {s: [{"date": row.Date.date().isoformat(), "open": float(row.Open), "high": float(row.High),
                                  "low": float(row.Low), "close": float(row.Close), "volume": int(row.Volume)}
                                 for row in df.itertuples()] for s, (df, _) in inputs.items()}}
        payload["runtime"] = {"python": platform.python_version(), **{
            package: importlib.metadata.version(package) for package in
            ("numpy", "pandas", "scikit-learn", "scipy", "statsmodels", "torch", "joblib")}}
        payload["implementationSha256"] = {str(path.relative_to(BASE)): digest(path) for path in [
            Path(__file__), BASE / "services/feature_engineering.py",
            *sorted((BASE / "services/forecasting").glob("*_model.py")), BASE / "services/forecasting/lag_regression.py"]}
        if development:
            payload["ohlcv"] = {}
        if any(digest(raw_dir / f"{s}.csv") != input_hashes[s] for s in symbols):
            raise ValueError("Source data changed during refresh; retry the complete batch")
        if not development:
            validate_batch(payload, updated_manifest, new_sha)
        atomic_json(current, payload)
        log.info("Published complete %d-company scheduled refresh to %s", len(forecasts), current)
        return payload
    finally:
        shutil.rmtree(staging_dir, ignore_errors=True)
        lock.unlink(missing_ok=True)


def generate(*, raw_dir: Path = BASE / "data/raw", output: Path = OUTPUT,
             symbols: list[str] | None = None, development: bool = False,
             now: datetime | None = None, manifest_dir: Path | None = None,
             mode: str = "infer", strict: bool = False) -> dict:
    """Unified entrypoint: dispatches to infer_daily or scheduled_refresh based on mode."""
    if mode == "refresh":
        return scheduled_refresh(raw_dir=raw_dir, output=output, symbols=symbols,
                                 development=development, now=now, manifest_dir=manifest_dir,
                                 strict=strict)
    return infer_daily(raw_dir=raw_dir, output=output, symbols=symbols,
                       development=development, now=now, manifest_dir=manifest_dir)


def validate_batch(payload: dict, manifest: dict, sha: str) -> None:
    """Reject incomplete or corrupted publication and prospective history."""
    if (payload.get("schemaVersion") != 1 or payload.get("developmentOnly") is not False
            or payload.get("manifestSha256") != sha or payload.get("deploymentVersion") != PROMOTION
            or payload.get("formalRunId") != RUN_ID or payload.get("approvalStatus") != "approved"
            or set(payload.get("forecasts", {})) != set(manifest["companies"])):
        raise ValueError("Invalid complete operational batch")
    boundary = payload["promotionBoundary"]
    if boundary["firstIssuedAt"][:10] < manifest["promotion_date"]:
        raise ValueError("Promotion boundary predates approval")
    seen = set()
    for record in payload["history"]:
        key = record["symbol"], record["forecastFor"]
        if key in seen:
            raise ValueError("Duplicate prospective history record")
        seen.add(key)
        item = manifest["companies"][record["symbol"]]
        issued = datetime.fromisoformat(record["issuedAt"])
        target_open = datetime.fromisoformat(record["forecastFor"] + "T09:30:00+08:00")
        if (issued.tzinfo is None or issued >= target_open or record["dataAsOf"] >= record["forecastFor"]
                or record["issuedAt"] < boundary["firstIssuedAt"]
                or record["forecastFor"] < boundary["firstTargetDate"]
                or record["manifestSha256"] != sha or record["deploymentVersion"] != PROMOTION
                or record["configuration"] != item["configuration"] or record["model"] != LABELS[item["model"]]
                or record["coverage"] != "post_promotion_prospective"
                or not math.isfinite(record["predictedClose"]) or record["predictedClose"] <= 0):
            raise ValueError("Invalid prospective forecast provenance")
        if record["actual"] is not None:
            if not math.isfinite(record["actual"]) or not math.isclose(record["error"], record["predictedClose"] - record["actual"]):
                raise ValueError("Invalid realized forecast error")
        elif record["error"] is not None:
            raise ValueError("Unrealized forecast must not have an error")
    for symbol, row in payload["forecasts"].items():
        if row["symbol"] != symbol or row not in payload["history"]:
            raise ValueError("Current forecast is absent from immutable issuance history")
