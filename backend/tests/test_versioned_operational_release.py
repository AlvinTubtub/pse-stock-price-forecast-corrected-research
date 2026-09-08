"""Regression coverage for versioned operational deployment safety."""
from __future__ import annotations

import copy
import json
import shutil
import sys
from datetime import datetime
from pathlib import Path
from unittest.mock import Mock

import pandas as pd
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from services import operational_deployment as ops
from services.forecasting import lstm_model

NOW = datetime.fromisoformat("2026-09-08T18:00:00+08:00")


def test_active_artifacts_are_complete_and_ict_uses_approved_30_session_lookback():
    manifest, sha = ops.load_manifest(required_scope="production_inference")
    assert sha == ops.read_json(ops.ACTIVE_POINTER)["manifest_sha256"]
    assert len(manifest["companies"]) == 15
    ict = manifest["companies"]["ICT"]
    artifact = lstm_model.load(ops.VERSIONS_DIR / manifest["deployment_version"] / ict["artifact"]["path"])
    assert ict["configuration"]["lookback"] == artifact["seq_len"] == 30
    assert artifact["fixed_epochs"] == 47
    assert artifact["training_seed"] == 42


def test_ict_five_session_artifact_is_rejected_against_approved_configuration():
    manifest, _ = ops.load_manifest()
    item = manifest["companies"]["ICT"]
    bad = {"input_design": "univariate_delta_close", "input_size": 1, "seq_len": 5,
           "hidden_size": 25, "learning_rate": 0.001, "batch_size": 16,
           "fixed_epochs": 47, "training_seed": 42}
    df, _ = ops.validate_data(ops.BASE / "data/raw/ICT.csv", now=NOW, development=True)
    with pytest.raises(ValueError, match="LSTM artifact/configuration mismatch"):
        ops._validate_loaded_artifact("ICT", item, bad, df)


def test_corruption_and_configuration_mismatch_are_rejected(tmp_path):
    manifest, _ = ops.load_manifest()
    source = ops.VERSIONS_DIR / manifest["deployment_version"]
    copied = tmp_path / manifest["deployment_version"]
    shutil.copytree(source, copied)
    artifact = copied / manifest["companies"]["ALI"]["artifact"]["path"]
    artifact.write_bytes(artifact.read_bytes() + b"corrupt")
    with pytest.raises(ValueError, match="artifact missing or corrupted"):
        ops.load_manifest(copied)

    shutil.rmtree(copied)
    shutil.copytree(source, copied)
    altered = json.loads((copied / "manifest.json").read_text())
    altered["companies"]["ICT"]["configuration"]["lookback"] = 5
    ops.atomic_json(copied / "manifest.json", altered)
    with pytest.raises(ValueError, match="differs from approved configuration"):
        ops.load_manifest(copied)


def test_daily_inference_never_calls_training_and_preserves_same_target(monkeypatch):
    before = (ops.OUTPUT / "current.json").read_bytes()
    monkeypatch.setattr(ops, "refit_predict", Mock(side_effect=AssertionError("training called")))
    from services.forecasting import arima_model, lag_regression
    monkeypatch.setattr(arima_model, "refit_deployment_arima", Mock(side_effect=AssertionError("training called")))
    monkeypatch.setattr(lag_regression, "refit_deployment_lag_regression", Mock(side_effect=AssertionError("training called")))
    monkeypatch.setattr(lstm_model, "refit_frozen_lstm", Mock(side_effect=AssertionError("training called")))
    payload = ops.infer_daily(now=NOW)
    assert payload["deploymentVersion"] == ops.PROMOTION
    assert (ops.OUTPUT / "current.json").read_bytes() == before


def test_history_from_superseded_deployment_validates_against_original_manifest():
    payload = ops.read_json(ops.OUTPUT / "current.json")
    assert payload["deploymentVersion"] == ops.PROMOTION
    assert ops.load_manifest()[0]["deployment_version"] != ops.PROMOTION
    ops.validate_batch(payload)


def test_approval_scopes_are_enforced(tmp_path, monkeypatch):
    approval = ops.read_json(ops.APPROVAL_PATH)
    approval["scopes"] = ["production_inference"]
    path = tmp_path / "approval.json"
    ops.atomic_json(path, approval)
    monkeypatch.setattr(ops, "APPROVAL_PATH", path)
    ops._approval("production_inference")
    with pytest.raises(ValueError, match="scheduled_refresh"):
        ops._approval("scheduled_refresh")


def test_activation_failure_keeps_previous_pointer(tmp_path, monkeypatch):
    root = tmp_path / "deployment"
    root.mkdir()
    pointer = root / "active.json"
    pointer.write_text('{"deployment_version":"old"}\n')
    staging = root / ".staging"
    staging.mkdir()
    (staging / "manifest.json").write_text("{}")
    final = root / "versions/new"
    final.parent.mkdir()
    monkeypatch.setattr(ops, "ACTIVE_POINTER", pointer)
    original_atomic = ops.atomic_json
    monkeypatch.setattr(ops, "atomic_json", Mock(side_effect=RuntimeError("activation failed")))
    with pytest.raises(RuntimeError, match="activation failed"):
        ops._activate_verified_directory(staging, final, {"deployment_version": "new"})
    assert json.loads(pointer.read_text())["deployment_version"] == "old"
    assert final.is_dir()
    monkeypatch.setattr(ops, "atomic_json", original_atomic)


def _mock_refresh_until_persistence(tmp_path, monkeypatch):
    root = tmp_path / "deployment"
    versions = root / "versions"
    versions.mkdir(parents=True)
    active = root / "active.json"
    active.write_text('{"deployment_version":"old"}\n')
    raw = tmp_path / "raw"
    raw.mkdir()
    symbols = sorted(ops.TARGET_COMPANIES)
    for symbol in symbols:
        (raw / f"{symbol}.csv").write_text(symbol)
    item = {"model": "lag_reg", "configuration": {"alpha": 0.1}}
    frame = pd.DataFrame({"Date": pd.to_datetime(["2026-09-08"]), "Open": [1.0],
                          "High": [1.0], "Low": [1.0], "Close": [1.0], "Volume": [1]})
    monkeypatch.setattr(ops, "DEPLOYMENT_ROOT", root)
    monkeypatch.setattr(ops, "VERSIONS_DIR", versions)
    monkeypatch.setattr(ops, "ACTIVE_POINTER", active)
    monkeypatch.setattr(ops, "LOCK_PATH", root / ".deployment.lock")
    monkeypatch.setattr(ops, "_approval", lambda _scope: ({"approval_id": "a", "authorized_at": "2026-09-08T00:00:00Z", "scopes": ["scheduled_refresh"]}, "f" * 64))
    monkeypatch.setattr(ops, "_expected_companies", lambda: {symbol: copy.deepcopy(item) for symbol in symbols})
    monkeypatch.setattr(ops, "validate_data", lambda _path, **_kwargs: (frame.copy(), "2026-09-09"))
    monkeypatch.setattr(ops, "refit_predict", lambda _df, _item, return_artifact=False: (1.0, object()))
    monkeypatch.setattr(ops, "_runtime", lambda: {"python": "test"})
    monkeypatch.setattr(ops, "_code_revision", lambda: {"git_head": "test"})
    return raw, active


def test_artifact_save_failure_leaves_active_pointer_unchanged(tmp_path, monkeypatch):
    raw, active = _mock_refresh_until_persistence(tmp_path, monkeypatch)
    before = active.read_bytes()
    monkeypatch.setattr(ops, "_save_artifact", Mock(side_effect=RuntimeError("save failed")))
    with pytest.raises(RuntimeError, match="save failed"):
        ops.scheduled_refresh(raw_dir=raw, now=NOW, strict=True, deployment_version="SAVE_FAIL")
    assert active.read_bytes() == before
    assert not (ops.VERSIONS_DIR / "SAVE_FAIL").exists()


def test_staged_artifact_validation_failure_leaves_active_pointer_unchanged(tmp_path, monkeypatch):
    raw, active = _mock_refresh_until_persistence(tmp_path, monkeypatch)
    before = active.read_bytes()
    monkeypatch.setattr(ops, "_save_artifact", lambda _artifact, _family, path: (path.parent.mkdir(parents=True), path.write_bytes(b"artifact")))
    monkeypatch.setattr(ops, "predict_persisted", Mock(side_effect=ValueError("validation failed")))
    with pytest.raises(ValueError, match="validation failed"):
        ops.scheduled_refresh(raw_dir=raw, now=NOW, strict=True, deployment_version="VALIDATE_FAIL")
    assert active.read_bytes() == before
    assert not (ops.VERSIONS_DIR / "VALIDATE_FAIL").exists()


def test_displayed_model_and_dm_holm_evidence_match_approved_run02():
    manifest, _ = ops.load_manifest()
    formal = ops.read_json(ops.BASE.parent / "frontend/public/forecasts/formal" / f"{ops.RUN_ID}.json")
    formal_rows = {row["symbol"]: row for row in formal["perCompany"]}
    stats = ops.read_json(ops.BASE / "statistical_tests.json")
    for symbol, item in manifest["companies"].items():
        detail = ops.read_json(ops.BASE.parent / "frontend/public/forecasts/company" / f"{symbol}.json")
        assert item["model"] == formal_rows[symbol]["principalWinnerByRmse"]
        assert detail["model"] == ops.LABELS[item["model"]]
        expected = next(row for row in stats["per_company"][symbol]["dm_squared_error"]["stage1_vs_naive"]
                        if row["model_a"] == item["model"])
        assert detail["naiveComparison"]["model_a"] == item["model"]
        assert detail["naiveComparison"]["holm_adjusted_p_value"] == expected["holm_adjusted_p_value"]
