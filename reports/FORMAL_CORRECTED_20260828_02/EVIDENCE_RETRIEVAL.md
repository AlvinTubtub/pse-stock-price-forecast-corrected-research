# Formal Evidence Archive Retrieval and Verification Guide

## Research Authority and Artifact Identity

| Parameter | Value |
|---|---|
| **Formal Run ID** | `FORMAL_CORRECTED_20260828_02` |
| **Formal Code Commit** | `bfb33b8c184c87cc8828af5529410da94addd71c` |
| **Source Data Commit** | `2e72058057f5ba2ef903147c8390c3f05f41ffe3` |
| **Expected Evidence Archive SHA-256** | `2b2ed0ca6b88ea6cfef5ac14013440da1c7c55c1d9f9640e04a595fdafca5d24` |
| **Authoritative Source Document SHA-256** | `be6c351ef6f2bfa2e658ebc585f78eb73a891f986f86693b2d2e96da069d29f4` |
| **Corporate Action Registry SHA-256** | `98199732d5372683c256d1e7c9b9ab1b9987b9f2a7240dbe0c43d00370d508eb` |

---

## Storage Policy & Local Availability Notice

> [!IMPORTANT]
> **Off-Repository Storage Notice**: The complete multi-gigabyte formal evidence archive containing all cross-validation fold models, full prediction series, and tuning histories is intentionally **excluded from the Git repository** to prevent repository bloat and maintain git operational performance.
>
> The compiled research results, summary metrics, statistical hypothesis test tables, and manuscript acceptance documentation are committed in `results/formal/FORMAL_CORRECTED_20260828_02/` and `reports/FORMAL_CORRECTED_20260828_02/`.
>
> **Local Workspace Status**: The raw evidence archive is not stored in the working tree. Publication of this file as an external asset (e.g., GitHub Release attachment, Zenodo deposit, or academic repository) is an outstanding release action for repository maintainers.

---

## Expected Archive Structure

When retrieved, the archive package (ZIP or tarball) must have root-level or top-directory containment under the formal run identifier:

```text
FORMAL_CORRECTED_20260828_02/
├── summary.json
├── run_manifest.json
├── metrics.json
├── statistical_tests.json
├── corporate_actions_sensitivity.json
├── per_company/
│   ├── ALI/
│   │   ├── cv_results.json
│   │   ├── holdout_predictions.csv
│   │   └── diagnostics.json
│   ├── APX/
│   ├── BPI/
│   ├── GLO/
│   ├── ICT/
│   ├── JFC/
│   ├── MBT/
│   ├── MEG/
│   ├── MER/
│   ├── NIKL/
│   ├── PGOLD/
│   ├── SCC/
│   ├── SECB/
│   ├── SHLPH/
│   └── SMPH/
└── models/
    ├── lag_regression/
    ├── arima/
    └── lstm/
```

---

## Independent Verification Procedure

To verify an acquired archive without risky unpacking, use the built-in evidence verification tool:

```bash
python backend/scripts/verify_evidence_archive.py --archive /path/to/evidence_archive.zip
```

### Options:
- `--archive <PATH>`: Absolute or relative path to the archive file (required).
- `--expected-sha256 <HASH>`: SHA-256 checksum to verify (defaults to `2b2ed0ca6b88ea6cfef5ac14013440da1c7c55c1d9f9640e04a595fdafca5d24`).
- `--run-id <ID>`: Target run identifier within member names (defaults to `FORMAL_CORRECTED_20260828_02`).

### Security Checks Executed:
1. **Chunked Stream Hashing**: Computes SHA-256 in 64 KB memory chunks without loading the entire archive into RAM.
2. **Path Traversal Rejection**: Rejects any archive containing `..` path elements or directory escape sequences.
3. **Absolute Path Rejection**: Rejects entries beginning with root slashes or drive letters.
4. **Run Identifier Audit**: Confirms that entries belong to the declared formal run hierarchy.
