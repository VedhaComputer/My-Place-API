# Census 2011 Village Collision Review Recommendations Summary

## 1. Overview & Core Metrics
- **Total Collision Groups Evaluated:** 11,914
- **Total Affected Records Evaluated:** 25,921
- **Output CSV File:** `reports/village_collision_review_recommendations.csv` (25922 lines)
- **Output JSON File:** `reports/village_collision_review_recommendations.json`

---

## 2. Recommendation Breakdown

| Recommendation Status | Proposed Count | Percentage | Rationale |
| :--- | :---: | :---: | :--- |
| **PROPOSED KEEP** | **0** | **0.0%** | Prohibited from arbitrarily retaining one record without corroborating demographic or spatial evidence. |
| **PROPOSED REMOVE_DUPLICATE** | **0** | **0.0%** | Prohibited from discarding any record based solely on identical name and Census code. |
| **PROPOSED NEEDS_EVIDENCE** | **25,921** | **100.0%** | Every single record possesses a distinct 6-digit Census code in `PC11_TV_DIR.xlsx` and requires external authoritative verification. |

---

## 3. Evidence Limitations in Source Workbook

1. **Column Scope:** The master Census workbook (`PC11_TV_DIR.xlsx`) contains only 5 fields:
   - Column A: State Code
   - Column B: District Code
   - Column C: Sub District Code
   - Column D: Town-Village Code
   - Column E: Town-Village Name
2. **Distinct Official Codes:** In all 11,914 collision groups, **100% of the colliding records have distinct 6-digit Census codes** (e.g. `000026` vs `000084`).
3. **Absence of Ground Truth Attributes:** The workbook contains **zero population figures**, **zero household counts**, **zero geographic coordinates**, and **zero Hadbast numbers**.
4. **Administrative Reality:** In Indian revenue administration:
   - Multiple revenue hamlets/mouzas within the same Tehsil legitimately share identical names (e.g. multiple "Rampur" or "Dard Pora").
   - Multiple forest beats or compartments within the same Tehsil share range names (e.g. "Mukhem Range", "Kunara (Kanda)").
   - Canal colonies in Rajasthan share chak numbers (e.g. "1 B" vs "1 b").
5. **Conclusion:** Master source workbook evidence alone cannot establish whether any of the 25,921 records is an accidental clerical duplicate. Authoritative disambiguation requires external ground truth (District Census Handbooks - DCHB, Hadbast registers, or PCA population tables).

---

## 4. Certification of Non-Mutation
- **Records Deleted:** 0
- **Records Merged:** 0
- **Records Renamed:** 0
- **Records Reparented:** 0
- **Records Imported to Database:** 0
- **Production Status:** `NOT APPROVED FOR IMPORT (REVIEW RECOMMENDATIONS ONLY)`
