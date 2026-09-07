"""Tests for the immutable formal-study frontend dataset."""
from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from scripts.export_formal_study_results import (
    APPROVED_ARCHIVE_SHA256,
    APPROVED_CODE_COMMIT,
    APPROVED_RUN_ID,
    APPROVED_SOURCE_DATA_COMMIT,
    _canonical_metrics,
    _validate_external_identity,
    write_immutable_json,
)


REPO_ROOT = Path(__file__).resolve().parents[2]
FORMAL_DATASET = REPO_ROOT / "frontend" / "public" / "forecasts" / "formal" / f"{APPROVED_RUN_ID}.json"


def test_committed_formal_dataset_matches_the_approved_audit():
    payload = json.loads(FORMAL_DATASET.read_text())

    assert payload["schemaVersion"] == 1
    assert payload["kind"] == "immutable_formal_study"
    assert payload["runId"] == APPROVED_RUN_ID
    assert payload["status"] == "complete"
    assert payload["identity"]["repositoryCommit"] == APPROVED_CODE_COMMIT
    assert payload["identity"]["archiveSha256"] == APPROVED_ARCHIVE_SHA256
    assert payload["identity"]["sourceDataCommit"] == APPROVED_SOURCE_DATA_COMMIT
    assert {
        key: payload["data"][key]
        for key in (
            "companyCount",
            "rowsPerCompany",
            "totalRows",
            "developmentPairsPerCompany",
            "holdoutPairsPerCompany",
            "totalHoldoutPredictions",
            "cutoffDate",
        )
    } == {
        "companyCount": 15,
        "rowsPerCompany": 1624,
        "totalRows": 24360,
        "developmentPairsPerCompany": 1380,
        "holdoutPairsPerCompany": 243,
        "totalHoldoutPredictions": 14580,
        "cutoffDate": "2026-08-28",
    }
    assert payload["conclusion"]["principalRmseWins"] == {"arima": 7, "lag_reg": 7, "lstm": 1}
    assert payload["conclusion"]["dominantModel"] is None
    assert payload["conclusion"]["significantPosthocPairs"] == []
    assert {(row["symbol"], row["model"]) for row in payload["conclusion"]["significantVsNaive"]} == {
        ("ICT", "lag_reg"),
        ("MBT", "lag_reg"),
    }
    assert len(payload["perCompany"]) == 15
    assert sum(len(row["metrics"]) for row in payload["perCompany"]) == 60


def test_external_identity_rejects_unapproved_archive_or_source_commit():
    _validate_external_identity(
        archive_sha256=APPROVED_ARCHIVE_SHA256,
        source_data_commit=APPROVED_SOURCE_DATA_COMMIT,
    )

    with pytest.raises(ValueError, match="archive SHA-256"):
        _validate_external_identity(
            archive_sha256="0" * 64,
            source_data_commit=APPROVED_SOURCE_DATA_COMMIT,
        )
    with pytest.raises(ValueError, match="source-data commit"):
        _validate_external_identity(
            archive_sha256=APPROVED_ARCHIVE_SHA256,
            source_data_commit="0" * 40,
        )


def test_immutable_writer_accepts_identical_bytes(tmp_path):
    output = tmp_path / "formal.json"
    payload = {"runId": APPROVED_RUN_ID, "status": "complete"}

    write_immutable_json(payload, output)
    original = output.read_bytes()
    write_immutable_json(payload, output)

    assert output.read_bytes() == original


def test_immutable_writer_rejects_changed_payload(tmp_path):
    output = tmp_path / "formal.json"
    write_immutable_json({"status": "complete"}, output)

    with pytest.raises(ValueError, match="Refusing to overwrite"):
        write_immutable_json({"status": "failed"}, output)


def test_canonical_metrics_rejects_incomplete_or_nonfinite_values():
    complete = {
        model: {"rmse": 1.0, "mae": 1.0, "mase": 1.0, "r2": 1.0}
        for model in ("lag_reg", "arima", "lstm", "naive")
    }
    assert _canonical_metrics({"metrics": complete}, "ALI")["lag_reg"]["rmse"] == 1.0

    del complete["naive"]
    with pytest.raises(ValueError, match="exactly"):
        _canonical_metrics({"metrics": complete}, "ALI")
