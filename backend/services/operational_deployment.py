"""Versioned Run 02 operational deployments and immutable forecast issuance."""
from __future__ import annotations

import copy
import hashlib
import importlib.metadata
import json
import logging
import math
import os
import platform
import shutil
import subprocess
import tempfile
import warnings
from contextlib import contextmanager
from datetime import datetime, time, timedelta, timezone
from pathlib import Path

import numpy as np
import pandas as pd

from services.data_validator import validate_ohlcv_csv
from services.pdf_pipeline.config import TARGET_COMPANIES
from services.pse_calendar import get_calendar

log = logging.getLogger(__name__)
BASE = Path(__file__).resolve().parents[1]
DEPLOYMENT_ROOT = BASE / "models/deployment"
CANONICAL_MANIFEST_PATH = DEPLOYMENT_ROOT / "current/deployment_manifest.json"
MANIFEST_DIR = CANONICAL_MANIFEST_PATH.parent
VERSIONS_DIR = DEPLOYMENT_ROOT / "versions"
ACTIVE_POINTER = DEPLOYMENT_ROOT / "active.json"
APPROVAL_PATH = DEPLOYMENT_ROOT / "approvals/RUN02_AUTH_20260908_01.json"
OUTPUT = BASE / "operational"
LOCK_PATH = DEPLOYMENT_ROOT / ".deployment.lock"
PHT = timezone(timedelta(hours=8))
PROMOTION = "RUN02_OPS_20260907_01"
REVIEWED_MANIFEST_SHA256 = "1182b54f0290d50ed5160e1cfb1ff13a5b214796268769460f6cf4fa711aa179"
RUN_ID = "FORMAL_CORRECTED_20260828_02"
CODE = "bfb33b8c184c87cc8828af5529410da94addd71c"
ARCHIVE = "2b2ed0ca6b88ea6cfef5ac14013440da1c7c55c1d9f9640e04a595fdafca5d24"
LABELS = {"lag_reg": "Lag-Informed Regression", "arima": "ARIMA", "lstm": "LSTM"}


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def canonical_hash(payload: object) -> str:
    encoded = json.dumps(payload, sort_keys=True, separators=(",", ":"), allow_nan=False).encode()
    return hashlib.sha256(encoded).hexdigest()


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


def atomic_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    encoded = json.dumps(payload, indent=2, allow_nan=False) + "\n"
    fd, temporary = tempfile.mkstemp(prefix=".pending-", dir=path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as stream:
            stream.write(encoded)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


@contextmanager
def deployment_lock():
    """Serialize refresh and inference so a batch cannot cross deployments."""
    DEPLOYMENT_ROOT.mkdir(parents=True, exist_ok=True)
    try:
        fd = os.open(LOCK_PATH, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    except FileExistsError as exc:
        raise ValueError("Deployment operation already in progress; inspect lock before retrying") from exc
    try:
        os.write(fd, f"pid={os.getpid()}\n".encode())
        os.close(fd)
        yield
    finally:
        LOCK_PATH.unlink(missing_ok=True)


def _runtime() -> dict:
    packages = ("numpy", "pandas", "scikit-learn", "scipy", "statsmodels", "torch", "joblib")
    return {"python": platform.python_version(), "platform": platform.platform(),
            **{package: importlib.metadata.version(package) for package in packages}}


def _code_revision() -> dict:
    try:
        head = subprocess.run(["git", "rev-parse", "HEAD"], cwd=BASE.parent, check=True,
                              capture_output=True, text=True).stdout.strip()
        diff = subprocess.run(["git", "diff", "--binary", "HEAD"], cwd=BASE.parent, check=True,
                              capture_output=True).stdout
        return {"git_head": head, "working_tree_diff_sha256": hashlib.sha256(diff).hexdigest(),
                "working_tree_clean": not bool(diff)}
    except Exception as exc:  # pragma: no cover
        return {"git_head": None, "working_tree_diff_sha256": None, "working_tree_clean": None,
                "error": f"{type(exc).__name__}: {exc}"}


def _approval(required_scope: str) -> tuple[dict, str]:
    approval = read_json(APPROVAL_PATH)
    if (approval.get("schema_version") != 1 or approval.get("formal_run_id") != RUN_ID
            or required_scope not in approval.get("scopes", []) or not approval.get("authority")
            or approval.get("challenger_retuning_authorized") is not False
            or approval.get("automatic_promotion_authorized") is not False):
        raise ValueError(f"Deployment lacks explicit {required_scope!r} authorization")
    authorized = datetime.fromisoformat(approval["authorized_at"].replace("Z", "+00:00"))
    if authorized.tzinfo is None:
        raise ValueError("Deployment approval timestamp must be timezone-aware")
    return approval, digest(APPROVAL_PATH)


def _expected_companies() -> dict:
    """Validate and return exact frozen Run 02 selections/configurations."""
    legacy = read_json(CANONICAL_MANIFEST_PATH)
    if digest(CANONICAL_MANIFEST_PATH) != REVIEWED_MANIFEST_SHA256:
        raise ValueError("Superseded reviewed manifest changed; frozen configuration source is invalid")
    expected_identity = {"formal_run_id": RUN_ID, "approved_code_commit": CODE,
                         "evidence_archive_sha256": ARCHIVE, "source_data_cutoff": "2026-08-28"}
    if any(legacy.get(key) != value for key, value in expected_identity.items()):
        raise ValueError("Frozen Run 02 deployment identity is invalid")
    study_path = BASE.parent / "frontend/public/forecasts/formal" / f"{RUN_ID}.json"
    if digest(study_path) != legacy.get("formal_summary_sha256"):
        raise ValueError("Immutable formal summary hash mismatch")
    study = read_json(study_path)
    if legacy.get("source_data_commit") != study["identity"]["sourceDataCommit"]:
        raise ValueError("Source data commit mismatch")
    companies = legacy.get("companies", {})
    if set(companies) != set(TARGET_COMPANIES):
        raise ValueError("Approved configuration must contain exactly all 15 companies")
    from services.feature_engineering import REGRESSION_FEATURE_COLUMNS, RETURN_LAG_COLUMNS
    for row in study["perCompany"]:
        symbol = row["symbol"]
        item = companies[symbol]
        family = item.get("model")
        config = item.get("configuration", {})
        if family != row["principalWinnerByRmse"]:
            raise ValueError(f"{symbol}: selected family differs from Run 02")
        if family == "lag_reg":
            lags = config.get("pacf_selected_lags", [])
            columns = [c for c in REGRESSION_FEATURE_COLUMNS
                       if c not in RETURN_LAG_COLUMNS or c in {f"return_lag_{n}" for n in lags}]
            expected = dict(alpha=row["configuration"]["lagRegression"]["alpha"], candidate_features=columns,
                            pacf_selected_lags=lags, max_iter=50000, tol=0.001, seed=42,
                            target="next_close_delta", scaler="StandardScaler")
        elif family == "arima":
            formal = row["configuration"]["arima"]
            expected = dict(order=formal["order"], trend=formal["trend"], method="statespace",
                            maxiter=2000, target="Close")
        elif family == "lstm":
            formal = row["configuration"]["lstm"]
            expected = dict(lookback=formal["lookback"], hidden_size=formal["hiddenSize"],
                            learning_rate=formal["learningRate"], batch_size=formal["batchSize"],
                            fixed_epochs=formal["fixedEpochs"], seed=formal["finalFitSeed"],
                            input_design="univariate_close_delta", scaler="MinMaxScaler",
                            optimizer="Adam", loss="MSELoss")
        else:
            raise ValueError(f"{symbol}: unsupported selected model")
        if config != expected:
            raise ValueError(f"{symbol}: incomplete or altered frozen configuration")
    return copy.deepcopy(companies)


def _manifest_path_for_version(version: str) -> Path:
    return CANONICAL_MANIFEST_PATH if version == PROMOTION else VERSIONS_DIR / version / "manifest.json"


def load_manifest(directory: Path | None = None, *, version: str | None = None,
                  required_scope: str | None = None) -> tuple[dict, str]:
    """Resolve a fixed deployment manifest and validate identity and artifacts."""
    if directory is not None:
        if directory.is_file():
            path = directory
        elif (directory / "manifest.json").is_file():
            path = directory / "manifest.json"
        elif (directory / "deployment_manifest.json").is_file():
            path = directory / "deployment_manifest.json"
        elif (directory / "active.json").is_file():
            pointer = read_json(directory / "active.json")
            path = directory / pointer["manifest"]
        else:
            raise FileNotFoundError(f"No deployment manifest in {directory}")
    elif version is not None:
        path = _manifest_path_for_version(version)
    elif ACTIVE_POINTER.is_file():
        pointer = read_json(ACTIVE_POINTER)
        path = DEPLOYMENT_ROOT / pointer["manifest"]
        if pointer.get("manifest_sha256") != digest(path):
            raise ValueError("Active deployment pointer manifest hash mismatch")
        if pointer.get("deployment_version") != path.parent.name:
            raise ValueError("Active deployment pointer version mismatch")
    else:
        path = CANONICAL_MANIFEST_PATH

    sha = digest(path)
    manifest = read_json(path)
    deployment_version = manifest.get("deployment_version") or manifest.get("promotion_id")
    if version is not None and deployment_version != version:
        raise ValueError("Deployment version does not match requested manifest")
    if manifest.get("formal_run_id") != RUN_ID or set(manifest.get("companies", {})) != set(TARGET_COMPANIES):
        raise ValueError("Deployment manifest identity or company universe is invalid")
    if deployment_version == PROMOTION:
        if sha != REVIEWED_MANIFEST_SHA256:
            raise ValueError("Legacy deployment manifest hash mismatch")
        _expected_companies()
    else:
        if manifest.get("schema_version") != 2 or manifest.get("status") != "verified":
            raise ValueError("Versioned deployment is not complete and verified")
        expected = _expected_companies()
        approval = manifest.get("approval", {})
        if digest(APPROVAL_PATH) != approval.get("record_sha256"):
            raise ValueError("Deployment approval record hash mismatch")
        if required_scope and required_scope not in approval.get("scopes", []):
            raise ValueError(f"Deployment lacks explicit {required_scope!r} authorization")
        for symbol, item in manifest["companies"].items():
            if item.get("model") != expected[symbol]["model"] or item.get("configuration") != expected[symbol]["configuration"]:
                raise ValueError(f"{symbol}: versioned deployment differs from approved configuration")
            artifact = item.get("artifact", {})
            if artifact.get("configuration_sha256") != canonical_hash(item["configuration"]):
                raise ValueError(f"{symbol}: configuration hash mismatch")
            artifact_path = path.parent / artifact.get("path", "")
            if not artifact_path.is_file() or digest(artifact_path) != artifact.get("sha256"):
                raise ValueError(f"{symbol}: artifact missing or corrupted")
    log.info("Validated deployment %s (%s)", deployment_version, sha)
    return manifest, sha


def _validate_loaded_artifact(symbol: str, item: dict, artifact: object, df: pd.DataFrame) -> None:
    config = item["configuration"]
    family = item["model"]
    if family == "lag_reg":
        if (float(artifact.alpha) != float(config["alpha"])
                or artifact.candidate_features != config["candidate_features"]
                or artifact.pacf_selected_lags != config["pacf_selected_lags"]
                or int(artifact.scaler.n_features_in_) != len(config["candidate_features"])):
            raise ValueError(f"{symbol}: Lag Regression artifact/configuration mismatch")
    elif family == "arima":
        if list(artifact.model.order) != config["order"] or artifact.model.trend != config["trend"]:
            raise ValueError(f"{symbol}: ARIMA artifact/configuration mismatch")
        close = df["Close"].astype(float).to_numpy()
        endog = np.asarray(artifact.model.endog).reshape(-1)
        if len(endog) > len(close) or not np.allclose(endog, close[:len(endog)], atol=1e-3, rtol=0):
            raise ValueError(f"{symbol}: ARIMA training-data lineage mismatch")
    elif family == "lstm":
        expected = {"input_design": "univariate_delta_close", "input_size": 1,
                    "seq_len": config["lookback"], "hidden_size": config["hidden_size"],
                    "learning_rate": config["learning_rate"], "batch_size": config["batch_size"],
                    "fixed_epochs": config["fixed_epochs"], "training_seed": config["seed"]}
        if any(artifact.get(key) != value for key, value in expected.items()):
            raise ValueError(f"{symbol}: LSTM artifact/configuration mismatch")
    else:
        raise ValueError(f"{symbol}: unsupported model family")


def _artifact_path(manifest: dict, manifest_path: Path, symbol: str) -> Path:
    item = manifest["companies"][symbol]
    if "artifact" in item:
        return manifest_path.parent / item["artifact"]["path"]
    family = item["model"]
    folder = "lag_regression" if family == "lag_reg" else family
    extension = "pth" if family == "lstm" else "pkl"
    return CANONICAL_MANIFEST_PATH.parent / folder / f"{symbol}.{extension}"


def predict_persisted(df: pd.DataFrame, symbol: str, item: dict, base_dir: Path = BASE,
                      *, manifest: dict | None = None, manifest_path: Path | None = None) -> float:
    """Hash-check, load, configuration-check, then predict without fitting."""
    del base_dir
    from services.forecasting import arima_model, lag_regression, lstm_model
    if manifest is None:
        manifest, _ = load_manifest(required_scope="production_inference")
        version = manifest.get("deployment_version") or manifest.get("promotion_id")
        manifest_path = _manifest_path_for_version(version)
    assert manifest_path is not None
    path = _artifact_path(manifest, manifest_path, symbol)
    metadata = item.get("artifact", {})
    if metadata and digest(path) != metadata.get("sha256"):
        raise ValueError(f"{symbol}: artifact hash mismatch before load")
    family = item["model"]
    loader = {"lag_reg": lag_regression.load, "arima": arima_model.load, "lstm": lstm_model.load}[family]
    artifact = loader(path)
    _validate_loaded_artifact(symbol, item, artifact, df)
    if family == "lag_reg":
        value = lag_regression.predict_next(artifact, df)
    elif family == "arima":
        trained_rows = len(np.asarray(artifact.model.endog).reshape(-1))
        new_close = df["Close"].astype(float).iloc[trained_rows:]
        if len(new_close):
            log.info("[infer] %s ARIMA appending %d observation(s), refit=False", symbol, len(new_close))
            artifact = artifact.append(new_close.to_numpy(), refit=False)
        value = arima_model.predict_next(artifact)
    else:
        value = lstm_model.predict_next(artifact, df)
    if not math.isfinite(float(value)) or float(value) <= 0:
        raise ValueError(f"{symbol}: model produced an invalid price")
    return round(float(value), 2)


def refit_predict(df: pd.DataFrame, item: dict, return_artifact: bool = False):
    """Fit one exact selected configuration; never select or tune."""
    from services.forecasting import arima_model, lag_regression, lstm_model
    config = item["configuration"]
    if item["model"] == "lag_reg":
        frozen = lag_regression.LagRegressionDeploymentConfig(
            config["alpha"], tuple(config["candidate_features"]), tuple(config["pacf_selected_lags"]))
        from sklearn.exceptions import ConvergenceWarning
        with warnings.catch_warnings():
            warnings.simplefilter("error", ConvergenceWarning)
            artifact = lag_regression.refit_deployment_lag_regression(df, frozen)
        value = lag_regression.predict_next(artifact, df)
    elif item["model"] == "arima":
        frozen = arima_model.ARIMAConfiguration(tuple(config["order"]), config["trend"])
        artifact = arima_model.refit_deployment_arima(df, frozen)
        value = arima_model.predict_next(artifact)
    else:
        artifact = lstm_model.refit_frozen_lstm(df, config)
        value = lstm_model.predict_next(artifact, df)
    if not math.isfinite(float(value)) or float(value) <= 0:
        raise ValueError("Model produced a non-finite or non-positive price")
    value = round(float(value), 2)
    return (value, artifact) if return_artifact else value


def validate_data(path: Path, *, now: datetime, development: bool):
    df = validate_ohlcv_csv(path)
    if len(df) < 1624 or df["Date"].iloc[0].date().isoformat() != "2020-01-02":
        raise ValueError(f"{path.stem}: incomplete official source history")
    if not np.isfinite(df[["Open", "High", "Low", "Close", "Volume"]].to_numpy(dtype=float)).all():
        raise ValueError(f"{path.stem}: non-finite OHLCV")
    last = df["Date"].iloc[-1].date()
    calendar = get_calendar()
    if last > now.date() or last.isoformat() < "2026-08-28":
        raise ValueError(f"{path.stem}: invalid data cutoff {last}")
    target = calendar.next_trading_day(last)
    if not development:
        expected = now.date()
        if now.time() < time(15, 30) or not calendar.is_trading_day(expected):
            expected -= timedelta(days=1)
            while not calendar.is_trading_day(expected):
                expected -= timedelta(days=1)
        if last != expected or datetime.combine(target, time(9, 30), tzinfo=PHT) <= now:
            raise ValueError(f"{path.stem}: stale data {last}; latest completed official session {expected} required")
    return df, target.isoformat()


def _save_artifact(artifact: object, family: str, path: Path) -> None:
    from services.forecasting import arima_model, lag_regression, lstm_model
    {"lag_reg": lag_regression.save, "arima": arima_model.save, "lstm": lstm_model.save}[family](artifact, path)


def _active_version_or_legacy() -> str:
    return read_json(ACTIVE_POINTER).get("deployment_version", PROMOTION) if ACTIVE_POINTER.is_file() else PROMOTION


def _activate_verified_directory(staging: Path, final_dir: Path, pointer: dict) -> None:
    """Publish a verified immutable directory, then replace only the active pointer."""
    os.replace(staging, final_dir)
    atomic_json(ACTIVE_POINTER, pointer)


def scheduled_refresh(*, raw_dir: Path = BASE / "data/raw", output: Path = OUTPUT,
                      symbols: list[str] | None = None, development: bool = False,
                      now: datetime | None = None, manifest_dir: Path | None = None,
                      strict: bool = False, deployment_version: str | None = None) -> dict:
    """Build and verify a complete immutable deployment, then atomically activate it."""
    del output, manifest_dir
    approval, approval_sha = _approval("scheduled_refresh")
    approved = _expected_companies()
    now = (now or datetime.now(PHT)).astimezone(PHT)
    symbols = sorted(TARGET_COMPANIES) if symbols is None else symbols
    if (strict and set(symbols) != set(TARGET_COMPANIES)) or set(symbols) != set(TARGET_COMPANIES) or len(symbols) != len(set(symbols)):
        raise ValueError("Operational refresh requires exactly all 15 companies")
    inputs = {symbol: validate_data(raw_dir / f"{symbol}.csv", now=now, development=development) for symbol in symbols}
    if len({target for _, target in inputs.values()}) != 1:
        raise ValueError("Company source-data cutoffs differ")
    input_hashes = {symbol: digest(raw_dir / f"{symbol}.csv") for symbol in symbols}
    version = deployment_version or f"RUN02_OPS_{now.astimezone(timezone.utc):%Y%m%d_%H%M%SZ}"
    final_dir = VERSIONS_DIR / version
    if final_dir.exists():
        raise FileExistsError(f"Deployment version already exists: {version}")
    VERSIONS_DIR.mkdir(parents=True, exist_ok=True)

    with deployment_lock():
        staging = Path(tempfile.mkdtemp(prefix=f".staging-{version}-", dir=VERSIONS_DIR))
        try:
            runtime = _runtime()
            code_revision = _code_revision()
            companies, predictions = {}, {}
            for symbol in symbols:
                df, target = inputs[symbol]
                item = approved[symbol]
                family = item["model"]
                folder = "lag_regression" if family == "lag_reg" else family
                extension = "pth" if family == "lstm" else "pkl"
                relative = Path("artifacts") / folder / f"{symbol}.{extension}"
                artifact_path = staging / relative
                log.info("[refresh] fitting %s selected %s on %d rows", symbol, family, len(df))
                value, fitted = refit_predict(df, item, return_artifact=True)
                _save_artifact(fitted, family, artifact_path)
                if not artifact_path.is_file():
                    raise ValueError(f"{symbol}: artifact save did not produce a file")
                artifact_sha = digest(artifact_path)
                provisional = {**copy.deepcopy(item), "artifact": {
                    "path": str(relative), "sha256": artifact_sha,
                    "configuration_sha256": canonical_hash(item["configuration"])}}
                reloaded_value = predict_persisted(df, symbol, provisional,
                                                   manifest={"companies": {symbol: provisional}},
                                                   manifest_path=staging / "manifest.json")
                if not math.isclose(value, reloaded_value, abs_tol=0.01):
                    raise ValueError(f"{symbol}: reloaded artifact prediction changed")
                provisional["artifact"].update({
                    "model_family": family, "training_cutoff": df["Date"].iloc[-1].date().isoformat(),
                    "training_rows": int(len(df)), "source_data_sha256": input_hashes[symbol],
                    "runtime": runtime, "code_revision": code_revision})
                companies[symbol] = provisional
                predictions[symbol] = {"predicted_close": value, "forecast_for": target}
                log.info("[refresh] verified %s artifact sha256=%s", symbol, artifact_sha)

            if any(digest(raw_dir / f"{symbol}.csv") != input_hashes[symbol] for symbol in symbols):
                raise ValueError("Source data changed during refresh; active deployment was not changed")
            legacy = read_json(CANONICAL_MANIFEST_PATH)
            manifest = {
                "schema_version": 2, "deployment_version": version, "status": "verified",
                "formal_run_id": RUN_ID, "formal_summary_sha256": legacy["formal_summary_sha256"],
                "evidence_archive_sha256": ARCHIVE, "approved_code_commit": CODE,
                "approved_configuration_source": f"{PROMOTION}:{REVIEWED_MANIFEST_SHA256}",
                "operation": "fixed_configuration_refit", "created_at": now.isoformat(),
                "approval": {"approval_id": approval["approval_id"], "authorized_at": approval["authorized_at"],
                             "scopes": approval["scopes"], "record_sha256": approval_sha},
                "runtime": runtime, "code_revision": code_revision, "companies": companies,
                "test_predictions": predictions,
            }
            atomic_json(staging / "manifest.json", manifest)
            load_manifest(staging, required_scope="scheduled_refresh")
            manifest_sha = digest(staging / "manifest.json")
            previous = _active_version_or_legacy()
            pointer = {"schema_version": 1, "deployment_version": version,
                       "manifest": str((final_dir / "manifest.json").relative_to(DEPLOYMENT_ROOT)),
                       "manifest_sha256": manifest_sha, "activated_at": now.isoformat(),
                       "previous_deployment_version": previous}
            _activate_verified_directory(staging, final_dir, pointer)
            load_manifest(required_scope="scheduled_refresh")
            log.info("[refresh] atomically activated %s", version)
            return {"deploymentVersion": version, "manifestSha256": manifest_sha,
                    "predictions": predictions, "artifactCount": len(companies)}
        finally:
            if staging.exists():
                shutil.rmtree(staging, ignore_errors=True)


def _historical_manifest(record: dict) -> tuple[dict, str]:
    manifest, sha = load_manifest(version=record.get("deploymentVersion"))
    if sha != record.get("manifestSha256"):
        raise ValueError(f"{record.get('symbol')}: historical manifest hash mismatch")
    return manifest, sha


def _validate_record(record: dict, boundary: dict) -> None:
    manifest, _ = _historical_manifest(record)
    symbol = record.get("symbol")
    item = manifest["companies"].get(symbol, {})
    issued = datetime.fromisoformat(record["issuedAt"])
    target_open = datetime.fromisoformat(record["forecastFor"] + "T09:30:00+08:00")
    if (issued.tzinfo is None or issued >= target_open or record["dataAsOf"] >= record["forecastFor"]
            or record["issuedAt"] < boundary["firstIssuedAt"] or record["forecastFor"] < boundary["firstTargetDate"]
            or record.get("configuration") != item.get("configuration")
            or record.get("model") != LABELS.get(item.get("model"))
            or record.get("coverage") != "post_promotion_prospective"
            or not math.isfinite(record["predictedClose"]) or record["predictedClose"] <= 0):
        raise ValueError("Invalid prospective forecast provenance")
    if record.get("configurationSha256") not in (None, canonical_hash(item["configuration"])):
        raise ValueError("Forecast configuration identity mismatch")
    if record["actual"] is not None:
        if not math.isfinite(record["actual"]) or not math.isclose(record["error"], record["predictedClose"] - record["actual"]):
            raise ValueError("Invalid realized forecast error")
    elif record["error"] is not None:
        raise ValueError("Unrealized forecast must not have an error")


def validate_batch(payload: dict, manifest: dict | None = None, sha: str | None = None) -> None:
    """Validate current issuance against its manifest and every history row against its original."""
    if manifest is None:
        manifest, sha = load_manifest(version=payload.get("deploymentVersion"))
    assert sha is not None
    if (payload.get("schemaVersion") != 1 or payload.get("developmentOnly") is not False
            or payload.get("manifestSha256") != sha
            or payload.get("deploymentVersion") != (manifest.get("deployment_version") or manifest.get("promotion_id"))
            or payload.get("formalRunId") != RUN_ID or payload.get("approvalStatus") != "approved"
            or set(payload.get("forecasts", {})) != set(manifest["companies"])):
        raise ValueError("Invalid complete operational batch")
    boundary = payload["promotionBoundary"]
    seen = set()
    for record in payload.get("history", []):
        key = record.get("symbol"), record.get("forecastFor")
        if key in seen:
            raise ValueError("Duplicate prospective history record")
        seen.add(key)
        _validate_record(record, boundary)
    for symbol, row in payload["forecasts"].items():
        if row.get("symbol") != symbol or row not in payload["history"]:
            raise ValueError("Current forecast is absent from immutable issuance history")
        if row.get("deploymentVersion") != payload["deploymentVersion"] or row.get("manifestSha256") != sha:
            raise ValueError("Current forecast batch crosses deployment versions")


def infer_daily(*, raw_dir: Path = BASE / "data/raw", output: Path = OUTPUT,
                symbols: list[str] | None = None, development: bool = False,
                now: datetime | None = None, manifest_dir: Path | None = None) -> dict:
    """Issue one complete batch from one fixed active deployment; never train."""
    del manifest_dir
    _approval("production_inference")
    now = (now or datetime.now(PHT)).astimezone(PHT)
    symbols = sorted(TARGET_COMPANIES) if symbols is None else symbols
    if development:
        if set(symbols) != {"ALI", "BPI"} or output.resolve() == OUTPUT.resolve():
            raise ValueError("Development smoke must use ALI/BPI and isolated output")
    elif set(symbols) != set(TARGET_COMPANIES) or len(symbols) != len(set(symbols)):
        raise ValueError("Operational generation requires all 15 companies")

    with deployment_lock():
        manifest, sha = load_manifest(required_scope="production_inference")
        version = manifest.get("deployment_version") or manifest.get("promotion_id")
        manifest_path = _manifest_path_for_version(version)
        missing = [symbol for symbol in symbols if not (raw_dir / f"{symbol}.csv").is_file()]
        if missing:
            raise FileNotFoundError("Missing required official data: " + ", ".join(missing))
        inputs = {symbol: validate_data(raw_dir / f"{symbol}.csv", now=now, development=development) for symbol in symbols}
        if len({target for _, target in inputs.values()}) != 1:
            raise ValueError("Company source-data cutoffs differ")
        input_hashes = {symbol: digest(raw_dir / f"{symbol}.csv") for symbol in symbols}
        current = output / "current.json"
        previous = read_json(current) if current.exists() else {}
        if previous and not development:
            validate_batch(previous)
        history = copy.deepcopy(previous.get("history", []))
        target = next(iter(inputs.values()))[1]
        existing = [row for row in history if row["forecastFor"] == target and row["symbol"] in symbols]
        if existing:
            if len(existing) != len(symbols):
                raise ValueError("Existing same-target issuance is incomplete; refusing a mixed deployment batch")
            log.info("[infer] preserving existing %s issuance from %s", target, existing[0]["deploymentVersion"])
            return previous

        forecasts = {}
        for symbol in symbols:
            df, forecast_for = inputs[symbol]
            item = manifest["companies"][symbol]
            actuals = dict(zip(df["Date"].dt.strftime("%Y-%m-%d"), df["Close"].astype(float)))
            for record in history:
                if record["symbol"] == symbol and record["actual"] is None and record["forecastFor"] in actuals:
                    record["actual"] = actuals[record["forecastFor"]]
                    record["error"] = record["predictedClose"] - record["actual"]
            log.info("[infer] predicting %s with fixed deployment %s", symbol, version)
            value = predict_persisted(df, symbol, item, manifest=manifest, manifest_path=manifest_path)
            artifact = item.get("artifact", {})
            record = {"symbol": symbol, "model": LABELS[item["model"]], "predictedClose": value,
                      "previousClose": float(df["Close"].iloc[-1]),
                      "dataAsOf": df["Date"].iloc[-1].date().isoformat(), "forecastFor": forecast_for,
                      "issuedAt": now.isoformat(), "actual": None, "error": None,
                      "deploymentVersion": version, "manifestSha256": sha, "formalRunId": RUN_ID,
                      "sourceDataSha256": input_hashes[symbol], "configuration": item["configuration"],
                      "configurationSha256": canonical_hash(item["configuration"]),
                      "artifactSha256": artifact.get("sha256"), "coverage": "post_promotion_prospective"}
            forecasts[symbol] = record
            if not development:
                history.append(copy.deepcopy(record))

        if any(digest(raw_dir / f"{symbol}.csv") != input_hashes[symbol] for symbol in symbols):
            raise ValueError("Source data changed during inference; no batch was published")
        payload = {"schemaVersion": 1, "deploymentVersion": version, "manifestSha256": sha,
                   "formalRunId": RUN_ID, "approvalStatus": "approved",
                   "promotionDate": manifest.get("created_at", manifest.get("promotion_date"))[:10],
                   "developmentOnly": development, "generatedAt": now.isoformat(),
                   "promotionBoundary": previous.get("promotionBoundary") or {
                       "firstIssuedAt": now.isoformat(), "firstTargetDate": target},
                   "forecasts": forecasts, "history": history,
                   "ohlcv": {} if development else {symbol: [
                       {"date": row.Date.date().isoformat(), "open": float(row.Open), "high": float(row.High),
                        "low": float(row.Low), "close": float(row.Close), "volume": int(row.Volume)}
                       for row in inputs[symbol][0].itertuples()] for symbol in symbols},
                   "runtime": _runtime()}
        if not development:
            validate_batch(payload, manifest, sha)
        atomic_json(current, payload)
        log.info("[infer] published immutable %d-company issuance for %s", len(forecasts), target)
        return payload


def generate(*, raw_dir: Path = BASE / "data/raw", output: Path = OUTPUT,
             symbols: list[str] | None = None, development: bool = False,
             now: datetime | None = None, manifest_dir: Path | None = None,
             mode: str = "infer", strict: bool = False, deployment_version: str | None = None) -> dict:
    if mode == "refresh":
        return scheduled_refresh(raw_dir=raw_dir, output=output, symbols=symbols, development=development,
                                 now=now, manifest_dir=manifest_dir, strict=strict,
                                 deployment_version=deployment_version)
    return infer_daily(raw_dir=raw_dir, output=output, symbols=symbols, development=development,
                       now=now, manifest_dir=manifest_dir)
