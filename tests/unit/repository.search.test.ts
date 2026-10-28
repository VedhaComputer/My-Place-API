/**
 * repository.search.test.ts
 *
 * Targeted regression tests for PlaceRepository.query() search and pagination semantics.
 * Uses in-memory mode to avoid MongoDB dependency and test logic deterministically.
 *
 * Covers:
 *   A. Search semantics: case-insensitive, substring, multilingual (names.name), canonical
 *   B. Total semantics: zero results, partial page 1, exact limit, multi-page, beyond-end page
 *   C. $options:'i' removal from canonicalNameLower: verify lowercased search matches stored
 *      lower-cased values regardless of input case
 *   D. $options:'i' retained on names.name: verify non-ASCII (Hindi) name matching
 */

import { PlaceRepository } from '../../src/modules/places/repository';
import { PlaceDocument } from '../../src/modules/places/types';
import { PLACE_LEVELS, VERIFICATION_STATUS } from '../../src/shared/constants';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makePlace(
  id: string,
  canonicalName: string,
  names: Array<{ language: string; name: string }>,
  level: PlaceDocument['level'] = PLACE_LEVELS.VILLAGE
): PlaceDocument {
  return {
    _id: id,
    code: `CODE-${id}`,
    level,
    canonicalName,
    canonicalNameLower: canonicalName.normalize('NFC').toLowerCase(),
    names: names.map((n) => ({ language: n.language, name: n.name.normalize('NFC') })),
    parentId: 'plc_parent',
    verificationStatus: VERIFICATION_STATUS.VERIFIED,
    createdBy: 'test',
    verifiedBy: null,
    verifiedAt: null,
    verificationHistory: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

// 25 places: 20 English "Rampur" villages + 3 Hindi-named + 2 mixed-case edge cases
const fixtures: PlaceDocument[] = [
  // 20 English-only "Rampur" variants (to fill a page at limit=20)
  ...Array.from({ length: 20 }, (_, i) =>
    makePlace(`plc_en_${i}`, `Rampur ${i + 1}`, [{ language: 'en', name: `Rampur ${i + 1}` }])
  ),
  // 3 Hindi-named places: canonicalName is transliterated English, names.name has Devanagari
  makePlace('plc_hi_jaipur', 'Jaipur', [{ language: 'en', name: 'Jaipur' }, { language: 'hi', name: 'जयपुर' }], PLACE_LEVELS.DISTRICT),
  makePlace('plc_hi_bharat', 'India', [{ language: 'en', name: 'India' }, { language: 'hi', name: 'भारत' }], PLACE_LEVELS.COUNTRY),
  makePlace('plc_hi_rajasthan', 'Rajasthan', [{ language: 'en', name: 'Rajasthan' }, { language: 'hi', name: 'राजस्थान' }], PLACE_LEVELS.STATE_UT),
  // Mixed-case canonical name edge case
  makePlace('plc_sas', 'SAS Nagar (Mohali)', [{ language: 'en', name: 'SAS Nagar (Mohali)' }], PLACE_LEVELS.TEHSIL),
  // Unicode canonical name with em-dash
  makePlace('plc_dash', 'Hamba – Pinda', [{ language: 'en', name: 'Hamba – Pinda' }]),
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PlaceRepository.query() — in-memory search and pagination semantics', () => {
  let repo: PlaceRepository;

  beforeEach(() => {
    repo = new PlaceRepository();
    repo.enableInMemoryMode(fixtures);
  });

  // ---- A. Search semantics ----

  describe('A. Search semantics', () => {
    it('A1: matches canonicalNameLower substring case-insensitively (uppercase input)', async () => {
      // "RAMPUR" uppercased — toCanonicalLower converts it to "rampur" before regex
      const result = await repo.query({ search: 'RAMPUR' });
      expect(result.data.length).toBe(20); // all 20 rampur places
      expect(result.total).toBe(20);
    });

    it('A2: matches canonicalNameLower substring with mixed-case input', async () => {
      // "Mohali" → toCanonicalLower → "mohali", stored canonicalNameLower = "sas nagar (mohali)"
      const result = await repo.query({ search: 'Mohali' });
      expect(result.data.map((p) => p._id)).toContain('plc_sas');
    });

    it('A3: matches multilingual names.name with Hindi script (Devanagari)', async () => {
      // 'जयपुर' does NOT appear in any canonicalNameLower; only in names.name
      const result = await repo.query({ search: 'जयपुर' });
      expect(result.data.map((p) => p._id)).toContain('plc_hi_jaipur');
    });

    it('A4: matches multilingual names.name for भारत (Hindi for India)', async () => {
      const result = await repo.query({ search: 'भारत' });
      expect(result.data.map((p) => p._id)).toContain('plc_hi_bharat');
    });

    it('A5: does not match when search term is absent from both canonicalNameLower and names.name', async () => {
      const result = await repo.query({ search: 'xyznotexist' });
      expect(result.data.length).toBe(0);
      expect(result.total).toBe(0);
    });

    it('A6: Unicode em-dash in name is matched as substring', async () => {
      const result = await repo.query({ search: 'Hamba' });
      expect(result.data.map((p) => p._id)).toContain('plc_dash');
    });

    it('A7: names.name case-insensitive match for English names', async () => {
      // "JAIPUR" in all-caps should match names.name: "Jaipur" via $options:'i'
      const result = await repo.query({ search: 'JAIPUR' });
      expect(result.data.map((p) => p._id)).toContain('plc_hi_jaipur');
    });
  });

  // ---- B. Total / pagination semantics ----

  describe('B. Pagination total semantics', () => {
    it('B1: zero results — total is 0', async () => {
      const result = await repo.query({ search: 'zzznomatch' });
      expect(result.data.length).toBe(0);
      expect(result.total).toBe(0);
    });

    it('B2: fewer results than limit on page 1 — total equals data.length (no countDocuments needed)', async () => {
      // 3 Hindi-named places (non-Rampur non-SAS): query by a unique substring
      const result = await repo.query({ search: 'India', limit: '20', page: '1' });
      const ids = result.data.map((p) => p._id);
      expect(ids).toContain('plc_hi_bharat');
      expect(result.data.length).toBeLessThan(20);
      expect(result.total).toBe(result.data.length); // exact — short-circuit
    });

    it('B3: exactly limit results on page 1 — total must be at least limit (countDocuments required)', async () => {
      // 20 Rampur places fill exactly one page of 20
      const result = await repo.query({ search: 'Rampur', limit: '20', page: '1' });
      expect(result.data.length).toBe(20);
      expect(result.total).toBe(20); // countDocuments ran and returned 20
    });

    it('B4: more than limit results — page 1 triggers countDocuments; total > page size', async () => {
      // All 25 fixtures include 20 Rampur + SAS (mohali) + 3 Hindi-named + Hamba
      // A no-filter query returns all 25; limit=10 means page 1 returns 10 docs
      const result = await repo.query({ limit: '10', page: '1' });
      expect(result.data.length).toBe(10);
      expect(result.total).toBe(25); // countDocuments returned 25
    });

    it('B5: last partial page (skip > 0, data.length < limit) — total is exact via countDocuments', async () => {
      // 25 total, page=3 (skip=20), limit=10 → returns 5 docs
      // skip > 0, so Promise.all runs; countDocuments returns 25 (not skip+5=25 by accident)
      const result = await repo.query({ limit: '10', page: '3' });
      expect(result.data.length).toBe(5);
      expect(result.total).toBe(25);
    });

    it('B6: page beyond end of results (skip > total) — total from countDocuments via Promise.all, NOT skip+0', async () => {
      // 25 total, page=4 (skip=30), limit=10 → 0 docs returned
      // skip > 0, so Promise.all runs countDocuments; it returns 25, not skip+0=30
      const result = await repo.query({ limit: '10', page: '4' });
      expect(result.data.length).toBe(0);
      expect(result.total).toBe(25);          // countDocuments gives 25
      expect(result.total).not.toBe(30);      // Guard: short-circuit skip+0 bug is absent
    });

    it('B7: page 1 partial result — total equals data.length not skip+data.length', async () => {
      // 3 results for a specific search, page=1, limit=20 → short-circuit: total = 0 + 3 = 3
      const result = await repo.query({ search: 'Rajasthan', limit: '20', page: '1' });
      expect(result.data.length).toBe(1); // only plc_hi_rajasthan
      expect(result.total).toBe(1);
    });
  });

  // ---- C. $options:'i' removal from canonicalNameLower ----

  describe('C. canonicalNameLower case-handling (no $options:i needed)', () => {
    it('C1: lowercase search term matches stored canonicalNameLower exactly', async () => {
      const result = await repo.query({ search: 'rampur 1' });
      expect(result.data.map((p) => p._id)).toContain('plc_en_0');
    });

    it('C2: uppercase search term is normalised to lowercase before regex — still matches', async () => {
      const result = await repo.query({ search: 'RAMPUR 1' });
      expect(result.data.map((p) => p._id)).toContain('plc_en_0');
    });

    it('C3: mixed-case search matches via toCanonicalLower normalisation', async () => {
      const result = await repo.query({ search: 'SaS NaGaR' });
      expect(result.data.map((p) => p._id)).toContain('plc_sas');
    });
  });

  // ---- D. names.name retains $options:'i' for non-ASCII ----

  describe('D. names.name retains $options:i for case variations', () => {
    it('D1: Hindi Devanagari search matches case-insensitively (script has no case)', async () => {
      const result = await repo.query({ search: 'राजस्थान' });
      expect(result.data.map((p) => p._id)).toContain('plc_hi_rajasthan');
    });
  });
});
