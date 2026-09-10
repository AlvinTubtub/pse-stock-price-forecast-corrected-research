"""Behavioral tests verifying operational inference vs refresh separation and controls."""
import copy
import json
import shutil
import sys
from datetime import datetime, time
from pathlib import Path
from unittest.mock import Mock, patch

import numpy as np
import pandas as pd
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from services import operational_deployment as ops
from services import model_selector
from services.forecasting import arima_model, lag_regression, lstm_model

LATEST_DATA_DATE = pd.read_csv(
    ops.BASE / "data/raw/ALI.csv", usecols=["Date"], parse_dates=["Date"]
)["Date"].max().date()
NOW = datetime.combine(LATEST_DATA_DATE, time(18), tzinfo=ops.PHT)


def test_active_manifest_has_15_selected_models_and_valid_hashes():
    """The active version persists exactly one selected artifact per symbol."""
    manifest, sha = ops.load_manifest()
    assert manifest["schema_version"] == 2
    assert manifest["status"] == "verified"
    assert sha == ops.read_json(ops.ACTIVE_POINTER)["manifest_sha256"]
    assert len(manifest["companies"]) == 15
    for item in manifest["companies"].values():
        assert item["artifact"]["model_family"] == item["model"]
        assert len(item["artifact"]["sha256"]) == 64
        assert len(item["artifact"]["configuration_sha256"]) == 64


def test_three_model_comparison_has_separate_no_fit_no_promotion_approval():
    approval, approval_sha = ops._comparison_approval()
    assert len(approval_sha) == 64
    assert approval["scope"] == "production_comparison_inference"
    assert approval["model_families"] == ["lag_reg", "arima", "lstm"]
    assert approval["source_manifest_sha256"] == ops.COMPARISON_MANIFEST_SHA256
    assert approval["fitting_authorized"] is False
    assert approval["model_selection_authorized"] is False
    assert approval["automatic_promotion_authorized"] is False


def test_comparison_manifest_pins_all_45_persisted_artifacts():
    manifest = ops.read_json(ops.COMPARISON_MANIFEST_PATH)
    assert ops.digest(ops.COMPARISON_MANIFEST_PATH) == ops.COMPARISON_MANIFEST_SHA256
    assert set(manifest["companies"]) == set(ops.TARGET_COMPANIES)
    artifact_count = 0
    for symbol in sorted(ops.TARGET_COMPANIES):
        items = ops._comparison_items(symbol)
        assert set(items) == set(ops.COMPARISON_FAMILIES)
        for item in items.values():
            artifact = item["artifact"]
            assert ops.digest(ops.BASE / artifact["path"]) == artifact["sha256"]
            artifact_count += 1
    assert artifact_count == 45


def test_daily_inference_never_refits_or_tunes(monkeypatch, tmp_path):
    """Daily inference must strictly use persisted models and never call refit_predict."""
    refit_mock = Mock(side_effect=AssertionError("refit_predict must never be called during infer_daily"))
    monkeypatch.setattr(ops, "refit_predict", refit_mock)

    # Mock predict_persisted to return deterministic mock value
    predict_mock = Mock(return_value=25.0)
    comparison_mock = Mock(return_value=25.0)
    monkeypatch.setattr(ops, "predict_persisted", predict_mock)
    monkeypatch.setattr(ops, "predict_comparison_persisted", comparison_mock)

    batch = ops.infer_daily(output=tmp_path, now=NOW)
    assert len(batch["forecasts"]) == 15
    assert predict_mock.call_count == 15
    assert comparison_mock.call_count == 30
    assert all(set(row["comparisonForecasts"]) == set(ops.LABELS.values())
               for row in batch["forecasts"].values())
    refit_mock.assert_not_called()


def test_arima_predict_persisted_calls_append_with_refit_false(monkeypatch):
    """Test ARIMA branch in predict_persisted calls model.append(..., refit=False)."""
    mock_model = Mock()
    mock_model.model.endog = np.array([10.0, 11.0, 12.0])
    mock_model.model.order = (1, 1, 0)
    mock_model.model.trend = "n"
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

    pred = ops.predict_persisted(df, "BPI", item, manifest={"companies": {"BPI": item}},
                                 manifest_path=ops.CANONICAL_MANIFEST_PATH)
    assert pred == 13.5
    mock_model.append.assert_called_once()
    _, kwargs = mock_model.append.call_args
    assert kwargs.get("refit") is False


def test_scheduled_refresh_result_is_immutable_version_not_forecast_history():
    manifest, sha = ops.load_manifest(required_scope="scheduled_refresh")
    assert manifest["operation"] == "fixed_configuration_refit"
    assert len(manifest["companies"]) == 15
    assert len(manifest["test_predictions"]) == 15
    assert sha == ops.read_json(ops.ACTIVE_POINTER)["manifest_sha256"]


def test_superseded_manifest_is_preserved_for_audit():
    legacy, sha = ops.load_manifest(version=ops.PROMOTION)
    assert legacy["operation"] == "approval"
    assert legacy["approval"]["scope"] == "manual_local_operational_generation"
    assert sha == ops.REVIEWED_MANIFEST_SHA256


def test_refresh_does_not_replace_existing_same_target_issuance():
    current = ops.read_json(ops.OUTPUT / "current.json")
    active, _ = ops.load_manifest()
    assert current["deploymentVersion"] == active["deployment_version"]
    legacy = [row for row in current["history"] if row["deploymentVersion"] == ops.PROMOTION]
    assert len(legacy) == 30
    assert len({(row["symbol"], row["forecastFor"]) for row in legacy}) == 30
    assert all(row in current["history"] for row in current["forecasts"].values())
