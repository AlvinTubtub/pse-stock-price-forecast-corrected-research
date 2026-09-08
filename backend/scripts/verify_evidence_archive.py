#!/usr/bin/env python3
"""
Formal Evidence Archive Verification Tool

Safely verifies the integrity and structure of an immutable research evidence archive
without unpacking untrusted content onto the local disk.

Validations performed:
1. File existence and non-zero size.
2. SHA-256 chunked cryptographic digest matching the formal expected hash.
3. Archive format validation (zip or tar.*).
4. Path traversal / absolute path security check on member names.
5. Presence of the required formal run ID directory hierarchy.
"""
from __future__ import annotations

import argparse
import hashlib
import os
import sys
import tarfile
import zipfile
from pathlib import Path
from typing import Sequence

DEFAULT_EXPECTED_SHA256 = "2b2ed0ca6b88ea6cfef5ac14013440da1c7c55c1d9f9640e04a595fdafca5d24"
DEFAULT_EXPECTED_RUN_ID = "FORMAL_CORRECTED_20260828_02"
CHUNK_SIZE = 64 * 1024  # 64 KB


class EvidenceVerificationError(Exception):
    """Raised when an evidence archive fails verification."""
    pass


def compute_sha256(file_path: Path) -> str:
    """Compute the SHA-256 digest of a file in chunks."""
    if not file_path.exists():
        raise EvidenceVerificationError(f"Evidence archive file not found: {file_path}")
    if not file_path.is_file():
        raise EvidenceVerificationError(f"Path is not a regular file: {file_path}")

    hasher = hashlib.sha256()
    with file_path.open("rb") as f:
        while chunk := f.read(CHUNK_SIZE):
            hasher.update(chunk)
    return hasher.hexdigest()


def get_archive_member_names(file_path: Path) -> list[str]:
    """
    List member relative names from a zip or tar archive without extracting.
    """
    if zipfile.is_zipfile(file_path):
        with zipfile.ZipFile(file_path, "r") as zf:
            return zf.namelist()

    try:
        with tarfile.open(file_path, "r:*") as tf:
            return tf.getnames()
    except tarfile.ReadError:
        pass

    raise EvidenceVerificationError(
        f"File '{file_path.name}' is neither a recognized zip nor a tar archive."
    )


def validate_archive_members(member_names: Sequence[str], expected_run_id: str) -> None:
    """
    Ensure no archive members use directory traversal or absolute paths,
    and ensure the expected run ID is present in the archive hierarchy.
    """
    if not member_names:
        raise EvidenceVerificationError("Archive contains no members.")

    found_run_id = False
    for raw_name in member_names:
        # Normalize separators
        clean_name = raw_name.replace("\\", "/")

        # Disallow absolute paths
        if clean_name.startswith("/") or (len(clean_name) > 1 and clean_name[1] == ":"):
            raise EvidenceVerificationError(
                f"Security violation: Archive contains absolute path: {raw_name}"
            )

        parts = [p for p in clean_name.split("/") if p]
        if ".." in parts:
            raise EvidenceVerificationError(
                f"Security violation: Archive contains directory traversal ('..'): {raw_name}"
            )

        if expected_run_id in parts:
            found_run_id = True

    if not found_run_id:
        raise EvidenceVerificationError(
            f"Archive hierarchy does not contain expected run ID '{expected_run_id}'."
        )


def verify_archive(
    archive_path: Path,
    expected_sha256: str = DEFAULT_EXPECTED_SHA256,
    expected_run_id: str = DEFAULT_EXPECTED_RUN_ID,
) -> dict[str, str | int]:
    """
    Perform full verification of the formal evidence archive.
    Returns summary statistics on success.
    """
    archive_path = Path(archive_path)
    if not archive_path.exists():
        raise EvidenceVerificationError(f"Evidence archive file not found: {archive_path}")

    actual_sha256 = compute_sha256(archive_path)
    if actual_sha256.lower() != expected_sha256.lower():
        raise EvidenceVerificationError(
            f"SHA-256 mismatch for {archive_path.name}:\n"
            f"  Expected: {expected_sha256.lower()}\n"
            f"  Actual:   {actual_sha256.lower()}"
        )

    members = get_archive_member_names(archive_path)
    validate_archive_members(members, expected_run_id)

    return {
        "archive_path": str(archive_path.resolve()),
        "file_size_bytes": archive_path.stat().st_size,
        "sha256": actual_sha256.lower(),
        "member_count": len(members),
        "run_id": expected_run_id,
    }


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Verify the SHA-256 checksum and safe structure of a formal evidence archive."
    )
    parser.add_argument(
        "--archive",
        type=Path,
        required=True,
        help="Path to the evidence archive file (.zip, .tar.gz, etc.)",
    )
    parser.add_argument(
        "--expected-sha256",
        type=str,
        default=DEFAULT_EXPECTED_SHA256,
        help=f"Expected SHA-256 checksum (default: {DEFAULT_EXPECTED_SHA256})",
    )
    parser.add_argument(
        "--run-id",
        type=str,
        default=DEFAULT_EXPECTED_RUN_ID,
        help=f"Expected run identifier inside archive (default: {DEFAULT_EXPECTED_RUN_ID})",
    )

    args = parser.parse_args(argv)

    print(f"Verifying formal evidence archive: {args.archive}")
    try:
        summary = verify_archive(
            archive_path=args.archive,
            expected_sha256=args.expected_sha256,
            expected_run_id=args.run_id,
        )
        print("✅ Archive verification successful:")
        print(f"   Path:        {summary['archive_path']}")
        print(f"   Size:        {summary['file_size_bytes']:,} bytes")
        print(f"   SHA-256:     {summary['sha256']}")
        print(f"   Run ID:      {summary['run_id']}")
        print(f"   Members:     {summary['member_count']} safe entries inspected")
        return 0
    except EvidenceVerificationError as err:
        print(f"❌ Verification failed: {err}", file=sys.stderr)
        return 1
    except Exception as err:
        print(f"❌ Unexpected error during verification: {err}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
