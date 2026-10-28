# Census 2011 Village Collision Review Summary

## 1. Executive Summary & Policy Guardrails

This review register operationalizes the review workflow for all **11,914 same-Tehsil village name collision groups** (comprising **25,921 affected records**) in the Census 2011 staging dataset (`data/staging/census2011/villages.jsonl`).

### Strict Review Rules Enforced:
1. **Grouping Scope:** All collisions are grouped strictly by `tehsil_id + canonical_name_lower` (normalized using Unicode NFC form, collapsed internal whitespace `[\s\u00A0]+` $\rightarrow$ `' '`, and lowercased).
2. **Zero Automatic Action:** No record has been automatically deleted, merged, renamed, or removed from the canonical hierarchy.
3. **Evidence Requirement:** Neither identical names nor Census codes alone justify declaring any record removed or duplicate.
4. **Initial Decision:** Every record starts with decision status **`NEEDS_EVIDENCE`**.
5. **Zero Mutation & Zero Ingestion:**
   - Source workbook (`data/source/PC11_TV_DIR.xlsx`): **UNTOUCHED (SHA-256 verified)**.
   - Staging files (`data/staging/census2011/`): **UNTOUCHED (SHA-256 verified)**.
   - Database / MongoDB: **DISCONNECTED (Zero connections, zero imports)**.
   - Production Schema & APIs: **UNMODIFIED**.

---

## 2. Review Output Files

The following review artifacts have been generated under the `reports/` directory:

| Artifact File | Format | Record Count | Description |
| :--- | :--- | :--- | :--- |
| [`reports/village_collision_review_register.json`](file:///c:/Users/yuvic/Desktop/My%20Place%20API/reports/village_collision_review_register.json) | JSON | **11,914 groups**<br>(25,921 records) | Machine-readable review docket for each collision group. Contains complete group metadata, allowed decisions (`KEEP`, `REMOVE_DUPLICATE`, `NEEDS_EVIDENCE`), initial decision (`NEEDS_EVIDENCE`), and all original record fields. |
| [`reports/village_collision_review_register.csv`](file:///c:/Users/yuvic/Desktop/My%20Place%20API/reports/village_collision_review_register.csv) | CSV | **25,922 lines**<br>(1 header + 25,921 rows) | Spreadsheet-ready RFC-4180 CSV with columns: `collision_group_id`, `tehsil_id`, `canonical_name_lower`, `category`, `source_row`, `staging_line_number`, `village_code`, `original_display_name`, `decision`, `decision_options`, `disposition`, `notes`. |
| [`reports/census2011_structural_exceptions.json`](file:///c:/Users/yuvic/Desktop/My%20Place%20API/reports/census2011_structural_exceptions.json) | JSON | **1 record** | Unresolved dangling-parent record at Row 306108 (`Kharija Dalaigaon Pt.2 (Part)`), policy: `DO_NOT_INFER_PARENT`. |
| [`reports/census2011_structural_exceptions.csv`](file:///c:/Users/yuvic/Desktop/My%20Place%20API/reports/census2011_structural_exceptions.csv) | CSV | **2 lines** (1 header + 1 row) | Tabular export of the single structural exception. |

---

## 3. Disjoint Collision Categories Partition

Every single record of the 25,921 affected villages is partitioned into exactly one disjoint category:

| Category | Description | Groups | Records |
| :--- | :--- | :---: | :---: |
| **Category A (Pure Identical Raw)** | Records whose raw display names are byte-for-byte identical within the same Tehsil. | 11,847 | 25,763 |
| **Category B (Pure Normalization-Only)** | Records whose raw display names differ in raw text but collide after Unicode NFC, whitespace collapsing, and case-folding. | 62 | 124 |
| **Category C (Mixed / Overlap)** | Groups containing both identical raw pairs and variant raw spellings/spacings. | 5 | 34 |
| **Total** | **Exhaustive and disjoint partition (zero double-counting)** | **11,914** | **25,921** |

---

## 4. Review Decision Options & Workflow

For each record within a collision group, human reviewers must select one of three allowed decisions:

| Decision Value | Definition | Criteria for Selection |
| :--- | :--- | :--- |
| `NEEDS_EVIDENCE` *(Default)* | The record cannot be safely resolved without external authoritative ground truth. | **Default initial state** for all 25,921 records. Retained until verified. |
| `KEEP` | The record represents a distinct, genuine settlement or administrative hamlet. | Authoritative evidence proves distinct geographic identity, population, or boundary (e.g. distinct Hadbast number or spatial polygon). |
| `REMOVE_DUPLICATE` | The record is an unneeded clerical duplication of another entry. | Verifiable proof confirms identical geographic identity and clerical repetition within the same Tehsil. |

---

## 5. Certification of Non-Mutation

- **Records Deleted:** 0
- **Records Merged:** 0
- **Records Renamed:** 0
- **Records Reparented:** 0
- **Records Imported to Database:** 0
- **Production Status:** `NOT APPROVED FOR IMPORT (REVIEW ONLY)`
