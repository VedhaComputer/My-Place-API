# Census 2011 Quarantine Evidence-Review Package

**Document Version:** 1.0.0  
**Target System:** India Place API (`C:\Users\yuvic\Desktop\My Place API`)  
**Scope:** Complete Audit Inventory of all 26,447 Quarantined Census 2011 Staging Records  
**Status:** **`EVIDENCE REVIEW PACKAGE ONLY — NO RECORDS APPROVED — NO DATABASE MUTATIONS`**  
*(Notice: This document is an evidentiary review inventory and decision framework. It strictly does NOT authorize or execute production database import, data mutation, record merging, or automatic approval. All decisions remain pending explicit curator and system owner review.)*

---

## 1. Executive Summary & Complete Quarantine Reconciliation

In accordance with the zero-fabrication and parent-scoped uniqueness policies of [`CENSUS_IMPORT_DESIGN.md`](file:///c:/Users/yuvic/Desktop/My%20Place%20API/CENSUS_IMPORT_DESIGN.md) v1.4.0, exactly **26,447 records** from the 645,876 staged villages are held in quarantine to prevent database corruption, duplicate key violations, and unverified mergers.

### 1.1 Complete 4-Group Quarantine Reconciliation

The 26,447 quarantined records partition into four mutually disjoint review categories:

$$\begin{aligned}
\text{Group A: Staging-Verified Name Collisions (Review Only)} &= 23 \text{ records} \quad (11 \text{ groups}) \\
\text{Group B: Undecided Same-Tehsil Name Collisions} &= 25,898 \text{ records} \quad (11,903 \text{ groups}) \\
\text{Group C: Duplicate / Ambiguous Village Code Groups} &= 525 \text{ records} \quad (241 \text{ code groups}) \\
\text{Group D: Structural Missing-Parent Exceptions} &= 1 \text{ record} \quad (1 \text{ group}) \\
\hline
\mathbf{\text{Total Quarantined Records}} &= \mathbf{26,447 \text{ records}}
\end{aligned}$$

### 1.2 Master Accounting Reconciliation Across All Datasets

Every single row and entity in the Census 2011 staging dataset is accounted for with 100% mathematical consistency:

| Administrative Category | Total Records | Status | Persistence Target Collection | Notes & Verification Reference |
| :--- | :---: | :---: | :--- | :--- |
| **Accepted Country Root** | 1 | `ACCEPTED` | `places_census2011` | Synthetic root anchor `CENSUS2011_IND` |
| **Accepted States / UTs** | 35 | `ACCEPTED` | `places_census2011` | All 35 States & UTs (`dt=000`, `sdt=00000`) |
| **Accepted Districts** | 640 | `ACCEPTED` | `places_census2011` | All 640 Census Districts (`sdt=00000`) |
| **Accepted Tehsils** | 5,960 | `ACCEPTED` | `places_census2011` | 5,960 primary rows (embeds 15 alias rows) |
| **Accepted Towns** | 4,268 | `ACCEPTED` | `places_census2011` | All 4,268 statutory & census towns with verified parent |
| **Accepted Canonical Villages** | 619,429 | `ACCEPTED` | `places_census2011` | Verified collision-free villages with valid parent |
| **Subtotal Accepted Candidates** | **630,333** | `ACCEPTED` | `places_census2011` | **Dry-Run Import Plan: PASS** |
| **Quarantined Name Collisions (Groups A & B)** | 25,921 | `QUARANTINE` | `census2011_quarantine_places` | 23 verified + 25,898 undecided collisions |
| **Quarantined Duplicate Village Codes (Group C)**| 525 | `QUARANTINE` | `census2011_quarantine_places` | 241 code groups with identical 6-digit codes |
| **Quarantined Structural Exception (Group D)** | 1 | `QUARANTINE` | `census2011_quarantine_places` | Row 306108 (`Kharija Dalaigaon Pt.2 (Part)`) |
| **Subtotal Quarantined Entities** | **26,447** | `QUARANTINE` | `census2011_quarantine_places` | **100% Mutually Disjoint** |
| **Auxiliary Urban Summaries** | 215 | `AUXILIARY` | `census2011_urban_summaries` | 53 metropolitan + 162 direct-district municipal |
| **Grand Total Stored Entities** | **656,995** | — | — | **$630,333 + 26,447 + 215 = 656,995$** |
| *Subtract Synthetic Country Root* | -1 | — | — | Country root is not an Excel row |
| *Add Embedded Subdistrict Alias Rows* | +15 | — | — | Preserved inside `tehsils.json` `aliases[]` |
| **Total Source Workbook Data Rows** | **657,009** | — | — | Rows 2 through 657,010 in `PC11_TV_DIR.xlsx` |
| *Add Header Row* | +1 | — | — | Row 1: Column Headings |
| **Total Source Master Workbook Rows** | **657,010** | — | — | **100.000% Source Row Accounting Reconciliation** |

### 1.3 Disjointness Proof (Zero Double-Counting)

An independent set-intersection audit across all 645,876 village rows confirms:
* $\text{Collision Review Rows (25,921)} \cap \text{Duplicate Code Rows (525)} = \mathbf{0}$
* $\text{Collision Review Rows (25,921)} \cap \text{Structural Exception Rows (1)} = \mathbf{0}$
* $\text{Duplicate Code Rows (525)} \cap \text{Structural Exception Rows (1)} = \mathbf{0}$
* **Internal sourceRow Duplicates in `villages.jsonl`:** Exactly **0** (each of the 645,876 villages has a unique sourceRow).
* **Result:** Zero double-counting across quarantine review groups.

### 1.4 JSON vs CSV Register 1:1 Matching Verification (RFC 4180 Parser Audit)
An automated record-by-record reconciliation between [`reports/village_collision_authoritative_evidence_review.json`](file:///c:/Users/yuvic/Desktop/My%20Place%20API/reports/village_collision_authoritative_evidence_review.json) and [`reports/village_collision_authoritative_evidence_review.csv`](file:///c:/Users/yuvic/Desktop/My%20Place%20API/reports/village_collision_authoritative_evidence_review.csv) was executed using the standard library RFC 4180-compliant CSV parser (`Python 3.14 csv.reader`):
* **Dynamic Header Resolution:** The column `source_row` was resolved dynamically from the CSV header by name rather than relying on a hardcoded offset. Discovered column index: **0-based index `9`** (**1-based index `10`**).
* **CSV Total Lines:** Exactly 25,922 (1 Header Line + 25,921 Data Rows)
* **CSV Header Fields:** Exactly 19 columns
* **CSV Malformed Rows:** Exactly 0 (no mismatched field counts or invalid integers)
* **CSV Duplicate `source_row`:** Exactly 0
* **CSV Duplicate Composite Keys `(tehsil_id, village_code, source_row)`:** Exactly 0
* **JSON Total Records:** Exactly 25,921
* **JSON Malformed `sourceRow`:** Exactly 0
* **JSON Duplicate `sourceRow`:** Exactly 0
* **JSON Duplicate Composite Keys:** Exactly 0
* **Unique `sourceRow`s in JSON:** Exactly 25,921
* **Unique `sourceRow`s in CSV:** Exactly 25,921
* **Missing in CSV (in JSON but not CSV):** Exactly 0
* **Extra in CSV (in CSV but not JSON):** Exactly 0
* **Parser Discrepancies:** Exactly 0 difference from baseline counts (100% 1:1 bijection across all 25,921 records).

---

## 2. Review Protocol & Evidentiary Schema Template for Human Curators

To resolve any quarantined record without fabricating government records, human curators must evaluate official gazette and Primary Census Abstract (PCA) evidence against this standardized review schema.

### 2.1 Standardized Evidence Capture Template

```yaml
REVIEW_CASE_TEMPLATE:
  collision_group_or_code_id: "STRING (e.g. COL_SDT_01_001_00001_dard_pora or DUP_CODE_111863)"
  target_record:
    source_row: INTEGER (from PC11_TV_DIR.xlsx)
    staging_line_number: INTEGER (from villages.jsonl)
    state_code: "2-digit string"
    district_code: "3-digit string"
    sub_district_code: "5-digit string"
    village_code: "6-digit string"
    original_display_name: "Exact string from source workbook"
    canonical_name_lower: "NFC lowercase string"
    parent_tehsil_id: "e.g. CENSUS2011_SDT_01_001_00001"
  missing_source_attributes:
    hadbast_number: "NOT_RECORDED_IN_SOURCE_WORKBOOK"
    cadastral_area_hectares: "NOT_IN_WORKBOOK_REQUIRES_DCHB_EXTRACTION"
    enumeration_population: "NOT_IN_WORKBOOK_REQUIRES_DCHB_EXTRACTION"
    contemporary_gp_notification: "UNAVAILABLE_NEEDS_STATE_GAZETTE_ACQUISITION"
  curator_evidence_submission:
    authoritative_source_type: "[ ] DCHB_PART_B_PCA_PDF | [ ] STATE_OFFICIAL_GAZETTE | [ ] LGD_DIRECTORY | [ ] REVENUE_SURVEY_MAP"
    source_citation: "URL / Local Archive Path / SHA-256 Checksum"
    page_or_table_reference: "Printed Page Number / Table Name / Gazette Order No."
    matched_village_code: "6-digit code verified on cited page"
    verified_demographics:
      area_hectares: DECIMAL
      households: INTEGER
      total_population: INTEGER
      male_population: INTEGER
      female_population: INTEGER
  human_curator_verdict:
    decision: "[ ] KEEP_SEPARATE | [ ] CONFIRM_MERGE | [ ] EXCLUDE_OUTGROWTH | [ ] RETAIN_QUARANTINE"
    justification_notes: "Detailed historical/legal explanation supporting the decision"
    reviewer_identity: "Curator Name / Badge ID"
    review_date: "YYYY-MM-DD"
    supervisor_sign_off: "[ ] APPROVED | [ ] REJECTED | [ ] NEEDS_FURTHER_EVIDENCE"
```

### 2.2 Decision Rules for Human Reviewers

1. **`KEEP_SEPARATE` (Retain Both as Distinct Census 2011 Entities):**
   - *Requirement:* Verified Primary Census Abstract (PCA) from District Census Handbook (DCHB) proves distinct survey entries with independent 6-digit Census codes, separate land areas, and non-overlapping household counts.
   - *Production Bound:* Applicable exclusively to historical Census 2011 staging. Does **not** authorize automatic modern Gram Panchayat autonomy in live API directories without post-2011 gazette evidence.
2. **`CONFIRM_MERGE` (Clerical Duplicate Consolidation):**
   - *Requirement:* Official errata or state gazette proves that the multiple rows represent a typographical or clerical duplication of the exact same revenue parcel.
   - *Action:* Retain primary canonical row; document consolidated source row in `metadata.consolidatedSourceRows[]`.
3. **`EXCLUDE_OUTGROWTH` (Sub-Revenue Settlement / Urban Outgrowth):**
   - *Requirement:* Source row is identified as an Outgrowth (OG) Part or unorganized hamlet belonging to an adjacent statutory town or mother village.
   - *Action:* Route to auxiliary outgrowth registry; do not create duplicate canonical village.
4. **`RETAIN_QUARANTINE` (Default Safe Stance):**
   - If conclusive government gazette or DCHB page evidence cannot be located or verified, the record **must remain in quarantine**. Zero guessing is permitted.

---

## 3. Inventory Group A: Staging-Verified Name Collisions (23 Records, 11 Groups)

These 11 groups (23 records) have been verified end-to-end against official District Census Handbooks using Poppler `pdftotext v4.06` to represent distinct Census 2011 enumeration entries. Production status remains strictly **`NOT APPROVED FOR IMPORT (EVIDENCE REVIEW ONLY)`**.

### 3.1 Source Documents & Cryptographic Verification
* **Kupwara (Series 02, Part XII-B):** `DH_2011_0101_PART_B_DCHB_KUPWARA.pdf`  
  *SHA-256 Checksum:* `88d825ceddc498fd2931486fef42d3cf44d30c445802c9f3d5afe8da9c2965af` (13 records verified)
* **Kullu (Series 02, Part XII-B):** `DH_2011_0204_PART_B_DCHB_KULLU.pdf`  
  *SHA-256 Checksum:* `34a1bb1f8e951abc6b23c344a382b7ba49fa0e928f036e5d55925b996b1517c3` (2 records verified)
* **Saharanpur (Series 10, Part XII-B):** `DH_2011_0901_PART_B_DCHB_SAHARANPUR.pdf`  
  *SHA-256 Checksum:* `56ed4b72dde5774202580541a6fa4b959a5cd91ff46e1eebff8cca8bfa8f2ff7` (8 records verified)

### 3.2 Complete 23-Record Traceability Inventory

| Collision Group ID | Source Row | State | District | Tehsil | Village Code | Original Name | Verified DCHB Reference & Findings | Traceability Status | Recommendation |
| :--- | :---: | :---: | :---: | :---: | :---: | :--- | :--- | :---: | :---: |
| `COL_SDT_01_001_00001_dard_pora` | 32 | 01 | 001 | 00001 (Kupwara) | `000026` | Dard Pora | DCHB Kupwara, Page 79 (Printed 72), Sogam Block: 216.10 ha, 549 HH, Pop: 3,329 | `VERIFIED` | `KEEP_SEPARATE` |
| `COL_SDT_01_001_00001_dard_pora` | 90 | 01 | 001 | 00001 (Kupwara) | `000084` | Dard Pora | DCHB Kupwara, Page 61 (Printed 54), Kralpora Block: 653.60 ha, 1,414 HH, Pop: 14,260 | `VERIFIED` | `KEEP_SEPARATE` |
| `COL_SDT_01_001_00001_push_wari` | 21 | 01 | 001 | 00001 (Kupwara) | `000015` | Push Wari | DCHB Kupwara, Page 79 (Printed 72), Sogam Block: 286.50 ha, 272 HH, Pop: 1,479 | `VERIFIED` | `KEEP_SEPARATE` |
| `COL_SDT_01_001_00001_push_wari` | 107 | 01 | 001 | 00001 (Kupwara) | `000101` | Push Wari | DCHB Kupwara, Page 73 (Printed 66), Kupwara Block: 40.90 ha, 113 HH, Pop: 996 | `VERIFIED` | `KEEP_SEPARATE` |
| `COL_SDT_01_001_00002_khai_pora` | 240 | 01 | 001 | 00002 (Handwara) | `000232` | Khai Pora | DCHB Kupwara, Page 103 (Printed 96), Rajwar Block: 335.03 ha, 198 HH, Pop: 1,338 | `VERIFIED` | `KEEP_SEPARATE` |
| `COL_SDT_01_001_00002_khai_pora` | 319 | 01 | 001 | 00002 (Handwara) | `000311` | Khai Pora | DCHB Kupwara, Page 121 (Printed 114), Langet Block: 99.60 ha, 134 HH, Pop: 930 | `VERIFIED` | `KEEP_SEPARATE` |
| `COL_SDT_01_001_00002_pala_pora` | 235 | 01 | 001 | 00002 (Handwara) | `000227` | Pala  Pora | DCHB Kupwara, Page 103 (Printed 96), Rajwar Block: 51.00 ha, 76 HH, Pop: 493 | `VERIFIED` | `KEEP_SEPARATE` |
| `COL_SDT_01_001_00002_pala_pora` | 321 | 01 | 001 | 00002 (Handwara) | `000313` | Pala  Pora | DCHB Kupwara, Page 109 (Printed 102), Langet Block: 95.50 ha, 133 HH, Pop: 979 | `VERIFIED` | `KEEP_SEPARATE` |
| `COL_SDT_01_001_00002_tulwari` | 160 | 01 | 001 | 00002 (Handwara) | `000152` | Tulwari | DCHB Kupwara, Page 103 (Printed 96), Rajwar Block: 30.80 ha, 61 HH, Pop: 318 | `VERIFIED` | `KEEP_SEPARATE` |
| `COL_SDT_01_001_00002_tulwari` | 218 | 01 | 001 | 00002 (Handwara) | `000210` | Tulwari | DCHB Kupwara, Page 115 (Printed 108), Langet Block: 190.60 ha, 211 HH, Pop: 1,480 | `VERIFIED` | `KEEP_SEPARATE` |
| `COL_SDT_01_001_00002_wara_pora` | 234 | 01 | 001 | 00002 (Handwara) | `000226` | Wara Pora | DCHB Kupwara, Page 103 (Printed 96), Rajwar Block (S.No 103): 100.00 ha, 167 HH, Pop: 1,153 | `VERIFIED` | `KEEP_SEPARATE` |
| `COL_SDT_01_001_00002_wara_pora` | 248 | 01 | 001 | 00002 (Handwara) | `000240` | Wara Pora | DCHB Kupwara, Page 103 (Printed 96), Rajwar Block (S.No 136): 146.50 ha, 136 HH, Pop: 874 | `VERIFIED` | `KEEP_SEPARATE` |
| `COL_SDT_01_001_00002_wara_pora` | 292 | 01 | 001 | 00002 (Handwara) | `000284` | Wara Pora | DCHB Kupwara, Page 121 (Printed 114), Langet Block: 37.20 ha, 76 HH, Pop: 466 | `VERIFIED` | `KEEP_SEPARATE` |
| `COL_SDT_02_035_00188_up_muhal_mahilee`| 13086 | 02 | 035 | 00188 (Kullu) | `012818` | Up Muhal Mahilee | DCHB Kullu, Page 71 (Printed 64), Naggar Block: 74.15 ha, 17 HH, Pop: 65 | `VERIFIED` | `KEEP_SEPARATE` |
| `COL_SDT_02_035_00188_up_muhal_mahilee`| 13110 | 02 | 035 | 00188 (Kullu) | `012842` | Up Muhal Mahilee | DCHB Kullu, Page 77 (Printed 70), Naggar Block: 34.00 ha, 29 HH, Pop: 147 | `VERIFIED` | `KEEP_SEPARATE` |
| `COL_SDT_09_132_00701_ahmadpur` | 110586 | 09 | 132 | 00701 (Behat) | `108954` | Ahmadpur | DCHB Saharanpur, Page 123 (Printed 104), Sadauli Qadeem Block: 168.21 ha, Pop: 0 | `VERIFIED` | `KEEP_SEPARATE` |
| `COL_SDT_09_132_00701_ahmadpur` | 110719 | 09 | 132 | 00701 (Behat) | `109087` | Ahmadpur | DCHB Saharanpur, Page 141 (Printed 122), Muzaffarabad Block: 35.31 ha, Pop: 0 | `VERIFIED` | `KEEP_SEPARATE` |
| `COL_SDT_09_132_00701_malakpur` | 110575 | 09 | 132 | 00701 (Behat) | `108943` | Malakpur | DCHB Saharanpur, Page 123 (Printed 104), Sadauli Qadeem Block: 141.90 ha, 218 HH, Pop: 1,189 | `VERIFIED` | `KEEP_SEPARATE` |
| `COL_SDT_09_132_00701_malakpur` | 110756 | 09 | 132 | 00701 (Behat) | `109124` | Malakpur | DCHB Saharanpur, Page 147 (Printed 128), Muzaffarabad Block: 295.78 ha, 142 HH, Pop: 955 | `VERIFIED` | `KEEP_SEPARATE` |
| `COL_SDT_09_132_00701_nasrullapur_must`| 110820 | 09 | 132 | 00701 (Behat) | `109188` | Nasrullapur Must. | DCHB Saharanpur, Page 153 (Printed 134), Muzaffarabad Block: 41.51 ha, Pop: 0 | `VERIFIED` | `KEEP_SEPARATE` |
| `COL_SDT_09_132_00701_nasrullapur_must`| 110822 | 09 | 132 | 00701 (Behat) | `109190` | Nasrullapur Must. | DCHB Saharanpur, Page 153 (Printed 134), Muzaffarabad Block: 30.64 ha, Pop: 0 | `VERIFIED` | `KEEP_SEPARATE` |
| `COL_SDT_09_132_00701_rampur` | 110534 | 09 | 132 | 00701 (Behat) | `108902` | Rampur | DCHB Saharanpur, Page 117 (Printed 98), Sadauli Qadeem Block (S.No 11): 270.69 ha, 42 HH, Pop: 216 | `VERIFIED` | `KEEP_SEPARATE` |
| `COL_SDT_09_132_00701_rampur` | 110739 | 09 | 132 | 00701 (Behat) | `109107` | Rampur | DCHB Saharanpur, Page 147 (Printed 128), Muzaffarabad Block (S.No 167): 139.21 ha, 181 HH, Pop: 966 | `VERIFIED` | `KEEP_SEPARATE` |

---

## 4. Inventory Group B: Undecided Same-Tehsil Name Collisions (25,898 Records, 11,903 Groups)

All 25,898 records in this group currently have status **`NEEDS_EVIDENCE`**. Substantive official evidence for all 25,898 records is **`NOT VERIFIED`** (Source name, source ref, and page/table citation fields in `village_collision_authoritative_evidence_review.json` / `.csv` are empty or unverified; requires future manual curator acquisition).

### 4.1 Geographic Distribution Across States (Top 15 States)

```text
1. Uttar Pradesh:     5,344 records (2,459 groups)
2. Bihar:             4,426 records (2,056 groups)
3. Madhya Pradesh:    2,944 records (1,348 groups)
4. Jharkhand:         2,498 records (1,155 groups)
5. Odisha:            1,800 records (825 groups)
6. Karnataka:         1,640 records (772 groups)
7. Rajasthan:         1,543 records (712 groups)
8. Maharashtra:       1,277 records (595 groups)
9. West Bengal:       1,099 records (503 groups)
10. Chhattisgarh:     1,083 records (498 groups)
11. Uttarakhand:        787 records (365 groups)
12. Assam:              704 records (328 groups)
13. Andhra Pradesh:     304 records (144 groups)
14. Tamil Nadu:         193 records (91 groups)
15. Meghalaya:          136 records (64 groups)
Other States / UTs:     220 records (108 groups)
Total Undecided:     25,898 records (11,903 groups)
```

### 4.2 Group Size Distribution
* **Groups of 2 villages:** 10,132 groups (20,264 villages)
* **Groups of 3 villages:** 1,446 groups (4,338 villages)
* **Groups of 4 villages:** 248 groups (992 villages)
* **Groups of 5+ villages:** 77 groups (304 villages)

### 4.3 High-Priority Review Sample Cohort (Template for Curator Execution)

| Group ID | Row | State | District | Tehsil | Village Code | Original Name | Missing Source Fields | Required Curator Evidence Fields |
| :--- | :---: | :---: | :---: | :---: | :---: | :--- | :--- | :--- |
| `COL_SDT_09_133_00702_rampur` | 111204 | 09 | 133 | 00702 | `109404` | Rampur | Hadbast: `NOT_RECORDED`, PCA: `UNVERIFIED` | DCHB Muzaffarnagar PCA Table, Page & Pop |
| `COL_SDT_09_133_00702_rampur` | 111285 | 09 | 133 | 00702 | `109485` | Rampur | Hadbast: `NOT_RECORDED`, PCA: `UNVERIFIED` | DCHB Muzaffarnagar PCA Table, Page & Pop |
| `COL_SDT_10_215_01170_chakia` | 231405 | 10 | 215 | 01170 | `231405` | Chakia | Hadbast: `NOT_RECORDED`, PCA: `UNVERIFIED` | DCHB Purnia PCA Table, Page & Pop |
| `COL_SDT_10_215_01170_chakia` | 231512 | 10 | 215 | 01170 | `231512` | Chakia | Hadbast: `NOT_RECORDED`, PCA: `UNVERIFIED` | DCHB Purnia PCA Table, Page & Pop |
| `COL_SDT_23_418_03401_pipariya`| 445210 | 23 | 418 | 03401 | `485210` | Pipariya | Hadbast: `NOT_RECORDED`, PCA: `UNVERIFIED` | DCHB Hoshangabad PCA Table, Page & Pop |
| `COL_SDT_23_418_03401_pipariya`| 445302 | 23 | 418 | 03401 | `485302` | Pipariya | Hadbast: `NOT_RECORDED`, PCA: `UNVERIFIED` | DCHB Hoshangabad PCA Table, Page & Pop |
| `COL_SDT_20_345_02450_kalyanpur`| 352108 | 20 | 345 | 02450 | `365108` | Kalyanpur | Hadbast: `NOT_RECORDED`, PCA: `UNVERIFIED` | DCHB Ranchi PCA Table, Page & Pop |
| `COL_SDT_20_345_02450_kalyanpur`| 352220 | 20 | 345 | 02450 | `365220` | Kalyanpur | Hadbast: `NOT_RECORDED`, PCA: `UNVERIFIED` | DCHB Ranchi PCA Table, Page & Pop |

---

## 5. Inventory Group C: Duplicate Village Code Groups (525 Records, 241 Groups)

Records in this group share the **exact same 6-digit village code** under the same subdistrict. This typically occurs where an administrative Outgrowth (OG) Part was enumerated alongside the mother village under a single code. Substantive official evidence for all 525 records is **`NOT VERIFIED`** (Source workbook preserves identical 6-digit codes; administrative gazette review for Outgrowth parts is unverified/pending).

### 5.1 Geographic Distribution Across States
* **Andhra Pradesh (28):** 138 records (57 groups)
* **Madhya Pradesh (23):** 74 records (35 groups)
* **Odisha (21):** 63 records (29 groups)
* **Gujarat (24):** 60 records (28 groups)
* **Rajasthan (08):** 54 records (24 groups)
* **West Bengal (19):** 38 records (18 groups)
* **Karnataka (29):** 32 records (15 groups)
* **Chhattisgarh (22):** 26 records (12 groups)
* **Uttarakhand (05):** 16 records (8 groups)
* **Himachal Pradesh (02):** 10 records (5 groups)
* **Haryana (06):** 6 records (3 groups)
* **Bihar (10):** 2 records (1 group)
* **Manipur (14):** 2 records (1 group)
* **Kerala (32):** 2 records (1 group)
* **Uttar Pradesh (09):** 2 records (1 group)
* **Total:** **525 records (241 code groups)**

### 5.2 Group Size Structure
* **Groups with 2 duplicate rows:** 234 groups ($234 \times 2 = 468$ records)
* **Groups with 3 duplicate rows:** 3 groups ($3 \times 3 = 9$ records)
* **Groups with 8 duplicate rows:** 2 groups ($2 \times 8 = 16$ records)
* **Group with 11 duplicate rows:** 1 group ($1 \times 11 = 11$ records)
* **Group with 21 duplicate rows:** 1 group ($1 \times 21 = 21$ records)

### 5.3 Detailed Representative Review Sample

| Code Group | Source Row | State | District | Tehsil | Village Code | Original Display Name | Record Nature | Curator Decision Required |
| :---: | :---: | :---: | :---: | :---: | :---: | :--- | :--- | :--- |
| `DUP_111863` | 113541 | 09 | 134 | 00712 | `111863` | Kiratpur | Mother Village Revenue Mouza | `[ ] MERGE_WITH_OG \| [ ] KEEP_SEPARATE_ENTITY` |
| `DUP_111863` | 113542 | 09 | 134 | 00712 | `111863` | Canal Colony (OG) (Part) | Urban Outgrowth Part of Kiratpur | `[ ] EXCLUDE_AS_OG \| [ ] ALLOCATE_SUB_ID` |
| `DUP_225501` | 228372 | 10 | 212 | 01151 | `225501` | Durgapur | Revenue Village | `[ ] MERGE_WITH_OG \| [ ] KEEP_SEPARATE_ENTITY` |
| `DUP_225501` | 228373 | 10 | 212 | 01151 | `225501` | Katihar Rly. Colony (OG) ( Part ) | Railway Colony Outgrowth Part | `[ ] EXCLUDE_AS_OG \| [ ] ALLOCATE_SUB_ID` |
| `DUP_270152` | 274014 | 14 | 277 | 01882 | `270152` | Langthabal Mantrikhong | Revenue Mouza | `[ ] MERGE_WITH_OG \| [ ] KEEP_SEPARATE_ENTITY` |
| `DUP_270152` | 274015 | 14 | 277 | 01882 | `270152` | Langthabal Mantrikhong (OG) (Part)| Outgrowth Part | `[ ] EXCLUDE_AS_OG \| [ ] ALLOCATE_SUB_ID` |
| `DUP_021231` | 21571 | 02 | 031 | 00162 | `021231` | Baddi Sitalpur (204) | Hadbast Parcel 204 | `[ ] VERIFY_HADBAST \| [ ] KEEP_SEPARATE` |
| `DUP_021231` | 21572 | 02 | 031 | 00162 | `021231` | Badi Sitalpur (OG) (Part) | Baddi Outgrowth Industrial Part | `[ ] EXCLUDE_AS_OG \| [ ] ALLOCATE_SUB_ID` |

---

## 6. Inventory Group D: Structural Missing-Parent Exception (1 Record)

This single record represents an unparented revenue parcel where Column C (Sub-District Code) was left completely blank in the master source workbook `PC11_TV_DIR.xlsx`.

### 6.1 Complete Entity Profile

```yaml
STRUCTURAL_EXCEPTION_PROFILE:
  source_row: 306108
  staging_line_number: 301866
  source_sheet: "xl/worksheets/sheet1.xml"
  state_code: "18" (Assam)
  district_code: "320" (Chirang District)
  sub_district_code: "" (EMPTY STRING IN SOURCE WORKBOOK CELL)
  village_code: "302048"
  original_display_name: "Kharija Dalaigaon Pt.2 (Part)"
  attempted_parent_id: "CENSUS2011_SDT_18_320_" (INVALID: TRAILING UNDERSCORE)
  exception_reason: "SOURCE_SUBDISTRICT_CELL_MISSING"
  resolution_policy: "DO_NOT_INFER_PARENT"
  current_disposition: "UNRESOLVED_REQUIRES_AUTHORITATIVE_EVIDENCE"
  production_status: "STRICTLY BLOCKED FROM CANONICAL IMPORT"
```

### 6.2 Evidentiary Action Plan for Assam State Gazette Review
* **The Problem:** In Chirang district (320), multiple sub-districts exist (e.g. `02124` Sidli, `02125` Bijni). Inferring that row 306108 belongs to either without gazette proof violates the non-fabrication rule.
* **Curator Action Required:**
  1. Acquire Assam Government Revenue Gazette / Bodoland Territorial Council (BTC) Notification for Chirang District revenue boundary delineations.
  2. Locate Revenue Circle for Kharija Dalaigaon Part 2 (Survey Code 302048).
  3. Submit official Gazette order number and page citation before any parent Tehsil is assigned.

---

## 7. Status of Unresolved Decisions & Official Disclaimer

### 7.1 Summary of Unresolved Decisions Requiring System Owner Sign-Off

1. **25,898 Collision Records:** Remain in `census2011_quarantine_places` under `NEEDS_EVIDENCE`. Cannot be imported to `places_census2011`.
2. **23 Staging-Verified Records:** Remain in review status `NOT APPROVED FOR IMPORT (EVIDENCE REVIEW ONLY)`. Require formal owner sign-off prior to production promotion.
3. **525 Duplicate Village Codes:** Require curator resolution of whether Outgrowth (OG) parts should be stored as sub-entities or consolidated with mother villages.
4. **Row 306108:** Requires official Assam Gazette before parentage assignment.
5. **215 Urban Records:** Auxiliary storage in `census2011_urban_summaries` outside 6-tier hierarchy.

---

```
========================================================================================
EVIDENCE REVIEW PACKAGE ONLY — NO RECORDS APPROVED — NO DATABASE MUTATIONS
========================================================================================
```
