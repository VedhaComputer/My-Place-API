# India Place API

Independent TypeScript backend service providing master geographic hierarchy data and place management.

## Geographic Hierarchy
The service enforces a strict 6-tier administrative hierarchy:
```
COUNTRY
   └── STATE_UT (States and Union Territories)
         └── DISTRICT
               └── TEHSIL (Taluks / Mandals / Sub-districts)
                     ├── CITY_TOWN (Urban Local Bodies)
                     └── VILLAGE (Rural Revenue Villages)
```

## Architectural Principles
1. **Compound Natural Key Uniqueness:** Compound unique index on `{ parentId, level, canonicalNameLower }`.
2. **Independent Canonical String:** `canonicalName` is an independent string normalized to Unicode NFC.
3. **Multi-Script Coexistence:** Localized names (`names[]`) require valid BCP 47 tags (`Intl.Locale.baseName`). Distinct scripts (e.g. `pa-Guru` and `pa-Arab`) may coexist on the same entity.
4. **Collision Review Protocol:** Collisions are rejected with HTTP 409 and recorded in `place_collision_reviews` for administrative resolution.
5. **Selective Security & Public Read Access:** Public read access (`GET /places`, `GET /census2011`) allows clients and applications to query geographic and hierarchy data freely with standard rate limiting. All mutating and administrative operations (`POST /places`, `PATCH /places`, and collision reviews) strictly enforce Dual-Gate security (authenticated user session + approved application attestation + role authorization).

## Project Layout
* `src/config/`: Environment configuration and database connectivity.
* `src/middleware/`: Dual-gate authentication, error handling, and request validation.
* `src/modules/places/`: Types, Zod validation schemas, Mongoose models, repository, and service.
* `src/modules/health/`: Health checks and service readiness endpoints.
* `src/shared/`: Constants, AppError hierarchy, Unicode NFC and BCP 47 normalization utilities.
* `tests/`: Unit and integration test suite.
