"""Export an immutable, frontend-safe summary of a completed formal run.

This script never trains models and never changes the formal evidence. It reads
the finalized evidence directory, validates the approved run identity and
company coverage, then writes one compact JSON file for the Next.js frontend.

Example:

    python backend/scripts/export_formal_study_results.py \
        --run-dir formal_evidence/FORMAL_CORRECTED_20260828_02 \
        --output frontend/public/forecasts/formal/FORMAL_CORRECTED_20260828_02.json \
        --archive-sha256 2b2ed0ca6b88ea6cfef5ac14013440da1c7c55c1d9f9640e04a595fdafca5d24 \
        --source-data-commit 2e72058057f5ba2ef903147c8390c3f05f41ffe3

An existing output may be reused only when its bytes are identical. This keeps
daily inference and deployment refreshes from silently rewriting approved
research results.
"""
from __future__ import annotations

import argparse
import json
import math
import statistics
from pathlib import Path


APPROVED_RUN_ID = "FORMAL_CORRECTED_20260828_02"
APPROVED_CODE_COMMIT = "bfb33b8c184c87cc8828af5529410da94addd71c"
APPROVED_SOURCE_DATA_COMMIT = "2e72058057f5ba2ef903147c8390c3f05f41ffe3"
APPROVED_ARCHIVE_SHA256 = "2b2ed0ca6b88ea6cfef5ac14013440da1c7c55c1d9f9640e04a595fdafca5d24"
APPROVED_DATA_CUTOFF = "2026-08-28"
APPROVED_COMPANIES = (
    "ALI", "APX", "BPI", "GLO", "ICT", "JFC", "MBT", "MEG",
    "MER", "NIKL", "PGOLD", "SCC", "SECB", "SHLPH", "SMPH",
)
MODEL_ORDER = ("lag_reg", "arima", "lstm", "naive")
PRINCIPAL_MODELS = ("lag_reg", "arima", "lstm")
MODEL_LABELS = {
    "lag_reg": "Lag-Informed Regression",
    "arima": "ARIMA",
    "lstm": "LSTM",
    "naive": "Naive baseline",
}
METRIC_KEYS = ("rmse", "mae", "mase", "r2")


def _validate_external_identity(*, archive_sha256: str, source_data_commit: str) -> None:
    if archive_sha256 != APPROVED_ARCHIVE_SHA256:
        raise ValueError("Formal evidence archive SHA-256 does not match the approved Run 02 archive")
    if source_data_commit != APPROVED_SOURCE_DATA_COMMIT:
        raise ValueError("Formal source-data commit does not match the approved Run 02 data commit")


def _load(path: Path) -> dict:
    if not path.is_file():
        raise ValueError(f"Missing required formal artifact: {path}")
    try:
        value = json.loads(path.read_text())
    except Exception as exc:
        raise ValueError(f"Invalid JSON in {path}: {exc}") from exc
    if not isinstance(value, dict):
        raise ValueError(f"Expected a JSON object in {path}")
    return value


def _finite_metric(value: object, *, symbol: str, model: str, key: str) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError) as exc:
        raise ValueError(f"{symbol}/{model}: {key} is not numeric") from exc
    if not math.isfinite(number):
        raise ValueError(f"{symbol}/{model}: {key} is not finite")
    return number


def _canonical_metrics(payload: dict, symbol: str) -> dict[str, dict[str, float]]:
    raw = payload.get("metrics")
    if not isinstance(raw, dict) or set(raw) != set(MODEL_ORDER):
        raise ValueError(f"{symbol}: canonical metrics must contain exactly {MODEL_ORDER}")
    return {
        model: {
            key: _finite_metric(raw[model].get(key), symbol=symbol, model=model, key=key)
            for key in METRIC_KEYS
        }
        for model in MODEL_ORDER
    }


def _winner(metrics: dict[str, dict[str, float]], models: tuple[str, ...]) -> str:
    return min(models, key=lambda model: (metrics[model]["rmse"], MODEL_ORDER.index(model)))


def _lowest_including_ties(metrics: dict[str, dict[str, float]]) -> list[str]:
    minimum = min(metrics[model]["rmse"] for model in MODEL_ORDER)
    return [model for model in MODEL_ORDER if math.isclose(metrics[model]["rmse"], minimum, rel_tol=0, abs_tol=1e-12)]


def _configuration(diagnostics: dict, symbol: str) -> dict:
    lag = diagnostics.get("lag_reg", {})
    arima = diagnostics.get("arima", {})
    lstm = diagnostics.get("lstm", {})
    training = lstm.get("training_metadata", {})
    final_refit = training.get("final_epoch_info", {}).get("final_refit", {})
    selected_features = lag.get("selected_features", [])
    if not isinstance(selected_features, list):
        raise ValueError(f"{symbol}: selected LASSO features are malformed")
    selected_order = arima.get("selected_order")
    if not isinstance(selected_order, list) or len(selected_order) != 3:
        raise ValueError(f"{symbol}: selected ARIMA order is malformed")
    selected_config = training.get("selected_config")
    if not isinstance(selected_config, dict):
        raise ValueError(f"{symbol}: selected LSTM configuration is missing")
    return {
        "lagRegression": {
            "alpha": float(lag["selected_alpha"]),
            "selectedFeatureCount": len(selected_features),
            "selectedFeatures": selected_features,
        },
        "arima": {
            "order": [int(value) for value in selected_order],
            "trend": arima.get("selected_trend"),
            "converged": arima.get("final_fit_converged") is True,
        },
        "lstm": {
            "lookback": int(selected_config["lookback"]),
            "hiddenSize": int(selected_config["hidden_size"]),
            "learningRate": float(selected_config["learning_rate"]),
            "batchSize": int(selected_config["batch_size"]),
            "fixedEpochs": int(final_refit["fixed_epochs"]),
            "finalFitSeed": int(training["final_fit_seed"]),
            "tuningSeeds": [int(seed) for seed in training["tuning_seeds"]],
        },
    }


def build_formal_study(
    run_dir: Path,
    *,
    archive_sha256: str,
    source_data_commit: str,
) -> dict:
    print(f"[formal-export] Validating completed run in {run_dir}.")
    _validate_external_identity(
        archive_sha256=archive_sha256,
        source_data_commit=source_data_commit,
    )
    finalized = _load(run_dir / "finalized.json")
    methodology = _load(run_dir / "methodology_manifest.json")
    data_manifest = _load(run_dir / "data_manifest.json")
    split_manifest = _load(run_dir / "split_manifest.json")
    statistical_tests = _load(run_dir / "statistical_tests.json")

    for payload, name in (
        (finalized, "finalized.json"),
        (methodology, "methodology_manifest.json"),
        (data_manifest, "data_manifest.json"),
        (split_manifest, "split_manifest.json"),
    ):
        if payload.get("run_id") != APPROVED_RUN_ID:
            raise ValueError(f"{name}: expected run_id {APPROVED_RUN_ID}")
    if finalized.get("status") != "complete":
        raise ValueError("Formal run is not complete; refusing to export it")
    if methodology.get("repository_commit") != APPROVED_CODE_COMMIT:
        raise ValueError("Formal run code identity does not match the approved commit")
    if methodology.get("data_cutoff") != APPROVED_DATA_CUTOFF:
        raise ValueError("Formal run data cutoff does not match the approved cutoff")
    if tuple(methodology.get("company_universe", ())) != APPROVED_COMPANIES:
        raise ValueError("Formal run company universe is incomplete or out of order")

    data_companies = data_manifest.get("companies")
    split_companies = split_manifest.get("companies")
    test_companies = statistical_tests.get("per_company")
    if not all(isinstance(value, dict) for value in (data_companies, split_companies, test_companies)):
        raise ValueError("Formal manifests are missing per-company records")
    expected = set(APPROVED_COMPANIES)
    for value, label in (
        (data_companies, "data manifest"),
        (split_companies, "split manifest"),
        (test_companies, "statistical tests"),
    ):
        if set(value) != expected:
            raise ValueError(f"{label}: expected all 15 approved companies")

    per_company = []
    principal_win_counts = {model: 0 for model in PRINCIPAL_MODELS}
    medians = {model: {key: [] for key in METRIC_KEYS} for model in MODEL_ORDER}
    significant_vs_naive = []
    total_predictions = 0

    for symbol in APPROVED_COMPANIES:
        data = data_companies[symbol]
        split = split_companies[symbol]
        tests = test_companies[symbol]
        metrics = _canonical_metrics(tests, symbol)
        diagnostics = _load(run_dir / "per_company" / symbol / "diagnostics.json")

        if data.get("row_count") != 1624:
            raise ValueError(f"{symbol}: expected 1,624 source rows")
        if data.get("first_date", "")[:10] != "2020-01-02" or data.get("last_date", "")[:10] != APPROVED_DATA_CUTOFF:
            raise ValueError(f"{symbol}: source date range does not match the approved dataset")
        if split.get("development_count") != 1380 or split.get("holdout_count") != 243:
            raise ValueError(f"{symbol}: split counts do not match 1,380/243")
        holdout_dates = split.get("holdout_target_dates")
        development_dates = split.get("development_target_dates")
        if not isinstance(holdout_dates, list) or not isinstance(development_dates, list):
            raise ValueError(f"{symbol}: target-date arrays are missing")
        if holdout_dates[0][:10] != "2025-09-02" or holdout_dates[-1][:10] != APPROVED_DATA_CUTOFF:
            raise ValueError(f"{symbol}: holdout target dates do not match the approved window")

        principal_winner = _winner(metrics, PRINCIPAL_MODELS)
        principal_win_counts[principal_winner] += 1
        total_predictions += len(holdout_dates) * len(MODEL_ORDER)
        for model in MODEL_ORDER:
            for key in METRIC_KEYS:
                medians[model][key].append(metrics[model][key])

        squared_stage = tests.get("dm_squared_error", {}).get("stage1_vs_naive", [])
        dm_by_model = {}
        for result in squared_stage:
            model = result.get("model_a")
            if model not in PRINCIPAL_MODELS:
                continue
            item = {
                "adjustedPValue": float(result["holm_adjusted_p_value"]),
                "rawPValue": float(result["raw_p_value"]),
                "direction": result["direction"],
                "significantlyBeatsNaive": result.get("significantly_beats_naive") is True,
            }
            dm_by_model[model] = item
            if item["significantlyBeatsNaive"]:
                significant_vs_naive.append({"symbol": symbol, "model": model, **item})
        if set(dm_by_model) != set(PRINCIPAL_MODELS):
            raise ValueError(f"{symbol}: incomplete squared-error DM results")

        corporate = diagnostics.get("corporate_actions", {})
        sensitivity = corporate.get("sensitivity_analysis", {})
        per_company.append({
            "symbol": symbol,
            "dataSha256": data["sha256"],
            "principalWinnerByRmse": principal_winner,
            "lowestRmseIncludingNaive": _lowest_including_ties(metrics),
            "metrics": metrics,
            "dmSquaredErrorVsNaive": dm_by_model,
            "configuration": _configuration(diagnostics, symbol),
            "corporateActions": {
                "verifiedEventCount": len(corporate.get("verified_events", [])),
                "excludedTargetDates": sensitivity.get("excluded_target_dates", []),
                "remainingHoldoutCount": sensitivity.get("remaining_holdout_count"),
                "status": sensitivity.get("status"),
            },
        })

    across = statistical_tests.get("across_company", {})
    consistency = across.get("rmse_consistency", {})
    if consistency.get("counts") != principal_win_counts:
        raise ValueError("Computed principal-model RMSE wins do not match statistical_tests.json")
    if consistency.get("pass") is not False or consistency.get("dominant_model") is not None:
        raise ValueError("Approved run must record no 8-of-15 dominant model")

    aggregate = {
        model: {
            "label": MODEL_LABELS[model],
            "principalRmseWins": principal_win_counts.get(model),
            **{f"median{key.upper()}": statistics.median(values) for key, values in medians[model].items()},
        }
        for model in MODEL_ORDER
    }
    posthoc = across.get("wilcoxon_posthoc", {})
    posthoc_results = posthoc.get("results", {})
    significant_posthoc = [
        pair for pair, result in posthoc_results.items()
        if float(result["holm_p_value"]) < 0.05
    ]

    result = {
        "schemaVersion": 1,
        "kind": "immutable_formal_study",
        "runId": APPROVED_RUN_ID,
        "status": "complete",
        "finalizedAt": finalized["finalized_at"],
        "identity": {
            "repositoryCommit": APPROVED_CODE_COMMIT,
            "sourceDataCommit": source_data_commit,
            "archiveSha256": archive_sha256,
            "corporateActionRegistrySha256": methodology["corporate_action_policy"]["registry"]["sha256"],
            "releaseUrl": "https://github.com/AlvinTubtub/pse-stock-price-forecast/releases/tag/formal-corrected-20260828-02-code",
        },
        "data": {
            "firstDate": "2020-01-02",
            "cutoffDate": APPROVED_DATA_CUTOFF,
            "rowsPerCompany": 1624,
            "totalRows": 1624 * len(APPROVED_COMPANIES),
            "forecastPairsPerCompany": 1623,
            "developmentPairsPerCompany": 1380,
            "holdoutPairsPerCompany": 243,
            "holdoutStart": "2025-09-02",
            "holdoutEnd": APPROVED_DATA_CUTOFF,
            "totalHoldoutPredictions": total_predictions,
            "companyCount": len(APPROVED_COMPANIES),
        },
        "methodology": {
            "splitBasis": methodology["formal_split"]["split_basis"],
            "models": list(MODEL_ORDER),
            "modelLabels": MODEL_LABELS,
            "lassoAlphaCandidates": 36,
            "lstmConfigurations": 48,
            "lstmFolds": 5,
            "lstmTuningSeeds": [42, 123, 2026],
            "corporateActionPolicy": methodology["corporate_action_policy"],
        },
        "conclusion": {
            "summary": "No forecasting model was consistently dominant across the 15 companies.",
            "principalRmseWins": principal_win_counts,
            "dominanceThreshold": int(consistency["min_required"]),
            "dominantModel": None,
            "significantVsNaive": significant_vs_naive,
            "significantPosthocPairs": significant_posthoc,
        },
        "aggregate": aggregate,
        "perCompany": per_company,
        "acrossCompany": {
            "friedmanMase": across["friedman_mase"],
            "wilcoxonPosthoc": posthoc,
            "rmseConsistency": consistency,
        },
    }
    print(
        "[formal-export] Validated 15 companies, 60 metric rows, "
        f"and {total_predictions:,} holdout predictions."
    )
    return result


def write_immutable_json(payload: dict, output: Path) -> None:
    encoded = (json.dumps(payload, indent=2, sort_keys=True) + "\n").encode()
    if output.exists():
        if output.read_bytes() != encoded:
            raise ValueError(f"Refusing to overwrite non-identical formal result: {output}")
        print(f"[formal-export] Existing output is identical: {output}")
        return
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_bytes(encoded)
    print(f"[formal-export] Wrote immutable frontend dataset: {output}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--run-dir", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--archive-sha256", required=True)
    parser.add_argument("--source-data-commit", required=True)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    payload = build_formal_study(
        args.run_dir,
        archive_sha256=args.archive_sha256,
        source_data_commit=args.source_data_commit,
    )
    write_immutable_json(payload, args.output)


if __name__ == "__main__":
    main()
