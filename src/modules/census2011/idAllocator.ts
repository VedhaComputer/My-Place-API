import { PLACE_LEVELS, PlaceLevel } from '../../shared/constants';
import { CensusRecordInput, CensusIdAllocationResult } from './types';

export class Census2011IdAllocator {
  private static readonly STATE_REGEX = /^\d{2}$/;
  private static readonly DISTRICT_REGEX = /^\d{3}$/;
  private static readonly SUBDISTRICT_REGEX = /^\d{5}$/;
  private static readonly VILLAGE_CODE_REGEX = /^\d{6}$/;
  private static readonly TOWN_CODE_REGEX = /^\d{6}$/;

  private static readonly ID_PATTERNS: Record<string, RegExp> = {
    [PLACE_LEVELS.COUNTRY]: /^CENSUS2011_IND$/,
    [PLACE_LEVELS.STATE_UT]: /^CENSUS2011_ST_\d{2}$/,
    [PLACE_LEVELS.DISTRICT]: /^CENSUS2011_DT_\d{2}_\d{3}$/,
    [PLACE_LEVELS.TEHSIL]: /^CENSUS2011_SDT_\d{2}_\d{3}_\d{5}$/,
    [PLACE_LEVELS.CITY_TOWN]: /^CENSUS2011_TWN_\d{2}_\d{3}_\d{5}_\d{6}(_\d+)?$/,
    [PLACE_LEVELS.VILLAGE]: /^CENSUS2011_VIL_\d{2}_\d{3}_\d{5}_\d{6}$/,
  };

  /**
   * Deterministically allocates a persistent, namespaced string identifier from verified Census codes.
   * Strictly avoids using mutable display names or mutable parent paths.
   * If any required hierarchy code is missing, invalid, or ambiguous, allocation fails and mandates quarantine.
   */
  public static allocateId(record: CensusRecordInput): CensusIdAllocationResult {
    switch (record.level) {
      case PLACE_LEVELS.COUNTRY:
        return { success: true, id: 'CENSUS2011_IND' };

      case PLACE_LEVELS.STATE_UT: {
        const stateCode = record.stateCode?.trim();
        if (!stateCode || !this.STATE_REGEX.test(stateCode)) {
          return {
            success: false,
            error: `Missing or invalid state code: '${stateCode}'`,
            quarantineReason: 'MISSING_OR_INVALID_STATE_CODE',
          };
        }
        return { success: true, id: `CENSUS2011_ST_${stateCode}` };
      }

      case PLACE_LEVELS.DISTRICT: {
        const stateCode = record.stateCode?.trim();
        const districtCode = record.districtCode?.trim();

        if (!stateCode || !this.STATE_REGEX.test(stateCode)) {
          return {
            success: false,
            error: `Missing or invalid state code for district: '${stateCode}'`,
            quarantineReason: 'MISSING_OR_INVALID_STATE_CODE',
          };
        }
        if (!districtCode || !this.DISTRICT_REGEX.test(districtCode) || districtCode === '000') {
          return {
            success: false,
            error: `Missing or invalid district code: '${districtCode}'`,
            quarantineReason: 'MISSING_OR_INVALID_DISTRICT_CODE',
          };
        }
        return { success: true, id: `CENSUS2011_DT_${stateCode}_${districtCode}` };
      }

      case PLACE_LEVELS.TEHSIL: {
        const stateCode = record.stateCode?.trim();
        const districtCode = record.districtCode?.trim();
        const subDistrictCode = record.subDistrictCode?.trim();

        if (!stateCode || !this.STATE_REGEX.test(stateCode)) {
          return {
            success: false,
            error: `Missing or invalid state code for tehsil: '${stateCode}'`,
            quarantineReason: 'MISSING_OR_INVALID_STATE_CODE',
          };
        }
        if (!districtCode || !this.DISTRICT_REGEX.test(districtCode) || districtCode === '000') {
          return {
            success: false,
            error: `Missing or invalid district code for tehsil: '${districtCode}'`,
            quarantineReason: 'MISSING_OR_INVALID_DISTRICT_CODE',
          };
        }
        if (!subDistrictCode || !this.SUBDISTRICT_REGEX.test(subDistrictCode) || subDistrictCode === '00000' || subDistrictCode === '99999') {
          return {
            success: false,
            error: `Missing or invalid subdistrict code: '${subDistrictCode}'`,
            quarantineReason: 'MISSING_OR_INVALID_SUBDISTRICT_CODE',
          };
        }
        return { success: true, id: `CENSUS2011_SDT_${stateCode}_${districtCode}_${subDistrictCode}` };
      }

      case PLACE_LEVELS.CITY_TOWN: {
        const stateCode = record.stateCode?.trim();
        const districtCode = record.districtCode?.trim();
        const subDistrictCode = record.subDistrictCode?.trim();
        const townCode = (record.townCode || (record as any).code)?.trim();

        if (!stateCode || !this.STATE_REGEX.test(stateCode)) {
          return {
            success: false,
            error: `Missing or invalid state code for town: '${stateCode}'`,
            quarantineReason: 'MISSING_OR_INVALID_STATE_CODE',
          };
        }
        if (!districtCode || !this.DISTRICT_REGEX.test(districtCode) || districtCode === '000') {
          return {
            success: false,
            error: `Missing or invalid district code for town: '${districtCode}'`,
            quarantineReason: 'MISSING_OR_INVALID_DISTRICT_CODE',
          };
        }
        if (!subDistrictCode || !this.SUBDISTRICT_REGEX.test(subDistrictCode) || subDistrictCode === '00000' || subDistrictCode === '99999') {
          return {
            success: false,
            error: `Missing or invalid subdistrict code for town: '${subDistrictCode}'`,
            quarantineReason: 'MISSING_OR_INVALID_SUBDISTRICT_CODE',
          };
        }
        if (!townCode || !this.TOWN_CODE_REGEX.test(townCode)) {
          return {
            success: false,
            error: `Missing or invalid town code: '${townCode}'`,
            quarantineReason: 'MISSING_OR_INVALID_TOWN_CODE',
          };
        }

        const baseTownId = `CENSUS2011_TWN_${stateCode}_${districtCode}_${subDistrictCode}_${townCode}`;
        const finalTownId = record.sourceRow ? `${baseTownId}_${record.sourceRow}` : baseTownId;
        return { success: true, id: finalTownId };
      }

      case PLACE_LEVELS.VILLAGE: {
        const stateCode = record.stateCode?.trim();
        const districtCode = record.districtCode?.trim();
        const subDistrictCode = record.subDistrictCode?.trim();
        const villageCode = (record.villageCode || (record as any).code)?.trim();

        if (!stateCode || !this.STATE_REGEX.test(stateCode)) {
          return {
            success: false,
            error: `Missing or invalid state code for village: '${stateCode}'`,
            quarantineReason: 'MISSING_OR_INVALID_STATE_CODE',
          };
        }
        if (!districtCode || !this.DISTRICT_REGEX.test(districtCode) || districtCode === '000') {
          return {
            success: false,
            error: `Missing or invalid district code for village: '${districtCode}'`,
            quarantineReason: 'MISSING_OR_INVALID_DISTRICT_CODE',
          };
        }
        if (!subDistrictCode || !this.SUBDISTRICT_REGEX.test(subDistrictCode) || subDistrictCode === '00000' || subDistrictCode === '99999') {
          return {
            success: false,
            error: `Missing or invalid subdistrict code for village: '${subDistrictCode}'`,
            quarantineReason: 'MISSING_OR_INVALID_SUBDISTRICT_CODE',
          };
        }
        if (!villageCode || !this.VILLAGE_CODE_REGEX.test(villageCode) || villageCode.startsWith('8')) {
          return {
            success: false,
            error: `Missing or invalid village code: '${villageCode}'`,
            quarantineReason: 'MISSING_OR_INVALID_VILLAGE_CODE',
          };
        }

        return {
          success: true,
          id: `CENSUS2011_VIL_${stateCode}_${districtCode}_${subDistrictCode}_${villageCode}`,
        };
      }

      default:
        return {
          success: false,
          error: `Unsupported administrative level: '${record.level}'`,
          quarantineReason: 'UNSUPPORTED_ADMINISTRATIVE_LEVEL',
        };
    }
  }

  /**
   * Validates whether a given ID string adheres to the official Census 2011 namespaced pattern.
   */
  public static validateId(id: string, expectedLevel?: PlaceLevel | string): boolean {
    if (!id || typeof id !== 'string') return false;

    if (expectedLevel && this.ID_PATTERNS[expectedLevel]) {
      return this.ID_PATTERNS[expectedLevel].test(id);
    }

    return Object.values(this.ID_PATTERNS).some((pattern) => pattern.test(id));
  }

  /**
   * Derives the expected parent identifier directly from the deterministic hierarchy code ID.
   */
  public static deriveExpectedParentId(id: string): string | null {
    if (id === 'CENSUS2011_IND') return null;

    if (id.startsWith('CENSUS2011_ST_')) {
      return 'CENSUS2011_IND';
    }

    if (id.startsWith('CENSUS2011_DT_')) {
      const parts = id.replace('CENSUS2011_DT_', '').split('_');
      if (parts.length >= 2) {
        return `CENSUS2011_ST_${parts[0]}`;
      }
    }

    if (id.startsWith('CENSUS2011_SDT_')) {
      const parts = id.replace('CENSUS2011_SDT_', '').split('_');
      if (parts.length >= 3) {
        return `CENSUS2011_DT_${parts[0]}_${parts[1]}`;
      }
    }

    if (id.startsWith('CENSUS2011_TWN_')) {
      const parts = id.replace('CENSUS2011_TWN_', '').split('_');
      if (parts.length >= 4) {
        return `CENSUS2011_SDT_${parts[0]}_${parts[1]}_${parts[2]}`;
      }
    }

    if (id.startsWith('CENSUS2011_VIL_')) {
      const parts = id.replace('CENSUS2011_VIL_', '').split('_');
      if (parts.length >= 4) {
        return `CENSUS2011_SDT_${parts[0]}_${parts[1]}_${parts[2]}`;
      }
    }

    return null;
  }
}
