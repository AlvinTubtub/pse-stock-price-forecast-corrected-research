"""Fast isolation tests for scheduled deployment refresh (no model fitting)."""
from __future__ import annotations

import json
import sys
from pathlib import Path
from unittest.mock import Mock

import pandas as pd
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from services import model_selector
from services.artifact_runs import DeploymentConfigurationError, write_deployment_manifest


APPROVED = {
    "lag_reg": {
        "alpha": 0.1,
        "candidate_features": ["rsi_14"],
        "pacf_selected_lags": [1],
    },
    "arima": {"order": [1, 1, 0], "trend": "n"},
    "lstm": {
        "lookback": 30,
        "hidden_size": 50,
        "learning_rate": 0.001,
        "batch_size": 16,
    },
}


def _configure_paths(monkeypatch, root: Path) -> None:
    current = root / "models" / "deployment" / "current"
    monkeypatch.setattr(model_selector, "BASE_DIR", root)
    monkeypatch.setattr(model_selector, "DEPLOYMENT_CURRENT_DIR", current)
    monkeypatch.setattr(model_selector, "LAG_MODELS_DIR", current / "lag_regression")
    monkeypatch.setattr(model_selector, "ARIMA_MODELS_DIR", current / "arima")
    monkeypatch.setattr(model_selector, "LSTM_MODELS_DIR", current / "lstm")
    monkeypatch.setattr(model_selector, "PREDICTION_CACHE_DIR", root / "prediction_cache")
    monkeypatch.setattr(model_selector, "BEST_MODELS_PATH", root / "best_models.json")


def _cache() -> dict:
    return {
        "metrics": {"lag_reg": {"rmse": 1.0}, "arima": {"rmse": 2.0}, "lstm": {"rmse": 3.0}},
        "deployment_backtest": {"schema_version": 1, "target_dates": ["2026-01-02"]},
        "next_close": {"lag": 1.0, "arima": 1.0, "lstm": 1.0},
    }


def test_scheduled_refresh_never_invokes_formal_code_or_modifies_formal_runs(tmp_path, monkeypatch):
    _configure_paths(monkeypatch, tmp_path)
    raw_dir = tmp_path / "data" / "raw"
    raw_dir.mkdir(parents=True)
    (raw_dir / "BPI.csv").write_text("Date,Close\n2026-01-01,100\n")
    model_selector.PREDICTION_CACHE_DIR.mkdir(parents=True)
    (model_selector.PREDICTION_CACHE_DIR / "BPI.json").write_text(json.dumps(_cache()))
    model_selector.BEST_MODELS_PATH.write_text(json.dumps({"BPI": "ARIMA"}))
    write_deployment_manifest(
        tmp_path,
        {"BPI": {}},
        approved_configurations={"BPI": APPROVED},
    )
    formal_file = tmp_path / "results" / "formal" / "FINAL" / "finalized.json"
    formal_file.parent.mkdir(parents=True)
    formal_file.write_bytes(b"immutable-formal-evidence")
    before = formal_file.read_bytes()

    formal_evaluation = Mock(side_effect=AssertionError("formal evaluation called"))
    formal_statistics = Mock(side_effect=AssertionError("formal statistics called"))
    formal_writer = Mock(side_effect=AssertionError("formal writer constructed"))
    monkeypatch.setattr(model_selector, "evaluate_formal_symbol", formal_evaluation)
    monkeypatch.setattr(model_selector, "run_formal_evaluation", Mock(side_effect=AssertionError("formal run called")))
    monkeypatch.setattr(model_selector, "run_formal_statistical_tests", formal_statistics)
    monkeypatch.setattr(model_selector, "FormalRunWriter", formal_writer)
    monkeypatch.setattr(model_selector, "validate_ohlcv_csv", lambda _path: pd.DataFrame({"Date": ["2026-01-01"], "Close": [100.0]}))
    monkeypatch.setattr(model_selector, "refresh_deployment_symbol", lambda _symbol, _df, _approved, cache: cache)

    from services import operational_deployment
    approved_runner = Mock(return_value={"forecasts": {"BPI": {"model": "ARIMA"}}})
    monkeypatch.setattr(operational_deployment, "generate", approved_runner)
    result = model_selector.refresh_deployment_all(raw_dir=raw_dir)
    approved_runner.assert_called_once_with(raw_dir=raw_dir)

    assert result == {"BPI": "ARIMA"}
    formal_evaluation.assert_not_called()
    formal_statistics.assert_not_called()
    formal_writer.assert_not_called()
    assert formal_file.read_bytes() == before


def test_refresh_refits_only_explicit_approved_configurations(monkeypatch, tmp_path):
    _configure_paths(monkeypatch, tmp_path)
    for directory in (model_selector.LAG_MODELS_DIR, model_selector.ARIMA_MODELS_DIR, model_selector.LSTM_MODELS_DIR):
        directory.mkdir(parents=True)
    df = pd.DataFrame({"Close": [100.0, 101.0]})
    cache = _cache()
    lag_artifact, arima_artifact, lstm_artifact = object(), object(), object()
    lag_refit = Mock(return_value=lag_artifact)
    arima_refit = Mock(return_value=arima_artifact)
    lstm_refit = Mock(return_value=lstm_artifact)
    monkeypatch.setattr(model_selector.lag_regression, "refit_deployment_lag_regression", lag_refit)
    monkeypatch.setattr(model_selector.arima_model, "refit_deployment_arima", arima_refit)
    monkeypatch.setattr(model_selector.lstm_model, "train_deployment_lstm", lstm_refit)
    monkeypatch.setattr(model_selector.lag_regression, "save", Mock())
    monkeypatch.setattr(model_selector.arima_model, "save", Mock())
    monkeypatch.setattr(model_selector.lstm_model, "save", Mock())
    monkeypatch.setattr(model_selector.lag_regression, "predict_next", Mock(return_value=102.0))
    monkeypatch.setattr(model_selector.arima_model, "predict_next", Mock(return_value=103.0))
    monkeypatch.setattr(model_selector.lstm_model, "predict_next", Mock(return_value=104.0))

    refreshed = model_selector.refresh_deployment_symbol("BPI", df, APPROVED, cache)

    lag_refit.assert_called_once()
    arima_refit.assert_called_once()
    lstm_refit.assert_called_once()
    assert refreshed["metrics"] == cache["metrics"]
    assert refreshed["deployment_backtest"] == cache["deployment_backtest"]
    assert refreshed["next_close"] == {"lag": 102.0, "arima": 103.0, "lstm": 104.0}


def test_refresh_fails_without_approved_configuration_metadata(tmp_path):
    write_deployment_manifest(tmp_path, {"BPI": {}})
    with pytest.raises(DeploymentConfigurationError, match="approved_configurations"):
        model_selector.load_approved_deployment_configurations(tmp_path, ["BPI"])


def test_challenger_retuning_preserves_five_value_lstm_diagnostics_and_does_not_modify_current_or_formal(tmp_path, monkeypatch):
    _configure_paths(monkeypatch, tmp_path)
    raw_dir = tmp_path / "data" / "raw"
    raw_dir.mkdir(parents=True)
    (raw_dir / "BPI.csv").write_text("Date,Close\n2026-01-01,100\n")

    current_manifest = tmp_path / "models" / "deployment" / "current" / "deployment_manifest.json"
    current_manifest.parent.mkdir(parents=True, exist_ok=True)
    current_manifest.write_text(json.dumps({"original": "current"}))

    formal_dir = tmp_path / "results" / "formal" / "FORMAL_01"
    formal_dir.mkdir(parents=True, exist_ok=True)
    formal_file = formal_dir / "evidence.txt"
    formal_file.write_text("formal-untouched")

    monkeypatch.setattr(model_selector, "validate_ohlcv_csv", lambda _p: pd.DataFrame({"Date": ["2026-01-01"], "Close": [100.0]}))
    monkeypatch.setattr(model_selector.lag_regression, "train_deployment_lag_regression", lambda _df: {"mock": "lag"})
    lag_cfg = model_selector.lag_regression.LagRegressionDeploymentConfig(alpha=0.1, candidate_features=("f1",), pacf_selected_lags=(1,))
    monkeypatch.setattr(model_selector.lag_regression, "deployment_config_from_artifact", lambda _a: lag_cfg)
    monkeypatch.setattr(model_selector.lag_regression, "save", Mock())
    arima_cfg = model_selector.arima_model.ARIMAConfiguration(order=(1, 1, 0), trend="c")
    monkeypatch.setattr(model_selector.arima_model, "retune_deployment_arima", lambda _df: ({"mock": "arima"}, arima_cfg))
    monkeypatch.setattr(model_selector.arima_model, "save", Mock())

    lstm_cfg = model_selector.lstm_model.LSTMConfig(lookback=5, hidden_size=25, learning_rate=0.01, batch_size=16)
    lstm_diag = {
        "mean_validation_rmse": 0.5,
        "validation_rmse_std": 0.05,
        "folds": [{"mean_rmse": 0.5}],
        "configuration_results": [{"config": lstm_cfg.__dict__, "mean_rmse": 0.5}],
        "target_start": "2026-01-01",
        "target_end": "2026-01-10",
    }
    monkeypatch.setattr(model_selector.lstm_model, "retune_deployment_lstm", lambda _df, _sym: ({"mock": "lstm"}, lstm_cfg, lstm_diag))
    monkeypatch.setattr(model_selector.lstm_model, "save", Mock())

    manifest_path = model_selector.retune_deployment_challengers(raw_dir=raw_dir, symbols=["BPI"], run_id="CHALLENGER_TEST")

    assert manifest_path.exists()
    challenger_manifest = json.loads(manifest_path.read_text())
    assert challenger_manifest["operation"] == "retune"
    assert challenger_manifest["status"] == "challenger_only"
    assert challenger_manifest["automatic_promotion"] is False
    bpi_diag = challenger_manifest["configurations"]["BPI"]["lstm_tuning_diagnostics"]
    assert bpi_diag["configuration_results"] == [{"config": lstm_cfg.__dict__, "mean_rmse": 0.5}]
    assert bpi_diag["mean_validation_rmse"] == 0.5

    assert json.loads(current_manifest.read_text()) == {"original": "current"}
    assert formal_file.read_text() == "formal-untouched"


def test_strict_refresh_requires_all_canonical_15_tickers_and_writes_refresh_operation(tmp_path, monkeypatch):
    _configure_paths(monkeypatch, tmp_path)
    raw_dir = tmp_path / "data" / "raw"
    raw_dir.mkdir(parents=True)
    tickers_14 = [t for t in model_selector.EXPECTED_TICKERS if t != "SCC"]
    for t in tickers_14:
        (raw_dir / f"{t}.csv").write_text("Date,Close\n2026-01-01,100\n")

    with pytest.raises(RuntimeError, match="Strict deployment refresh universe check failed.*missing expected ticker"):
        model_selector._legacy_refresh_deployment_all(raw_dir=raw_dir, strict=True)
