#!/usr/bin/env python3
"""Manual official-data ingestion followed by approved Run 02 fixed-config refits.

No legacy selection, automatic promotion, remote schedules, or publishing.
Use --no-inference for ingestion only. --no-train remains a compatibility flag;
legacy training is always disabled in this entrypoint.
"""
from __future__ import annotations

import argparse
import json
import sys
import time
from datetime import date, datetime, timezone, timedelta
from pathlib import Path

import pandas as pd

from services.pdf_pipeline import run_pipeline
from services.pdf_pipeline.config import RAW_DIR, TARGET_COMPANIES
from services.pse_calendar import get_calendar

PHT = timezone(timedelta(hours=8))  # Philippine Time (UTC+8, no DST)

BASE_DIR = Path(__file__).resolve().parent
PREDICTION_CACHE_DIR = BASE_DIR / "prediction_cache"

EXPECTED_TICKERS = sorted(TARGET_COMPANIES.keys())

# Statuses for which we still check/attempt daily inference — raw CSVs on
# disk are meaningful (and may be stale relative to the cache) even on a
# run that didn't ingest anything new this time. "error" is excluded:
# something went genuinely wrong upstream and we don't want to mask that
# by quietly refreshing forecasts.
INFERENCE_ELIGIBLE_STATUSES = {"ok", "merged_with_warnings", "no_files", "no_rows"}

# Statuses that still count as a successful CI run — "no_files" means the
# pipeline correctly found nothing new to do (e.g. a market holiday, or the
# data is already current), which is a normal outcome, not a failure.
SUCCESS_STATUSES = {"ok", "merged_with_warnings", "no_files"}


def _parse_date(value: str) -> date:
    return datetime.strptime(value, "%Y-%m-%d").date()


def _latest_raw_date(symbol: str, raw_dir: Path = RAW_DIR) -> date | None:
    """Latest Date present in data/raw/<symbol>.csv, or None if the file
    is missing/empty."""
    csv_path = raw_dir / f"{symbol}.csv"
    if not csv_path.exists():
        return None
    try:
        df = pd.read_csv(csv_path, usecols=["Date"], parse_dates=["Date"])
    except Exception:
        return None
    if df.empty:
        return None
    return df["Date"].max().date()


def _cached_data_as_of(symbol: str, cache_dir: Path = PREDICTION_CACHE_DIR) -> date | None:
    """The data_as_of date the cached forecast was last computed against,
    or None if there is no cache yet or it has never had inference run
    (no inference_metadata block)."""
    cache_path = cache_dir / f"{symbol}.json"
    if not cache_path.exists():
        return None
    try:
        cache = json.loads(cache_path.read_text())
    except Exception:
        return None
    meta = cache.get("inference_metadata") or {}
    data_as_of = meta.get("data_as_of")
    if not data_as_of:
        return None
    try:
        return date.fromisoformat(data_as_of)
    except ValueError:
        return None


def tickers_needing_inference(
    tickers: list[str] = EXPECTED_TICKERS,
    raw_dir: Path = RAW_DIR,
    cache_dir: Path = PREDICTION_CACHE_DIR,
) -> list[str]:
    """Compare, per expected ticker, the latest raw OHLCV date against the
    latest date the cached forecast was actually computed against.

    A ticker needs inference when:
      - it has no cache yet, or the cache has never had inference run
        (no inference_metadata.data_as_of), or
      - raw data is strictly newer than what the cache was computed on.

    A ticker is skipped (considered current) when raw data exists and its
    date is <= the cache's data_as_of — this covers both "the cache is
    already current" and "the market has been closed since the last run"
    without needing a separate calendar check: if no new trading session
    has posted data, the raw date simply hasn't advanced.

    Tickers with no raw CSV at all are left for the 15-ticker enforcement
    in daily_inference to report explicitly, rather than silently skipped
    here.
    """
    stale: list[str] = []
    for symbol in tickers:
        latest_raw = _latest_raw_date(symbol, raw_dir)
        if latest_raw is None:
            # No raw data yet for this ticker — nothing to run inference
            # against; the 15-ticker enforcement step will flag this.
            continue
        cached_as_of = _cached_data_as_of(symbol, cache_dir)
        if cached_as_of is None or cached_as_of < latest_raw:
            stale.append(symbol)
    return stale


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run the PSE PDF ingestion pipeline headlessly.")
    parser.add_argument(
        "--no-download", dest="download", action="store_false",
        help="Skip fetching new reports from PSE EDGE; only process PDFs already in data/pdf_reports/.",
    )
    parser.add_argument(
        "--no-train", dest="train_models", action="store_false",
        help="Skip model retraining after ingestion (only update data/raw/ CSVs). "
             "Useful for lightweight CI runs that don't need scikit-learn/statsmodels/torch installed.",
    )
    parser.add_argument(
        "--inference", dest="run_inference", action="store_true",
        help="Refit approved Run 02 configurations after data merge. "
             "This is the default for the Fast Pipeline; use --no-inference to skip.",
    )
    parser.add_argument(
        "--no-inference", dest="run_inference", action="store_false",
        help="Skip the daily inference step (keeps stale predictions in prediction_cache/).",
    )
    parser.add_argument("--start-date", type=_parse_date, default=None, help="YYYY-MM-DD, defaults to the day after the newest data on file.")
    parser.add_argument("--end-date", type=_parse_date, default=None, help="YYYY-MM-DD, defaults to today.")
    parser.add_argument(
        "--ignore-calendar", dest="ignore_calendar", action="store_true", default=False,
        help="Bypass the PSE trading calendar check (force-run on weekends or holidays).",
    )
    parser.set_defaults(download=True, train_models=False, run_inference=True)
    return parser.parse_args()


def main() -> int:
    """Ingest official reports, then run inference with approved persisted models."""
    from services.operational_deployment import load_manifest, infer_daily
    args = _parse_args()
    load_manifest()  # fail before ingestion if approval is missing or invalid
    result = run_pipeline(download=args.download, start_date=args.start_date,
                          end_date=args.end_date, train_models=False)
    if result["status"] not in INFERENCE_ELIGIBLE_STATUSES:
        print(f"[pipeline] Ingestion failed: {result['status']}")
        return 1
    if args.run_inference:
        try:
            infer_daily()
        except Exception as exc:
            print(f"[pipeline] Approved daily inference stopped: {exc}")
            return 1
    print("[pipeline] Completed; automatic selection and promotion are disabled.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
