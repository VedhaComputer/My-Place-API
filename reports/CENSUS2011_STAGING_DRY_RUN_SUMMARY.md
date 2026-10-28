# Census 2011 Staging Dry-Run Validation Summary

**Execution Timestamp:** `2026-10-16T08:54:29.079Z`  
**Validator Version:** `1.1.0-RECONCILED`  
**Scope:** Read-Only Validation of `data/staging/census2011/`  

---

## 1. Executive Status & Verdict

| Validation Dimension | Result | Key Operational Meaning |
| :--- | :---: | :--- |
| **Structural & Referential Hierarchy** | **`FAIL`** | Found 1 staged entity with a dangling parent reference due to an empty subdistrict code in source row 306108. |
| **Parent-Scoped Name Uniqueness** | **`BLOCKED`** | 11,914 same-Tehsil village collision groups (25,921 records) require quarantine/curator review before ingestion. |
| **Production Ingestion Authorization** | **`NOT APPROVED`** | Validation only. Zero database connections made; zero persistent mutations authorized. |

> [!IMPORTANT]
> **Persistent ID Policy Notice:** All entity keys used during this dry-run are temporary in-memory validation references. The validator does not issue or finalize permanent IDs. Permanent ID allocation requires a separate approved architectural design.

---

## 2. Complete Row Accounting Reconciliation

$$\begin{aligned}
\text{Total Master Source Rows} &= 6,57,010 \\
\text{Header Rows} &= 1 \\
\text{Data Rows} &= 6,57,009 \\
\hline
\text{Source-Derived Hierarchy Entities} &= 6,56,779 \\
\text{Embedded Subdistrict Alias Rows} &= 15 \\
\text{Unresolved Urban Summary Rows} &= 215 \\
\hline
\mathbf{\text{Total Accounted Source Rows}} &= \mathbf{6,57,010} \quad (\text{100\% Consistent: } VERIFIED)
\end{aligned}$$

* **Canonical Staged Hierarchy Entities:** 6,56,780 entities (6,56,779 source-derived + 1 synthetic Country root).

---

## 3. Hierarchy Tiers & Referential Integrity

| Level | Staged Entities | Valid Parent | Invalid Parent | Parent-Scoped Duplicates | Cross-Parent Same-Name Occurrences |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **`COUNTRY`** | 1 | 1 (Root null) | 0 | 0 | 0 |
| **`STATE_UT`** | 35 | 35 | 0 | 0 | 0 |
| **`DISTRICT`** | 640 | 640 | 0 | **0** | **6 Multi-State Names** (Allowed) |
| **`TEHSIL`** | 5960 | 5,960 | 0 | **0** | **222 Multi-District Names** (Allowed) |
| **`CITY_TOWN`** | 4268 | 4,268 | 0 | **0** | Allowed under different Tehsils |
| **`VILLAGE`** | 6,45,876 | 6,45,875 | 1 | **11,914 Groups (25,921 Records)** | Allowed under different Tehsils |

### Dangling Parent Investigation (Source Row 306108)
- **Entity:** `Kharija Dalaigaon Pt.2 (Part)` (ID: `CENSUS2011_VIL_18_320__302048`, Code: `302048`)
- **Attempted Parent:** `CENSUS2011_SDT_18_320_`
- **Raw XML Evidence:** In `xl/worksheets/sheet1.xml`, row 306108 contains cells A306108, B306108, D306108, and E306108. **Cell C306108 is absent from the XML.**
- **Transformation Trace:** `transform_census_staging.py` assigned empty string to `sdt` (`vals.get('C', '')`). The unresolved urban filter did not check for empty string, so the script constructed parent ID `CENSUS2011_SDT_18_320_` with a trailing underscore.
- **Handling:** Retained as unresolved. No parent is inferred or invented.

---

## 4. Village Collision Classification & Reconciliation

### 4.1 Disjoint Collision Categories (Zero Double-Counting)

| Category | Description | Collision Groups | Affected Records |
| :--- | :--- | :---: | :---: |
| **Category A: Pure Identical Raw Display Names** | Records with exact byte-for-byte identical raw names within the same Tehsil | **11,847** | **25,763** |
| **Category B: Pure Normalization-Only Collisions** | Records where every raw name is distinct, colliding only after Unicode NFC, whitespace collapsing, and lowercase | **62** | **124** |
| **Category C: Mixed / Overlap Groups** | Groups containing identical raw pairs PLUS casing/whitespace variant records | **5** | **34** |
| **Total Collision Scope** | **Exhaustive disjoint partition (A + B + C)** | **11,914** | **25,921** |

### 4.2 Reconciliation Against Earlier Audit Discrepancy

$$egin{aligned}
	ext{Earlier Audit (Simple } 	exttt{lower().strip()} 	ext{)} &= mathbf{11,902 	ext{ groups}} quad (mathbf{25,895 	ext{ records}}) \
	ext{Newly Formed Collision Groups (Whitespace/NFC Collisions)} &= +12 	ext{ groups} quad (+24 	ext{ records}) \
	ext{Records Absorbed into Existing Collision Groups} &= +0 	ext{ groups} quad (+2 	ext{ records}) \
hline
mathbf{	ext{Latest Validator (Full Normalization)}} &= mathbf{11,914 	ext{ groups}} quad (mathbf{25,921 	ext{ records}})
end{aligned}$$

#### The 14 Bridging Groups Explaining the Exact Discrepancy:
* **12 Newly Formed Groups (24 records):**
  1. `CENSUS2011_SDT_09_188_00952:::chawaria khurd` (Rows 188935, 188941)
  2. `CENSUS2011_SDT_10_216_01213:::damodarpur dumri` (Rows 232460, 232462)
  3. `CENSUS2011_SDT_10_218_01242:::khap punak buzurg` (Rows 235347, 235350)
  4. `CENSUS2011_SDT_10_220_01278:::imadpur sultan` (Rows 238753, 238763)
  5. `CENSUS2011_SDT_10_225_01355:::gorgawan arazi` (Rows 245524, 245525)
  6. `CENSUS2011_SDT_10_230_01414:::salimpur milik` (Rows 249559, 249560)
  7. `CENSUS2011_SDT_18_300_02001:::panbari f.v.` (Rows 283924, 283950)
  8. `CENSUS2011_SDT_20_350_02549:::sirsia chhit` (Rows 359406, 359420)
  9. `CENSUS2011_SDT_20_351_02555:::dukhari kita` (Rows 360666, 360669)
  10. `CENSUS2011_SDT_20_351_02556:::chanda and chando` (Rows 360923, 360926)
  11. `CENSUS2011_SDT_21_390_03119:::sikebari jangala` (Rows 422454, 422455)
  12. `CENSUS2011_SDT_33_606_05726:::royandapuram rf` (Rows 642630, 642633)
* **2 Expanded Collision Groups (+2 records):**
  1. `CENSUS2011_SDT_18_314_02091:::sarthe rongpi` (Expanded from 5 to 6 records; absorbed row 302277 with double space)
  2. `CENSUS2011_SDT_33_606_05725:::pinjur rf` (Expanded from 2 to 3 records; absorbed row 642553 with single space)

---

## 5. Unparented Urban Records (Outside Canonical Hierarchy)

* **Total Unresolved Urban Records:** 215
  - **Metropolitan Summaries (`sdt=00000` / `dt=000`):** 53 records
  - **Direct-District Municipal Escape Rows (`sdt=99999`):** 162 records
* **Referential Integrity:** 100% have `parentId: null`. Zero synthetic or fabricated parents exist.

---

## 6. Input File Integrity & Verification Hashes

All 10 source and staging files were verified via SHA-256 before and after validation with zero mutations:

| File | Size (Bytes) | SHA-256 Checksum | Immutability Status |
| :--- | :---: | :--- | :---: |
| `PC11_TV_DIR.xlsx` | 2,33,18,601 | `e5670123e836148cd4a869805333b519f45ce837d1145c8b5cece3a01dbf7dd0` | **UNCHANGED** |
| `country.json` | 213 | `2bd623efacbe6d44cd7b0e8538872f942fd731f258980d6155b087beba095292` | **UNCHANGED** |
| `states.json` | 8,198 | `a93adc59da03c27d14d01acd56b73203200fd2a2010041cf75068111fa05ccef` | **UNCHANGED** |
| `districts.json` | 1,69,539 | `499bba6109b700e876d2280a7524ce068b466c70dfa2fb60fb1e3ad56e0e38ac` | **UNCHANGED** |
| `tehsils.json` | 19,51,175 | `e2f9bd2c7d89d993739d22c21669757fc9dfb9894a6f25a3e6964122df59564c` | **UNCHANGED** |
| `towns.json` | 15,79,757 | `9979b7fc8a66c1a411201edba1071509b88a659522b6a64187984ad64d44cea1` | **UNCHANGED** |
| `villages.jsonl` | 18,86,38,837 | `831c7eb4dca47e2ce0a339a1dc3a7d6a560b785465b3b120698f8497e8ec0d00` | **UNCHANGED** |
| `unresolved_hierarchy_records.json` | 89,210 | `59bb3b2a1ba7bf0151dc81de9482486868727269dcdf8bd38c8ca6616f3538fb` | **UNCHANGED** |
| `duplicate_code_candidates.json` | 2,50,292 | `0124ee47b6835a83402e0052e605e84a9916388b04bd2b66bbb9929194353ee9` | **UNCHANGED** |
| `validation_summary.json` | 1,809 | `1ccdfd3a3e572282e771deac77696c6dd51532cff07a1d21dc6788d15dd1ec52` | **UNCHANGED** |

---

## 7. Blocking Reasons

1. Referential integrity violation: Found 1 staged entity with an invalid or dangling parent reference (Sample: Kharija Dalaigaon Pt.2 (Part) at source row 306108).
2. Parent-scoped duplicate name collision: 11,914 collision groups encompassing 25,921 villages share identical names under the same Tehsil. Under the parent-scoped uniqueness policy, these records are blocked from direct uncurated ingestion and require quarantine/review.
3. Normalization collisions: 67 collision groups contain records with differing raw whitespace/casing that collapse to the same canonicalNameLower. These require curator review and cannot be silently merged.
