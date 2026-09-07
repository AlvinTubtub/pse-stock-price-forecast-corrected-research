"""Controlled promotion, no tuning, atomic publication and honest history contracts."""
import copy
import json
import sys
from datetime import datetime
from pathlib import Path
from unittest.mock import Mock

import pandas as pd
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from services import operational_deployment as ops

NOW = datetime.fromisoformat("2026-09-07T18:00:00+08:00")


def test_manifest_covers_exact_frozen_mapping():
    manifest, sha = ops.load_manifest()
    assert sha == ops.REVIEWED_MANIFEST_SHA256
    assert {s: row["model"] for s, row in manifest["companies"].items()} == {
        "ALI": "lag_reg", "APX": "lag_reg", "BPI": "arima", "GLO": "arima", "ICT": "lstm",
        "JFC": "lag_reg", "MBT": "arima", "MEG": "lag_reg", "MER": "lag_reg", "NIKL": "lag_reg",
        "PGOLD": "arima", "SCC": "arima", "SECB": "arima", "SHLPH": "arima", "SMPH": "lag_reg"}


@pytest.mark.parametrize("mutation", ["approval", "company", "model", "epochs", "features", "archive", "cutoff"])
def test_altered_manifest_fails_even_with_updated_pointer(tmp_path, mutation):
    manifest, _ = ops.load_manifest()
    if mutation == "approval": manifest["approval"]["status"] = "pending"
    if mutation == "company": del manifest["companies"]["BPI"]
    if mutation == "model": manifest["companies"]["ALI"]["model"] = "arima"
    if mutation == "epochs": manifest["companies"]["ICT"]["configuration"]["fixed_epochs"] = 48
    if mutation == "features": manifest["companies"]["ALI"]["configuration"]["candidate_features"] = []
    if mutation == "archive": manifest["evidence_archive_sha256"] = "0" * 64
    if mutation == "cutoff": manifest["source_data_cutoff"] = "2026-09-07"
    path = tmp_path / f"{ops.PROMOTION}.json"
    ops.atomic_json(path, manifest)
    ops.atomic_json(tmp_path / "active.json", {"manifest": path.name, "sha256": ops.digest(path)})
    with pytest.raises(ValueError): ops.load_manifest(tmp_path)


def test_missing_manifest_and_duplicate_keys_fail(tmp_path):
    with pytest.raises(FileNotFoundError): ops.load_manifest(tmp_path)
    (tmp_path / "active.json").write_text('{"manifest":"a", "manifest":"b"}')
    with pytest.raises(ValueError, match="Duplicate"): ops.load_manifest(tmp_path)


@pytest.mark.parametrize("kwargs", [{"symbols": ["ALI"]}, {"symbols": ["ALI", "ALI"]},
    {"symbols": ["ALI", "BPI"], "development": True, "output": ops.OUTPUT}])
def test_incomplete_or_unsafe_generation_rejected(kwargs):
    with pytest.raises(ValueError): ops.generate(now=NOW, **kwargs)


def test_stale_data_cannot_be_issued_live():
    with pytest.raises(ValueError, match="stale"):
        ops.validate_data(ops.BASE / "data/raw/ALI.csv", now=datetime.fromisoformat("2026-09-09T18:00:00+08:00"), development=False)


@pytest.fixture
def fast_generation(monkeypatch, tmp_path):
    """Real source validation with a mocked fitter; all writes isolated to pytest tmp."""
    fit = Mock(return_value=20.0)
    monkeypatch.setattr(ops, "refit_predict", fit)
    return tmp_path, fit


def test_full_batch_idempotence_and_no_legacy_writes(fast_generation):
    output, fit = fast_generation
    protected = [p for directory in [ops.BASE / "production_history", ops.BASE / "prediction_cache",
                 ops.BASE.parent / "frontend/public/forecasts/formal"] for p in directory.glob("*.json")]
    before = {p: ops.digest(p) for p in protected}
    first = ops.generate(output=output, now=NOW)
    assert len(first["history"]) == 15
    assert all(r["actual"] is None for r in first["history"])
    second = ops.generate(output=output, now=NOW)
    assert second["history"] == first["history"]
    assert fit.call_count == 15  # repeat issuance does not refit or overwrite
    assert before == {p: ops.digest(p) for p in protected}


def test_failure_does_not_publish_partial_batch(fast_generation):
    output, fit = fast_generation
    fit.side_effect = [20.0, RuntimeError("ARIMA did not converge")]
    with pytest.raises(RuntimeError): ops.generate(output=output, now=NOW)
    assert not (output / "current.json").exists()
    assert not (output / ".generation.lock").exists()


def test_smoke_is_not_live_history(fast_generation):
    output, fit = fast_generation
    batch = ops.generate(output=output, symbols=["ALI", "BPI"], development=True, now=NOW)
    assert batch["developmentOnly"] is True
    assert batch["history"] == []
    manifest, sha = ops.load_manifest()
    with pytest.raises(ValueError): ops.validate_batch(batch, manifest, sha)


def test_reconcile_only_previously_issued_rows_and_preserve_failure(fast_generation, monkeypatch):
    output, fit = fast_generation
    first = ops.generate(output=output, now=NOW)
    original = (output / "current.json").read_bytes()
    original_validate = ops.validate_data
    def next_session(path, **kwargs):
        df, _ = original_validate(path, now=NOW, development=False)
        row = df.iloc[-1].copy()
        row["Date"] = pd.Timestamp("2026-09-08")
        return pd.concat([df, row.to_frame().T], ignore_index=True).astype({"Date": "datetime64[ns]"}), "2026-09-09"
    monkeypatch.setattr(ops, "validate_data", next_session)
    fit.side_effect = RuntimeError("failed fit")
    later = datetime.fromisoformat("2026-09-08T18:00:00+08:00")
    with pytest.raises(RuntimeError): ops.generate(output=output, now=later)
    assert (output / "current.json").read_bytes() == original
    fit.side_effect = None
    second = ops.generate(output=output, now=later)
    assert len(second["history"]) == 30
    assert sum(r["actual"] is not None for r in second["history"]) == 15
    assert second["history"][0]["predictedClose"] == first["history"][0]["predictedClose"]
    assert second["promotionBoundary"] == first["promotionBoundary"]


def test_malformed_history_rejected(fast_generation):
    output, _ = fast_generation
    batch = ops.generate(output=output, now=NOW)
    batch["history"][0]["issuedAt"] = "2026-09-08T18:00:00+08:00"
    manifest, sha = ops.load_manifest()
    with pytest.raises(ValueError): ops.validate_batch(batch, manifest, sha)


def test_frozen_lasso_does_not_select_pacf_or_alpha(monkeypatch):
    from services.forecasting import lag_regression as lag
    monkeypatch.setattr(lag, "select_pacf_return_lags", Mock(side_effect=AssertionError("retuning")))
    monkeypatch.setattr(lag, "_select_alpha", Mock(side_effect=AssertionError("retuning")))
    manifest, _ = ops.load_manifest()
    df, _ = ops.validate_data(ops.BASE / "data/raw/ALI.csv", now=NOW, development=True)
    assert ops.refit_predict(df, manifest["companies"]["ALI"]) > 0


def test_lstm_fixes_epochs_seed_without_epoch_selection(monkeypatch):
    from services.forecasting import lstm_model as lstm
    manifest, _ = ops.load_manifest()
    frozen = manifest["companies"]["ICT"]["configuration"]
    df, _ = ops.validate_data(ops.BASE / "data/raw/ALI.csv", now=NOW, development=True)
    monkeypatch.setattr(lstm, "_determine_final_epoch", Mock(side_effect=AssertionError("epoch selection")))
    fit = Mock(return_value=Mock(state_dict=lambda: {}))
    monkeypatch.setattr(lstm, "_train_fixed_epochs", fit)
    artifact = lstm.refit_frozen_lstm(df, frozen)
    assert fit.call_args.kwargs == {"epochs": 47, "seed": 42}
    assert artifact["seq_len"] == 30


def test_operational_entrypoints_delegate_only_to_manifest(monkeypatch):
    from scripts import daily_inference
    from services import model_selector
    generate = Mock(return_value={"forecasts": {"ALI": {"model": "Lag-Informed Regression"}}})
    monkeypatch.setattr(ops, "generate", generate)
    daily_inference.run_daily_inference()
    model_selector.refresh_deployment_all()
    assert generate.call_count == 2


def test_workflows_remain_disabled():
    for filename in ["train_models.yml", "update_pipeline.yml"]:
        text = (ops.BASE.parent / ".github/workflows" / filename).read_text()
        assert "schedule:" not in text
        assert "repository_dispatch:" not in text
        assert "if: ${{ false }}" in text


def test_export_preserves_formal_results_and_rejects_smoke(fast_generation, monkeypatch, tmp_path):
    from scripts import export_operational as exporter
    output, _ = fast_generation
    monkeypatch.setattr(exporter, "OUTPUT", output)
    destination = tmp_path / "frontend"
    formal = destination / "formal/results.json"
    formal.parent.mkdir(parents=True)
    formal.write_bytes(b"immutable formal")
    ops.generate(output=output, now=NOW)
    exporter.export_operational(destination)
    assert ops.read_json(destination / "operational.json")["deploymentVersion"] == ops.PROMOTION
    before = (destination / "operational.json").read_bytes()
    invalid = ops.read_json(output / "current.json")
    invalid["developmentOnly"] = True
    ops.atomic_json(output / "current.json", invalid)
    with pytest.raises(ValueError): exporter.export_operational(destination)
    assert (destination / "operational.json").read_bytes() == before
    assert formal.read_bytes() == b"immutable formal"
