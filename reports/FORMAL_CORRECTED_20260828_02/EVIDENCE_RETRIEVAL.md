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
| **Official GitHub Release** | [`formal-corrected-20260828-02`](https://github.com/AlvinTubtub/pse-stock-price-forecast-corrected-research/releases/tag/formal-corrected-20260828-02) |
| **Release Asset Package** | `FORMAL_CORRECTED_20260828_02_results.tar.gz` (7,446,668 bytes) |
| **Direct Asset Download URL** | `https://github.com/AlvinTubtub/pse-stock-price-forecast-corrected-research/releases/download/formal-corrected-20260828-02/FORMAL_CORRECTED_20260828_02_results.tar.gz` |
| **Archive Publication Status** | **PUBLISHED & VERIFIED** |

---

## Storage Policy & Retrieval

> [!NOTE]
> **Off-Repository Storage Policy**: The complete formal evidence archive containing all cross-validation fold models, full prediction series, and tuning histories is kept off the Git commit tree to prevent repository bloat and maintain git operational performance.
>
> The compiled research results, summary metrics, statistical hypothesis test tables, and manuscript acceptance documentation are committed directly in `results/formal/FORMAL_CORRECTED_20260828_02/` and `reports/FORMAL_CORRECTED_20260828_02/`.
>
> **Release Availability**: The formal evidence archive is officially published as a release asset under tag [`formal-corrected-20260828-02`](https://github.com/AlvinTubtub/pse-stock-price-forecast-corrected-research/releases/tag/formal-corrected-20260828-02).
>
> Anyone can download and independently verify this package at any time.

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

### 1. Download the Published Archive

```bash
curl -s -L -o FORMAL_CORRECTED_20260828_02_results.tar.gz \
  https://github.com/AlvinTubtub/pse-stock-price-forecast-corrected-research/releases/download/formal-corrected-20260828-02/FORMAL_CORRECTED_20260828_02_results.tar.gz
```

### 2. Verify with the Verification Tool

```bash
python backend/scripts/verify_evidence_archive.py --archive FORMAL_CORRECTED_20260828_02_results.tar.gz
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
