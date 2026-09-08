"""
Tests for formal evidence archive verifier script.
"""
from __future__ import annotations

import hashlib
import io
import tarfile
import tempfile
import zipfile
from pathlib import Path
from unittest import TestCase

from scripts.verify_evidence_archive import (
    DEFAULT_EXPECTED_RUN_ID,
    DEFAULT_EXPECTED_SHA256,
    EvidenceVerificationError,
    compute_sha256,
    get_archive_member_names,
    main,
    validate_archive_members,
    verify_archive,
)


class TestVerifyEvidenceArchive(TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.root = Path(self.temp_dir.name)

    def tearDown(self):
        self.temp_dir.cleanup()

    def _create_valid_zip(self, run_id: str = DEFAULT_EXPECTED_RUN_ID) -> Path:
        zip_path = self.root / "evidence.zip"
        with zipfile.ZipFile(zip_path, "w") as zf:
            zf.writestr(f"{run_id}/summary.json", b'{"status": "ok"}')
            zf.writestr(f"{run_id}/evidence/run_manifest.json", b'{"run": "formal"}')
        return zip_path

    def _create_valid_tar(self, run_id: str = DEFAULT_EXPECTED_RUN_ID) -> Path:
        tar_path = self.root / "evidence.tar.gz"
        with tarfile.open(tar_path, "w:gz") as tf:
            data = b'{"status": "ok"}'
            ti = tarfile.TarInfo(f"{run_id}/summary.json")
            ti.size = len(data)
            tf.addfile(ti, io.BytesIO(data))
        return tar_path

    def test_compute_sha256_matches_standard_hashlib(self):
        file_path = self.root / "test.dat"
        content = b"PSE stock forecasting formal evidence test content" * 1000
        file_path.write_bytes(content)

        expected = hashlib.sha256(content).hexdigest()
        self.assertEqual(compute_sha256(file_path), expected)

    def test_verify_valid_zip_archive(self):
        zip_path = self._create_valid_zip()
        sha = compute_sha256(zip_path)

        result = verify_archive(zip_path, expected_sha256=sha)
        self.assertEqual(result["sha256"], sha)
        self.assertEqual(result["run_id"], DEFAULT_EXPECTED_RUN_ID)
        self.assertEqual(result["member_count"], 2)

    def test_verify_valid_tar_archive(self):
        tar_path = self._create_valid_tar()
        sha = compute_sha256(tar_path)

        result = verify_archive(tar_path, expected_sha256=sha)
        self.assertEqual(result["sha256"], sha)
        self.assertEqual(result["member_count"], 1)

    def test_verify_sha256_mismatch_raises(self):
        zip_path = self._create_valid_zip()
        wrong_sha = "0000000000000000000000000000000000000000000000000000000000000000"

        with self.assertRaises(EvidenceVerificationError) as ctx:
            verify_archive(zip_path, expected_sha256=wrong_sha)
        self.assertIn("SHA-256 mismatch", str(ctx.exception))

    def test_verify_missing_file_raises(self):
        missing_path = self.root / "nonexistent.zip"
        with self.assertRaises(EvidenceVerificationError) as ctx:
            verify_archive(missing_path, expected_sha256=DEFAULT_EXPECTED_SHA256)
        self.assertIn("not found", str(ctx.exception))

    def test_verify_rejects_directory_traversal(self):
        zip_path = self.root / "malicious.zip"
        with zipfile.ZipFile(zip_path, "w") as zf:
            zf.writestr(f"../{DEFAULT_EXPECTED_RUN_ID}/escape.txt", b"evil")

        sha = compute_sha256(zip_path)
        with self.assertRaises(EvidenceVerificationError) as ctx:
            verify_archive(zip_path, expected_sha256=sha)
        self.assertIn("directory traversal", str(ctx.exception))

    def test_verify_rejects_absolute_path(self):
        zip_path = self.root / "absolute.zip"
        with zipfile.ZipFile(zip_path, "w") as zf:
            zf.writestr(f"/{DEFAULT_EXPECTED_RUN_ID}/abs.txt", b"evil")

        sha = compute_sha256(zip_path)
        with self.assertRaises(EvidenceVerificationError) as ctx:
            verify_archive(zip_path, expected_sha256=sha)
        self.assertIn("absolute path", str(ctx.exception))

    def test_verify_missing_expected_run_id_raises(self):
        zip_path = self._create_valid_zip(run_id="OTHER_RUN_ID")
        sha = compute_sha256(zip_path)

        with self.assertRaises(EvidenceVerificationError) as ctx:
            verify_archive(zip_path, expected_sha256=sha, expected_run_id=DEFAULT_EXPECTED_RUN_ID)
        self.assertIn("does not contain expected run ID", str(ctx.exception))

    def test_cli_main_success(self):
        zip_path = self._create_valid_zip()
        sha = compute_sha256(zip_path)

        exit_code = main(["--archive", str(zip_path), "--expected-sha256", sha])
        self.assertEqual(exit_code, 0)

    def test_cli_main_failure(self):
        zip_path = self._create_valid_zip()
        exit_code = main(["--archive", str(zip_path), "--expected-sha256", "bad_hash"])
        self.assertEqual(exit_code, 1)
