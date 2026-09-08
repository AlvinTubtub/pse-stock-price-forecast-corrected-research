"""Behavioral tests verifying operational inference vs refresh separation and controls."""
import copy
import json
import shutil
import sys
from datetime import datetime
from pathlib import Path
from unittest.mock import Mock, patch

import numpy as np
import pandas as pd
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from services import operational_deployment as ops
from services import model_selector
from services.forecasting import arima_model, lag_regression, lstm_model

NOW = datetime.fromisoformat("2026-09-08T18:00:00+08:00")


def test_canonical_manifest_has_all_45_models_and_valid_hashes():
    """Verify canonical manifest defines all 45 models across 15 symbols with sha256."""
    manifest, sha = ops.load_manifest()
    assert manifest["schema_version"] == 1
    assert manifest["promotion_id"] == "RUN02_OPS_20260907_01"
    assert len(manifest["companies"]) == 15
    assert len(manifest["approved_configurations"]) == 15
    assert len(manifest["artifacts"]) == 15
    assert len(manifest["artifact_hashes"]) == 15

    for symbol in manifest["companies"]:
        # Each company must have lag_reg, arima, lstm
        configs = manifest["approved_configurations"][symbol]
        assert set(configs.keys()) == {"lag_reg", "arima", "lstm"}
        artifacts = manifest["artifacts"][symbol]
        assert set(artifacts.keys()) == {"lag_regression", "arima", "lstm"}
        hashes = manifest["artifact_hashes"][symbol]
        assert set(hashes.keys()) == {"lag_regression", "arima", "lstm"}
        for h in hashes.values():
            assert len(h) == 64  # valid sha256 hex string


def test_daily_inference_never_refits_or_tunes(monkeypatch, tmp_path):
    """Daily inference must strictly use persisted models and never call refit_predict."""
    refit_mock = Mock(side_effect=AssertionError("refit_predict must never be called during infer_daily"))
    monkeypatch.setattr(ops, "refit_predict", refit_mock)

    # Mock predict_persisted to return deterministic mock value
    predict_mock = Mock(return_value=25.0)
    monkeypatch.setattr(ops, "predict_persisted", predict_mock)

    batch = ops.infer_daily(output=tmp_path, now=NOW)
    assert len(batch["forecasts"]) == 15
    assert predict_mock.call_count == 15
    refit_mock.assert_not_called()


def test_arima_predict_persisted_calls_append_with_refit_false(monkeypatch):
    """Test ARIMA branch in predict_persisted calls model.append(..., refit=False)."""
    mock_model = Mock()
    mock_model.model.endog = np.array([10.0, 11.0, 12.0])
    appended_model = Mock()
    mock_model.append.return_value = appended_model

    monkeypatch.setattr(arima_model, "load", Mock(return_value=mock_model))
    monkeypatch.setattr(arima_model, "predict_next", Mock(return_value=13.5))

    df = pd.DataFrame({
        "Date": pd.date_range("2026-09-01", periods=4, freq="D"),
        "Close": [10.0, 11.0, 12.0, 12.5],
    })
    item = {
        "model": "arima",
        "configuration": {"order": [1, 1, 0], "trend": "n"},
    }

    pred = ops.predict_persisted(df, "BPI", item)
    assert pred == 13.5
    mock_model.append.assert_called_once()
    _, kwargs = mock_model.append.call_args
    assert kwargs.get("refit") is False


def test_scheduled_refresh_refits_all_15_and_updates_manifest(monkeypatch, tmp_path):
    """Scheduled refresh refits all 15 models, stages them, and updates manifest."""
    refit_mock = Mock(return_value=(22.0, Mock()))
    monkeypatch.setattr(ops, "refit_predict", refit_mock)

    def mock_save(art, path):
        Path(path).write_bytes(b"dummy_weights")

    monkeypatch.setattr(lag_regression, "save", mock_save)
    monkeypatch.setattr(arima_model, "save", mock_save)
    monkeypatch.setattr(lstm_model, "save", mock_save)

    out_dir = tmp_path / "operational"
    target_manifest = tmp_path / "deployment_manifest.json"
    canonical, _ = ops.load_manifest()
    ops.atomic_json(target_manifest, canonical)
    monkeypatch.setattr(ops, "CANONICAL_MANIFEST_PATH", target_manifest)

    batch = ops.scheduled_refresh(output=out_dir, now=NOW)
    assert len(batch["forecasts"]) == 15
    assert refit_mock.call_count == 15

    updated = ops.read_json(target_manifest)
    assert updated["operation"] == "refresh"
    assert "last_refit_at" in updated


def test_scheduled_refresh_rolls_back_on_failure(monkeypatch, tmp_path):
    """If any model fails during refresh, staging is cleaned up and current manifest unchanged."""
    target_manifest = tmp_path / "deployment_manifest.json"
    canonical, _ = ops.load_manifest()
    ops.atomic_json(target_manifest, canonical)
    monkeypatch.setattr(ops, "CANONICAL_MANIFEST_PATH", target_manifest)

    def mock_save(art, path):
        Path(path).write_bytes(b"dummy_weights")

    monkeypatch.setattr(lag_regression, "save", mock_save)
    monkeypatch.setattr(arima_model, "save", mock_save)
    monkeypatch.setattr(lstm_model, "save", mock_save)

    # Fail on 3rd model
    refit_mock = Mock(side_effect=[(20.0, Mock()), (21.0, Mock()), RuntimeError("Convergence failure")])
    monkeypatch.setattr(ops, "refit_predict", refit_mock)

    out_dir = tmp_path / "operational"
    with pytest.raises(RuntimeError, match="Convergence failure"):
        ops.scheduled_refresh(output=out_dir, now=NOW)

    # Manifest remains with original operation and unchanged last_refit_at
    manifest = ops.read_json(target_manifest)
    assert manifest.get("operation") == "approval"
    assert manifest.get("last_refit_at") == canonical.get("last_refit_at")


def test_scheduled_refresh_runs_even_if_same_target_exists(monkeypatch, tmp_path):
    """Scheduled refresh does not skip refitting even if current.json has a forecast for target date."""
    refit_mock = Mock(return_value=(22.0, Mock()))
    monkeypatch.setattr(ops, "refit_predict", refit_mock)

    def mock_save(art, path):
        Path(path).write_bytes(b"dummy_weights")

    monkeypatch.setattr(lag_regression, "save", mock_save)
    monkeypatch.setattr(arima_model, "save", mock_save)
    monkeypatch.setattr(lstm_model, "save", mock_save)

    out_dir = tmp_path / "operational"
    target_manifest = tmp_path / "deployment_manifest.json"
    canonical, _ = ops.load_manifest()
    ops.atomic_json(target_manifest, canonical)
    monkeypatch.setattr(ops, "CANONICAL_MANIFEST_PATH", target_manifest)

    # First run
    ops.scheduled_refresh(output=out_dir, now=NOW)
    assert refit_mock.call_count == 15

    # Second run with same date: MUST refit again
    ops.scheduled_refresh(output=out_dir, now=NOW)
    assert refit_mock.call_count == 30
