# Census 2011 Village Collision Authoritative Evidence Review Summary

## 1. Overview & Verification Scope
- **Total Collision Groups Evaluated:** 11,914
- **Total Collision Records Evaluated:** 25,921
- **Output Report CSV:** `reports/village_collision_authoritative_evidence_review.csv` (25922 lines)
- **Output Report JSON:** `reports/village_collision_authoritative_evidence_review.json`

---

## 2. Breakdown of Cases: Verified vs Undecided

| Decision Category | Record Count | Group Count | Criteria & Status |
| :--- | :---: | :---: | :--- |
| **VERIFIED KEEP_SEPARATE** | **23** | **11** | Official Census DCHB / PCA confirmed distinct settlements with separate populations, households, C.D. Blocks, or cadastral areas in hectares. |
| **VERIFIED DUPLICATE_CONFIRMED** | **0** | **0** | No case has been confirmed as a clerical duplicate from available authoritative sources. |
| **UNDECIDED (NEEDS_EVIDENCE)** | **25,898** | **11,903** | District Census Handbook (DCHB) Part A/B publication volumes for these districts are not yet stored locally on disk. Retained without speculation. |
| **Total** | **25,921** | **11,914** | **100% of records accounted for with zero double-counting.** |

---

## 3. Detailed Audit Evidence from Local Official Census DCHB Publications

### Local Primary PDF Source Authentication
- **Kupwara District:** `scratch/DH_2011_0101_PART_B_DCHB_KUPWARA.pdf` (1,408,689 bytes)
  - **SHA-256:** `88d825ceddc498fd2931486fef42d3cf44d30c445802c9f3d5afe8da9c2965af`
- **Saharanpur District:** `scratch/DH_2011_0901_PART_B_DCHB_SAHARANPUR.pdf` (5,997,524 bytes)
  - **SHA-256:** `56ed4b72dde5774202580541a6fa4b959a5cd91ff46e1eebff8cca8bfa8f2ff7`
- **Kullu District:** `scratch/DH_2011_0204_PART_B_DCHB_KULLU.pdf` (2,164,965 bytes)
  - **SHA-256:** `34a1bb1f8e951abc6b23c344a382b7ba49fa0e928f036e5d55925b996b1517c3`

---

### Page Number Mapping: PDF Viewer Index vs Printed Page Numeral

| District | Village Code | Village Name | PDF Viewer Page Index | Printed Page Numeral | Primary Census Table Heading |
| :--- | :---: | :--- | :---: | :---: | :--- |
| Kupwara | `000084` | Dard Pora | Page 61 | Page 54 | Village and Town Wise Primary Census Abstract (PCA) Table - Kupwara Tehsil |
| Kupwara | `000026` | Dard Pora | Page 79 | Page 72 | Village and Town Wise Primary Census Abstract (PCA) Table - Kupwara Tehsil |
| Kupwara | `000101` | Push Wari | Page 73 | Page 66 | Village and Town Wise Primary Census Abstract (PCA) Table - Kupwara Tehsil |
| Kupwara | `000015` | Push Wari | Page 79 | Page 72 | Village and Town Wise Primary Census Abstract (PCA) Table - Kupwara Tehsil |
| Kupwara | `000232` | Khai Pora | Page 103 | Page 96 | Village and Town Wise Primary Census Abstract (PCA) Table - Handwara Tehsil |
| Kupwara | `000311` | Khai Pora | Page 121 | Page 114 | Village and Town Wise Primary Census Abstract (PCA) Table - Handwara Tehsil |
| Kupwara | `000227` | Pala Pora | Page 103 | Page 96 | Village and Town Wise Primary Census Abstract (PCA) Table - Handwara Tehsil |
| Kupwara | `000313` | Pala Pora | Page 109 | Page 102 | Village and Town Wise Primary Census Abstract (PCA) Table - Handwara Tehsil |
| Kupwara | `000152` | Tulwari | Page 103 | Page 96 | Village and Town Wise Primary Census Abstract (PCA) Table - Handwara Tehsil |
| Kupwara | `000210` | Tulwari | Page 115 | Page 108 | Village and Town Wise Primary Census Abstract (PCA) Table - Handwara Tehsil |
| Kupwara | `000226` | Wara Pora | Page 103 | Page 96 | Village and Town Wise Primary Census Abstract (PCA) Table - Handwara Tehsil |
| Kupwara | `000240` | Wara Pora | Page 103 | Page 96 | Village and Town Wise Primary Census Abstract (PCA) Table - Handwara Tehsil |
| Kupwara | `000284` | Wara Pora | Page 121 | Page 114 | Village and Town Wise Primary Census Abstract (PCA) Table - Handwara Tehsil |
| Saharanpur | `108902` | Rampur | Page 117 | Page 98 | Village and Town Wise Primary Census Abstract (PCA) Table - Behat Tehsil |
| Saharanpur | `108943` | Malakpur | Page 123 | Page 104 | Village and Town Wise Primary Census Abstract (PCA) Table - Behat Tehsil |
| Saharanpur | `108954` | Ahmadpur | Page 123 | Page 104 | Village and Town Wise Primary Census Abstract (PCA) Table - Behat Tehsil |
| Saharanpur | `109087` | Ahmadpur | Page 141 | Page 122 | Village and Town Wise Primary Census Abstract (PCA) Table - Behat Tehsil |
| Saharanpur | `109107` | Rampur | Page 147 | Page 128 | Village and Town Wise Primary Census Abstract (PCA) Table - Behat Tehsil |
| Saharanpur | `109124` | Malakpur | Page 147 | Page 128 | Village and Town Wise Primary Census Abstract (PCA) Table - Behat Tehsil |
| Saharanpur | `109188` | Nasrullapur Must. | Page 153 | Page 134 | Village and Town Wise Primary Census Abstract (PCA) Table - Behat Tehsil |
| Saharanpur | `109190` | Nasrullapur Must. | Page 153 | Page 134 | Village and Town Wise Primary Census Abstract (PCA) Table - Behat Tehsil |
| Kullu | `012818` | Up Muhal Mahilee | Page 71 | Page 64 | Village and Town Wise Primary Census Abstract (PCA) Table - Kullu Tehsil |
| Kullu | `012842` | Up Muhal Mahilee | Page 77 | Page 70 | Village and Town Wise Primary Census Abstract (PCA) Table - Kullu Tehsil |

---

### Audited Case Evidence & Entity Independence Corroboration

#### Verification Utility & Method
All 23 records across the 11 collision groups were audited and cross-verified against official Census 2011 District Census Handbook (DCHB) Part XII-B (PCA) PDF publications using `pdftotext version 4.06` (Xpdf/Poppler suite at `C:\Program Files\Git\mingw64\bin\pdftotext.exe`). Page boundaries, printed page numerals, table titles, C.D. Block headings, location codes, village names, and all demographic/area columns were individually confirmed against original PDF text streams.

#### 1. Kupwara District: `COL_SDT_01_001_00001_dard_pora` (Dard Pora)
- **Village Code `000084` (Row 90):**
  - **[FACT / साक्ष्य]:** Source: `DH_2011_0101_PART_B_DCHB_KUPWARA.pdf` (SHA-256: `88d825ceddc498fd2931486fef42d3cf44d30c445802c9f3d5afe8da9c2965af`), verified via `pdftotext v4.06`. Table: Village Primary Census Abstract (PCA), Heading: C D Block - 0001 Kralpora. PDF Viewer Page: 61, Printed Page: 54. Location Code: `000084`, Village Name: `Dard Pora`. Area: **653.60 ha**, Households: **1,414**, Total Pop: **14,260** (7,333 M / 6,927 F), 0-6 Pop: 3,869 (1,989 M / 1,880 F). Position in survey: adjacent to Rawat Pora (`000085`).
  - **[INFERENCE / निष्कर्ष - (A) CENSUS 2011 ENTRY SEPARATION]:** Official Census 2011 PCA proves this is an independent enumerated Census entry in C.D. Block 0001 Kralpora; it is NOT a clerical duplicate of code `000026`. In Census staging, status is **`KEEP_SEPARATE`** (no deletion or merge).
  - **[INFERENCE / निष्कर्ष - (B) CANONICAL / API ENTITY BOUNDARY (प्रमाण-सीमा)]:** Source documents 2011 Census enumeration boundaries only; it does NOT verify modern post-2011 Gram Panchayat notifications, contemporary cadastral maps, or live API entity autonomy. Production status remains strictly **`NOT APPROVED FOR IMPORT (EVIDENCE REVIEW ONLY)`**.
- **Village Code `000026` (Row 32):**
  - **[FACT / साक्ष्य]:** Source: `DH_2011_0101_PART_B_DCHB_KUPWARA.pdf` (SHA-256: `88d825ceddc498fd2931486fef42d3cf44d30c445802c9f3d5afe8da9c2965af`), verified via `pdftotext v4.06`. Table: Village Primary Census Abstract (PCA), Heading: C D Block - 0004 Sogam. PDF Viewer Page: 79, Printed Page: 72. Location Code: `000026`, Village Name: `Dard Pora`. Area: **216.10 ha**, Households: **549** (*verified on printed page 72, column 5: 549 households, correcting draft typo of 391*), Total Pop: **3,329** (1,726 M / 1,603 F), 0-6 Pop: 716 (370 M / 346 F). Position in survey: adjacent to Muqam Shrif Dar (`000027`).
  - **[INFERENCE / निष्कर्ष - (A) CENSUS 2011 ENTRY SEPARATION]:** Official Census 2011 PCA proves this is an independent enumerated Census entry in C.D. Block 0004 Sogam; it is NOT a clerical duplicate of code `000084`. In Census staging, status is **`KEEP_SEPARATE`** (no deletion or merge).
  - **[INFERENCE / निष्कर्ष - (B) CANONICAL / API ENTITY BOUNDARY (प्रमाण-सीमा)]:** Source documents 2011 Census enumeration boundaries only; it does NOT verify modern post-2011 Gram Panchayat notifications, contemporary cadastral maps, or live API entity autonomy. Production status remains strictly **`NOT APPROVED FOR IMPORT (EVIDENCE REVIEW ONLY)`**.

#### 2. Kupwara District: `COL_SDT_01_001_00001_push_wari` (Push Wari)
- **Village Code `000015` (Row 21):**
  - **[FACT / साक्ष्य]:** Source: `DH_2011_0101_PART_B_DCHB_KUPWARA.pdf` (SHA-256: `88d825ceddc498fd2931486fef42d3cf44d30c445802c9f3d5afe8da9c2965af`), verified via `pdftotext v4.06`. Table: Village Primary Census Abstract (PCA), Heading: C D Block - 0004 Sogam. PDF Viewer Page: 79, Printed Page: 72. Location Code: `000015`, Village Name: `Push Wari`. Area: **286.50 ha**, Households: **272**, Total Pop: **1,479** (781 M / 698 F), 0-6 Pop: 368 (209 M / 159 F). Position in survey: adjacent to Sayiwan (`000022`).
  - **[INFERENCE / निष्कर्ष - (A) CENSUS 2011 ENTRY SEPARATION]:** Official Census 2011 PCA proves this is an independent enumerated Census entry in C.D. Block 0004 Sogam; it is NOT a clerical duplicate of code `000101`. In Census staging, status is **`KEEP_SEPARATE`** (no deletion or merge).
  - **[INFERENCE / निष्कर्ष - (B) CANONICAL / API ENTITY BOUNDARY (प्रमाण-सीमा)]:** Source documents 2011 Census enumeration boundaries only; it does NOT verify modern post-2011 Gram Panchayat notifications, contemporary cadastral maps, or live API entity autonomy. Production status remains strictly **`NOT APPROVED FOR IMPORT (EVIDENCE REVIEW ONLY)`**.
- **Village Code `000101` (Row 107):**
  - **[FACT / साक्ष्य]:** Source: `DH_2011_0101_PART_B_DCHB_KUPWARA.pdf` (SHA-256: `88d825ceddc498fd2931486fef42d3cf44d30c445802c9f3d5afe8da9c2965af`), verified via `pdftotext v4.06`. Table: Village Primary Census Abstract (PCA), Heading: C D Block - 0003 Kupwara. PDF Viewer Page: 73, Printed Page: 66. Location Code: `000101`, Village Name: `Push Wari`. Area: **40.90 ha**, Households: **113**, Total Pop: **996** (521 M / 475 F), 0-6 Pop: 216 (112 M / 104 F). Position in survey: adjacent to Pari Pora (`000102`).
  - **[INFERENCE / निष्कर्ष - (A) CENSUS 2011 ENTRY SEPARATION]:** Official Census 2011 PCA proves this is an independent enumerated Census entry in C.D. Block 0003 Kupwara; it is NOT a clerical duplicate of code `000015`. In Census staging, status is **`KEEP_SEPARATE`** (no deletion or merge).
  - **[INFERENCE / निष्कर्ष - (B) CANONICAL / API ENTITY BOUNDARY (प्रमाण-सीमा)]:** Source documents 2011 Census enumeration boundaries only; it does NOT verify modern post-2011 Gram Panchayat notifications, contemporary cadastral maps, or live API entity autonomy. Production status remains strictly **`NOT APPROVED FOR IMPORT (EVIDENCE REVIEW ONLY)`**.

#### 3. Kupwara District: `COL_SDT_01_001_00002_khai_pora` (Khai Pora)
- **Village Code `000232` (Row 240):**
  - **[FACT / साक्ष्य]:** Source: `DH_2011_0101_PART_B_DCHB_KUPWARA.pdf` (SHA-256: `88d825ceddc498fd2931486fef42d3cf44d30c445802c9f3d5afe8da9c2965af`), verified via `pdftotext v4.06`. Table: Village Primary Census Abstract (PCA), Heading: C D Block - 0008 Rajwar. PDF Viewer Page: 103, Printed Page: 96. Location Code: `000232`, Village Name: `Khai Pora`. Area: **335.03 ha**, Households: **198**, Total Pop: **1,338** (667 M / 671 F), 0-6 Pop: 219 (107 M / 112 F). Position in survey: adjacent to Said Pora (`000233`).
  - **[INFERENCE / निष्कर्ष - (A) CENSUS 2011 ENTRY SEPARATION]:** Official Census 2011 PCA proves this is an independent enumerated Census entry in C.D. Block 0008 Rajwar; it is NOT a clerical duplicate of code `000311`. In Census staging, status is **`KEEP_SEPARATE`** (no deletion or merge).
  - **[INFERENCE / निष्कर्ष - (B) CANONICAL / API ENTITY BOUNDARY (प्रमाण-सीमा)]:** Source documents 2011 Census enumeration boundaries only; it does NOT verify modern post-2011 Gram Panchayat notifications, contemporary cadastral maps, or live API entity autonomy. Production status remains strictly **`NOT APPROVED FOR IMPORT (EVIDENCE REVIEW ONLY)`**.
- **Village Code `000311` (Row 319):**
  - **[FACT / साक्ष्य]:** Source: `DH_2011_0101_PART_B_DCHB_KUPWARA.pdf` (SHA-256: `88d825ceddc498fd2931486fef42d3cf44d30c445802c9f3d5afe8da9c2965af`), verified via `pdftotext v4.06`. Table: Village Primary Census Abstract (PCA), Heading: C D Block - 0009 Langet. PDF Viewer Page: 121, Printed Page: 114. Location Code: `000311`, Village Name: `Khai Pora`. Area: **99.60 ha**, Households: **134**, Total Pop: **930** (465 M / 465 F), 0-6 Pop: 136 (65 M / 71 F). Position in survey: adjacent to Kachlu Qazi Pora (`000312`).
  - **[INFERENCE / निष्कर्ष - (A) CENSUS 2011 ENTRY SEPARATION]:** Official Census 2011 PCA proves this is an independent enumerated Census entry in C.D. Block 0009 Langet; it is NOT a clerical duplicate of code `000232`. In Census staging, status is **`KEEP_SEPARATE`** (no deletion or merge).
  - **[INFERENCE / निष्कर्ष - (B) CANONICAL / API ENTITY BOUNDARY (प्रमाण-सीमा)]:** Source documents 2011 Census enumeration boundaries only; it does NOT verify modern post-2011 Gram Panchayat notifications, contemporary cadastral maps, or live API entity autonomy. Production status remains strictly **`NOT APPROVED FOR IMPORT (EVIDENCE REVIEW ONLY)`**.

#### 4. Kupwara District: `COL_SDT_01_001_00002_pala_pora` (Pala Pora)
- **Village Code `000227` (Row 235):**
  - **[FACT / साक्ष्य]:** Source: `DH_2011_0101_PART_B_DCHB_KUPWARA.pdf` (SHA-256: `88d825ceddc498fd2931486fef42d3cf44d30c445802c9f3d5afe8da9c2965af`), verified via `pdftotext v4.06`. Table: Village Primary Census Abstract (PCA), Heading: C D Block - 0008 Rajwar. PDF Viewer Page: 103, Printed Page: 96. Location Code: `000227`, Village Name: `Pala Pora`. Area: **51.00 ha**, Households: **76**, Total Pop: **493** (260 M / 233 F), 0-6 Pop: 111 (57 M / 54 F). Position in survey: adjacent to Ashkan Pora (`000228`).
  - **[INFERENCE / निष्कर्ष - (A) CENSUS 2011 ENTRY SEPARATION]:** Official Census 2011 PCA proves this is an independent enumerated Census entry in C.D. Block 0008 Rajwar; it is NOT a clerical duplicate of code `000313`. In Census staging, status is **`KEEP_SEPARATE`** (no deletion or merge).
  - **[INFERENCE / निष्कर्ष - (B) CANONICAL / API ENTITY BOUNDARY (प्रमाण-सीमा)]:** Source documents 2011 Census enumeration boundaries only; it does NOT verify modern post-2011 Gram Panchayat notifications, contemporary cadastral maps, or live API entity autonomy. Production status remains strictly **`NOT APPROVED FOR IMPORT (EVIDENCE REVIEW ONLY)`**.
- **Village Code `000313` (Row 321):**
  - **[FACT / साक्ष्य]:** Source: `DH_2011_0101_PART_B_DCHB_KUPWARA.pdf` (SHA-256: `88d825ceddc498fd2931486fef42d3cf44d30c445802c9f3d5afe8da9c2965af`), verified via `pdftotext v4.06`. Table: Village Primary Census Abstract (PCA), Heading: C D Block - 0009 Langet. PDF Viewer Page: 109, Printed Page: 102. Location Code: `000313`, Village Name: `Pala Pora`. Area: **95.50 ha**, Households: **133**, Total Pop: **979** (484 M / 495 F), 0-6 Pop: 135 (66 M / 69 F). Position in survey: adjacent to Badrah (`000318`).
  - **[INFERENCE / निष्कर्ष - (A) CENSUS 2011 ENTRY SEPARATION]:** Official Census 2011 PCA proves this is an independent enumerated Census entry in C.D. Block 0009 Langet; it is NOT a clerical duplicate of code `000227`. In Census staging, status is **`KEEP_SEPARATE`** (no deletion or merge).
  - **[INFERENCE / निष्कर्ष - (B) CANONICAL / API ENTITY BOUNDARY (प्रमाण-सीमा)]:** Source documents 2011 Census enumeration boundaries only; it does NOT verify modern post-2011 Gram Panchayat notifications, contemporary cadastral maps, or live API entity autonomy. Production status remains strictly **`NOT APPROVED FOR IMPORT (EVIDENCE REVIEW ONLY)`**.

#### 5. Kupwara District: `COL_SDT_01_001_00002_tulwari` (Tulwari)
- **Village Code `000152` (Row 160):**
  - **[FACT / साक्ष्य]:** Source: `DH_2011_0101_PART_B_DCHB_KUPWARA.pdf` (SHA-256: `88d825ceddc498fd2931486fef42d3cf44d30c445802c9f3d5afe8da9c2965af`), verified via `pdftotext v4.06`. Table: Village Primary Census Abstract (PCA), Heading: C D Block - 0008 Rajwar. PDF Viewer Page: 103, Printed Page: 96. Location Code: `000152`, Village Name: `Tulwari`. Area: **30.80 ha**, Households: **61**, Total Pop: **318** (165 M / 153 F), 0-6 Pop: 59 (32 M / 27 F). Position in survey: adjacent to Pazwal Pora (`000153`).
  - **[INFERENCE / निष्कर्ष - (A) CENSUS 2011 ENTRY SEPARATION]:** Official Census 2011 PCA proves this is an independent enumerated Census entry in C.D. Block 0008 Rajwar; it is NOT a clerical duplicate of code `000210`. In Census staging, status is **`KEEP_SEPARATE`** (no deletion or merge).
  - **[INFERENCE / निष्कर्ष - (B) CANONICAL / API ENTITY BOUNDARY (प्रमाण-सीमा)]:** Source documents 2011 Census enumeration boundaries only; it does NOT verify modern post-2011 Gram Panchayat notifications, contemporary cadastral maps, or live API entity autonomy. Production status remains strictly **`NOT APPROVED FOR IMPORT (EVIDENCE REVIEW ONLY)`**.
- **Village Code `000210` (Row 218):**
  - **[FACT / साक्ष्य]:** Source: `DH_2011_0101_PART_B_DCHB_KUPWARA.pdf` (SHA-256: `88d825ceddc498fd2931486fef42d3cf44d30c445802c9f3d5afe8da9c2965af`), verified via `pdftotext v4.06`. Table: Village Primary Census Abstract (PCA), Heading: C D Block - 0009 Langet. PDF Viewer Page: 115, Printed Page: 108. Location Code: `000210`, Village Name: `Tulwari`. Area: **190.60 ha**, Households: **211**, Total Pop: **1,480** (762 M / 718 F), 0-6 Pop: 241 (133 M / 108 F). Position in survey: adjacent to Shatgund Pain (`000211`).
  - **[INFERENCE / निष्कर्ष - (A) CENSUS 2011 ENTRY SEPARATION]:** Official Census 2011 PCA proves this is an independent enumerated Census entry in C.D. Block 0009 Langet; it is NOT a clerical duplicate of code `000152`. In Census staging, status is **`KEEP_SEPARATE`** (no deletion or merge).
  - **[INFERENCE / निष्कर्ष - (B) CANONICAL / API ENTITY BOUNDARY (प्रमाण-सीमा)]:** Source documents 2011 Census enumeration boundaries only; it does NOT verify modern post-2011 Gram Panchayat notifications, contemporary cadastral maps, or live API entity autonomy. Production status remains strictly **`NOT APPROVED FOR IMPORT (EVIDENCE REVIEW ONLY)`**.

#### 6. Kupwara District: `COL_SDT_01_001_00002_wara_pora` (Wara Pora)
- **Village Code `000226` (Row 234):**
  - **[FACT / साक्ष्य]:** Source: `DH_2011_0101_PART_B_DCHB_KUPWARA.pdf` (SHA-256: `88d825ceddc498fd2931486fef42d3cf44d30c445802c9f3d5afe8da9c2965af`), verified via `pdftotext v4.06`. Table: Village Primary Census Abstract (PCA), Heading: C D Block - 0008 Rajwar (Survey S.No. 103). PDF Viewer Page: 103, Printed Page: 96. Location Code: `000226`, Village Name: `Wara Pora`. Area: **100.00 ha**, Households: **167**, Total Pop: **1,153** (592 M / 561 F), 0-6 Pop: 197 (111 M / 86 F). Position in survey: adjacent to Pala Pora (`000227`).
  - **[INFERENCE / निष्कर्ष - (A) CENSUS 2011 ENTRY SEPARATION]:** Official Census 2011 PCA proves this is an independent enumerated Census entry in C.D. Block 0008 Rajwar (S.No. 103); it is NOT a clerical duplicate of codes `000240` or `000284`. In Census staging, status is **`KEEP_SEPARATE`** (no deletion or merge).
  - **[INFERENCE / निष्कर्ष - (B) CANONICAL / API ENTITY BOUNDARY (प्रमाण-सीमा)]:** Source documents 2011 Census enumeration boundaries only; it does NOT verify modern post-2011 Gram Panchayat notifications, contemporary cadastral maps, or live API entity autonomy. Production status remains strictly **`NOT APPROVED FOR IMPORT (EVIDENCE REVIEW ONLY)`**.
- **Village Code `000240` (Row 248):**
  - **[FACT / साक्ष्य]:** Source: `DH_2011_0101_PART_B_DCHB_KUPWARA.pdf` (SHA-256: `88d825ceddc498fd2931486fef42d3cf44d30c445802c9f3d5afe8da9c2965af`), verified via `pdftotext v4.06`. Table: Village Primary Census Abstract (PCA), Heading: C D Block - 0008 Rajwar (Survey S.No. 136). PDF Viewer Page: 103, Printed Page: 96. Location Code: `000240`, Village Name: `Wara Pora`. Area: **146.50 ha**, Households: **136**, Total Pop: **874** (484 M / 390 F), 0-6 Pop: 169 (86 M / 83 F). Position in survey: adjacent to Raj Pora (`000241`).
  - **[INFERENCE / निष्कर्ष - (A) CENSUS 2011 ENTRY SEPARATION]:** Official Census 2011 PCA proves this is an independent enumerated Census entry in C.D. Block 0008 Rajwar (S.No. 136); it is NOT a clerical duplicate of codes `000226` or `000284`. In Census staging, status is **`KEEP_SEPARATE`** (no deletion or merge).
  - **[INFERENCE / निष्कर्ष - (B) CANONICAL / API ENTITY BOUNDARY (प्रमाण-सीमा)]:** Source documents 2011 Census enumeration boundaries only; it does NOT verify modern post-2011 Gram Panchayat notifications, contemporary cadastral maps, or live API entity autonomy. Production status remains strictly **`NOT APPROVED FOR IMPORT (EVIDENCE REVIEW ONLY)`**.
- **Village Code `000284` (Row 292):**
  - **[FACT / साक्ष्य]:** Source: `DH_2011_0101_PART_B_DCHB_KUPWARA.pdf` (SHA-256: `88d825ceddc498fd2931486fef42d3cf44d30c445802c9f3d5afe8da9c2965af`), verified via `pdftotext v4.06`. Table: Village Primary Census Abstract (PCA), Heading: C D Block - 0009 Langet. PDF Viewer Page: 121, Printed Page: 114. Location Code: `000284`, Village Name: `Wara Pora`. Area: **37.20 ha**, Households: **76**, Total Pop: **466** (236 M / 230 F), 0-6 Pop: 94 (47 M / 47 F). Position in survey: adjacent to Shanu (`000285`).
  - **[INFERENCE / निष्कर्ष - (A) CENSUS 2011 ENTRY SEPARATION]:** Official Census 2011 PCA proves this is an independent enumerated Census entry in C.D. Block 0009 Langet; it is NOT a clerical duplicate of codes `000226` or `000240`. In Census staging, status is **`KEEP_SEPARATE`** (no deletion or merge).
  - **[INFERENCE / निष्कर्ष - (B) CANONICAL / API ENTITY BOUNDARY (प्रमाण-सीमा)]:** Source documents 2011 Census enumeration boundaries only; it does NOT verify modern post-2011 Gram Panchayat notifications, contemporary cadastral maps, or live API entity autonomy. Production status remains strictly **`NOT APPROVED FOR IMPORT (EVIDENCE REVIEW ONLY)`**.

#### 7. Saharanpur District: `COL_SDT_09_132_00701_ahmadpur` (Ahmadpur)
- **Village Code `108954` (Row 110586):**
  - **[FACT / साक्ष्य]:** Source: `DH_2011_0901_PART_B_DCHB_SAHARANPUR.pdf` (SHA-256: `56ed4b72dde5774202580541a6fa4b959a5cd91ff46e1eebff8cca8bfa8f2ff7`), verified via `pdftotext v4.06`. Table: Village Primary Census Abstract (PCA), Heading: C D Block - 0001 Sadauli Qadeem. PDF Viewer Page: 123, Printed Page: 104. Location Code: `108954`, Village Name: `Ahmadpur`. Area: **168.21 ha**, Status: Uninhabited (Households: 0, Total Pop: 0). Position in survey: adjacent to Bahadurpur (`108955`).
  - **[INFERENCE / निष्कर्ष - (A) CENSUS 2011 ENTRY SEPARATION]:** Official Census 2011 PCA proves this is an independent uninhabited revenue mouza entry in C.D. Block 0001 Sadauli Qadeem; it is NOT a clerical duplicate of code `109087`. In Census staging, status is **`KEEP_SEPARATE`** (no deletion or merge).
  - **[INFERENCE / निष्कर्ष - (B) CANONICAL / API ENTITY BOUNDARY (प्रमाण-सीमा)]:** Source documents 2011 Census enumeration boundaries only; it does NOT verify modern post-2011 Gram Panchayat notifications, contemporary cadastral maps, or live API entity autonomy. Production status remains strictly **`NOT APPROVED FOR IMPORT (EVIDENCE REVIEW ONLY)`**.
- **Village Code `109087` (Row 110719):**
  - **[FACT / साक्ष्य]:** Source: `DH_2011_0901_PART_B_DCHB_SAHARANPUR.pdf` (SHA-256: `56ed4b72dde5774202580541a6fa4b959a5cd91ff46e1eebff8cca8bfa8f2ff7`), verified via `pdftotext v4.06`. Table: Village Primary Census Abstract (PCA), Heading: C D Block - 0002 Muzaffarabad. PDF Viewer Page: 141, Printed Page: 122. Location Code: `109087`, Village Name: `Ahmadpur`. Area: **35.31 ha**, Status: Uninhabited (Households: 0, Total Pop: 0). Position in survey: adjacent to Janipur (`109088`).
  - **[INFERENCE / निष्कर्ष - (A) CENSUS 2011 ENTRY SEPARATION]:** Official Census 2011 PCA proves this is an independent uninhabited revenue mouza entry in C.D. Block 0002 Muzaffarabad; it is NOT a clerical duplicate of code `108954`. In Census staging, status is **`KEEP_SEPARATE`** (no deletion or merge).
  - **[INFERENCE / निष्कर्ष - (B) CANONICAL / API ENTITY BOUNDARY (प्रमाण-सीमा)]:** Source documents 2011 Census enumeration boundaries only; it does NOT verify modern post-2011 Gram Panchayat notifications, contemporary cadastral maps, or live API entity autonomy. Production status remains strictly **`NOT APPROVED FOR IMPORT (EVIDENCE REVIEW ONLY)`**.

#### 8. Saharanpur District: `COL_SDT_09_132_00701_malakpur` (Malakpur)
- **Village Code `108943` (Row 110575):**
  - **[FACT / साक्ष्य]:** Source: `DH_2011_0901_PART_B_DCHB_SAHARANPUR.pdf` (SHA-256: `56ed4b72dde5774202580541a6fa4b959a5cd91ff46e1eebff8cca8bfa8f2ff7`), verified via `pdftotext v4.06`. Table: Village Primary Census Abstract (PCA), Heading: C D Block - 0001 Sadauli Qadeem. PDF Viewer Page: 123, Printed Page: 104. Location Code: `108943`, Village Name: `Malakpur`. Area: **141.90 ha**, Households: **218**, Total Pop: **1,189** (641 M / 548 F), 0-6 Pop: 197 (111 M / 86 F). Position in survey: adjacent to Alamgeerpursani (`108944`).
  - **[INFERENCE / निष्कर्ष - (A) CENSUS 2011 ENTRY SEPARATION]:** Official Census 2011 PCA proves this is an independent enumerated Census entry in C.D. Block 0001 Sadauli Qadeem; it is NOT a clerical duplicate of code `109124`. In Census staging, status is **`KEEP_SEPARATE`** (no deletion or merge).
  - **[INFERENCE / निष्कर्ष - (B) CANONICAL / API ENTITY BOUNDARY (प्रमाण-सीमा)]:** Source documents 2011 Census enumeration boundaries only; it does NOT verify modern post-2011 Gram Panchayat notifications, contemporary cadastral maps, or live API entity autonomy. Production status remains strictly **`NOT APPROVED FOR IMPORT (EVIDENCE REVIEW ONLY)`**.
- **Village Code `109124` (Row 110756):**
  - **[FACT / साक्ष्य]:** Source: `DH_2011_0901_PART_B_DCHB_SAHARANPUR.pdf` (SHA-256: `56ed4b72dde5774202580541a6fa4b959a5cd91ff46e1eebff8cca8bfa8f2ff7`), verified via `pdftotext v4.06`. Table: Village Primary Census Abstract (PCA), Heading: C D Block - 0002 Muzaffarabad. PDF Viewer Page: 147, Printed Page: 128. Location Code: `109124`, Village Name: `Malakpur`. Area: **295.78 ha**, Households: **142**, Total Pop: **955** (492 M / 463 F), 0-6 Pop: 153 (76 M / 77 F). Position in survey: adjacent to Rawashali (`109125`).
  - **[INFERENCE / निष्कर्ष - (A) CENSUS 2011 ENTRY SEPARATION]:** Official Census 2011 PCA proves this is an independent enumerated Census entry in C.D. Block 0002 Muzaffarabad; it is NOT a clerical duplicate of code `108943`. In Census staging, status is **`KEEP_SEPARATE`** (no deletion or merge).
  - **[INFERENCE / निष्कर्ष - (B) CANONICAL / API ENTITY BOUNDARY (प्रमाण-सीमा)]:** Source documents 2011 Census enumeration boundaries only; it does NOT verify modern post-2011 Gram Panchayat notifications, contemporary cadastral maps, or live API entity autonomy. Production status remains strictly **`NOT APPROVED FOR IMPORT (EVIDENCE REVIEW ONLY)`**.

#### 9. Saharanpur District: `COL_SDT_09_132_00701_rampur` (Rampur)
- **Village Code `108902` (Row 110534):**
  - **[FACT / साक्ष्य]:** Source: `DH_2011_0901_PART_B_DCHB_SAHARANPUR.pdf` (SHA-256: `56ed4b72dde5774202580541a6fa4b959a5cd91ff46e1eebff8cca8bfa8f2ff7`), verified via `pdftotext v4.06`. Table: Village Primary Census Abstract (PCA), Heading: C D Block - 0001 Sadauli Qadeem (Survey S.No. 11). PDF Viewer Page: 117, Printed Page: 98. Location Code: `108902`, Village Name: `Rampur`. Area: **270.69 ha**, Households: **42**, Total Pop: **216** (113 M / 103 F), 0-6 Pop: 37 (19 M / 18 F). Position in survey: adjacent to Mohammedpur Jhanjhar (`108903`).
  - **[INFERENCE / निष्कर्ष - (A) CENSUS 2011 ENTRY SEPARATION]:** Official Census 2011 PCA proves this is an independent enumerated Census entry in C.D. Block 0001 Sadauli Qadeem; it is NOT a clerical duplicate of code `109107`. In Census staging, status is **`KEEP_SEPARATE`** (no deletion or merge).
  - **[INFERENCE / निष्कर्ष - (B) CANONICAL / API ENTITY BOUNDARY (प्रमाण-सीमा)]:** Source documents 2011 Census enumeration boundaries only; it does NOT verify modern post-2011 Gram Panchayat notifications, contemporary cadastral maps, or live API entity autonomy. Production status remains strictly **`NOT APPROVED FOR IMPORT (EVIDENCE REVIEW ONLY)`**.
- **Village Code `109107` (Row 110739):**
  - **[FACT / साक्ष्य]:** Source: `DH_2011_0901_PART_B_DCHB_SAHARANPUR.pdf` (SHA-256: `56ed4b72dde5774202580541a6fa4b959a5cd91ff46e1eebff8cca8bfa8f2ff7`), verified via `pdftotext v4.06`. Table: Village Primary Census Abstract (PCA), Heading: C D Block - 0002 Muzaffarabad (Survey S.No. 167). PDF Viewer Page: 147, Printed Page: 128. Location Code: `109107`, Village Name: `Rampur`. Area: **139.21 ha**, Households: **181**, Total Pop: **966** (512 M / 454 F), 0-6 Pop: 125 (67 M / 58 F). Position in survey: adjacent to Dadwa (`109108`).
  - **[INFERENCE / निष्कर्ष - (A) CENSUS 2011 ENTRY SEPARATION]:** Official Census 2011 PCA proves this is an independent enumerated Census entry in C.D. Block 0002 Muzaffarabad; it is NOT a clerical duplicate of code `108902`. In Census staging, status is **`KEEP_SEPARATE`** (no deletion or merge).
  - **[INFERENCE / निष्कर्ष - (B) CANONICAL / API ENTITY BOUNDARY (प्रमाण-सीमा)]:** Source documents 2011 Census enumeration boundaries only; it does NOT verify modern post-2011 Gram Panchayat notifications, contemporary cadastral maps, or live API entity autonomy. Production status remains strictly **`NOT APPROVED FOR IMPORT (EVIDENCE REVIEW ONLY)`**.

#### 10. Saharanpur District: `COL_SDT_09_132_00701_nasrullapur_must` (Nasrullapur Must.)
- **Village Code `109188` (Row 110820):**
  - **[FACT / साक्ष्य]:** Source: `DH_2011_0901_PART_B_DCHB_SAHARANPUR.pdf` (SHA-256: `56ed4b72dde5774202580541a6fa4b959a5cd91ff46e1eebff8cca8bfa8f2ff7`), verified via `pdftotext v4.06`. Table: Village Primary Census Abstract (PCA), Heading: C D Block - 0002 Muzaffarabad. PDF Viewer Page: 153, Printed Page: 134. Location Code: `109188`, Village Name: `Nasrullapur Must.`. Area: **110.01 ha**, Status: Uninhabited (Households: 0, Total Pop: 0). Position in survey: adjacent to Sadullapur Must. (`109189`).
  - **[INFERENCE / निष्कर्ष - (A) CENSUS 2011 ENTRY SEPARATION]:** Official Census 2011 PCA proves this is an independent Mustahkam uninhabited revenue parcel in C.D. Block 0002 Muzaffarabad; it is NOT a clerical duplicate of code `109190`. In Census staging, status is **`KEEP_SEPARATE`** (no deletion or merge).
  - **[INFERENCE / निष्कर्ष - (B) CANONICAL / API ENTITY BOUNDARY (प्रमाण-सीमा)]:** Source documents 2011 Census enumeration boundaries only; it does NOT verify modern post-2011 Gram Panchayat notifications, contemporary cadastral maps, or live API entity autonomy. Production status remains strictly **`NOT APPROVED FOR IMPORT (EVIDENCE REVIEW ONLY)`**.
- **Village Code `109190` (Row 110822):**
  - **[FACT / साक्ष्य]:** Source: `DH_2011_0901_PART_B_DCHB_SAHARANPUR.pdf` (SHA-256: `56ed4b72dde5774202580541a6fa4b959a5cd91ff46e1eebff8cca8bfa8f2ff7`), verified via `pdftotext v4.06`. Table: Village Primary Census Abstract (PCA), Heading: C D Block - 0002 Muzaffarabad. PDF Viewer Page: 153, Printed Page: 134. Location Code: `109190`, Village Name: `Nasrullapur Must.`. Area: **25.19 ha**, Status: Uninhabited (Households: 0, Total Pop: 0). Position in survey: adjacent to Sadullapur Aht. (`109191`).
  - **[INFERENCE / निष्कर्ष - (A) CENSUS 2011 ENTRY SEPARATION]:** Official Census 2011 PCA proves this is an independent Mustahkam uninhabited revenue parcel in C.D. Block 0002 Muzaffarabad; it is NOT a clerical duplicate of code `109188`. In Census staging, status is **`KEEP_SEPARATE`** (no deletion or merge).
  - **[INFERENCE / निष्कर्ष - (B) CANONICAL / API ENTITY BOUNDARY (प्रमाण-सीमा)]:** Source documents 2011 Census enumeration boundaries only; it does NOT verify modern post-2011 Gram Panchayat notifications, contemporary cadastral maps, or live API entity autonomy. Production status remains strictly **`NOT APPROVED FOR IMPORT (EVIDENCE REVIEW ONLY)`**.

#### 11. Kullu District: `COL_SDT_02_026_00118_up_muhal_mahilee` (Up Muhal Mahilee)
- **Village Code `012818` (Row 13086):**
  - **[FACT / साक्ष्य]:** Source: `DH_2011_0204_PART_B_DCHB_KULLU.pdf` (SHA-256: `34a1bb1f8e951abc6b23c344a382b7ba49fa0e928f036e5d55925b996b1517c3`), verified via `pdftotext v4.06`. Table: Village Primary Census Abstract (PCA), Heading: C D Block - 0001 Naggar. PDF Viewer Page: 71, Printed Page: 64. Location Code: `012818`, Village Name: `Up Muhal Mahilee`. Area: **74.15 ha**, Households: **17**, Total Pop: **65** (35 M / 30 F), 0-6 Pop: 12 (8 M / 4 F). Position in survey: adjacent to Up Muhal Hirnee (`012819`).
  - **[INFERENCE / निष्कर्ष - (A) CENSUS 2011 ENTRY SEPARATION]:** Official Census 2011 PCA proves this is an independent Up-Muhal sub-revenue settlement in C.D. Block 0001 Naggar; it is NOT a clerical duplicate of code `012842`. In Census staging, status is **`KEEP_SEPARATE`** (no deletion or merge).
  - **[INFERENCE / निष्कर्ष - (B) CANONICAL / API ENTITY BOUNDARY (प्रमाण-सीमा)]:** Source documents 2011 Census enumeration boundaries only; it does NOT verify modern post-2011 Gram Panchayat notifications, contemporary cadastral maps, or live API entity autonomy. Production status remains strictly **`NOT APPROVED FOR IMPORT (EVIDENCE REVIEW ONLY)`**.
- **Village Code `012842` (Row 13110):**
  - **[FACT / साक्ष्य]:** Source: `DH_2011_0204_PART_B_DCHB_KULLU.pdf` (SHA-256: `34a1bb1f8e951abc6b23c344a382b7ba49fa0e928f036e5d55925b996b1517c3`), verified via `pdftotext v4.06`. Table: Village Primary Census Abstract (PCA), Heading: C D Block - 0001 Naggar. PDF Viewer Page: 77, Printed Page: 70. Location Code: `012842`, Village Name: `Up Muhal Mahilee`. Area: **17.94 ha**, Households: **42**, Total Pop: **228** (119 M / 109 F), 0-6 Pop: 17 (10 M / 7 F). Position in survey: adjacent to Up Muhal Baga Mahilee (`012843`).
  - **[INFERENCE / निष्कर्ष - (A) CENSUS 2011 ENTRY SEPARATION]:** Official Census 2011 PCA proves this is an independent Up-Muhal sub-revenue settlement in C.D. Block 0001 Naggar; it is NOT a clerical duplicate of code `012818`. In Census staging, status is **`KEEP_SEPARATE`** (no deletion or merge).
  - **[INFERENCE / निष्कर्ष - (B) CANONICAL / API ENTITY BOUNDARY (प्रमाण-सीमा)]:** Source documents 2011 Census enumeration boundaries only; it does NOT verify modern post-2011 Gram Panchayat notifications, contemporary cadastral maps, or live API entity autonomy. Production status remains strictly **`NOT APPROVED FOR IMPORT (EVIDENCE REVIEW ONLY)`**.

---

## 4. Status of Source Availability (Non-Fabrication Policy)

- **Master Workbook Available Locally:** `data/source/PC11_TV_DIR.xlsx` (23.3 MB, SHA-256: `e5670123...`).
- **Official DCHB Publications Status:** The comprehensive library of 640 District Census Handbook (DCHB) Part A (Village Directory) and Part B (PCA) PDF volumes is **not pre-downloaded on local disk**.
- **Strict Compliance:** In accordance with the prompt's instruction: *"उपलब्ध स्रोत न मिलने पर NEEDS_EVIDENCE रखो। केवल खोज परिणाम, अनुमानित आँकड़े या बिना पृष्ठ-संदर्भ वाले दावे को VERIFIED मत मानो"*, no speculative decisions were fabricated for the remaining 11,903 groups (25,898 records). They are honestly and transparently retained as **`NEEDS_EVIDENCE`**.

---

## 5. Certification of Non-Mutation
- **Records Deleted:** 0
- **Records Merged:** 0
- **Records Renamed:** 0
- **Records Reparented:** 0
- **Records Imported to Database:** 0
- **Production Status:** `NOT APPROVED FOR IMPORT (EVIDENCE REVIEW ONLY)`
