import fs from 'fs';
import path from 'path';
import readline from 'readline';
import crypto from 'crypto';
import { PLACE_LEVELS, PlaceLevel, VALID_PARENT_LEVEL } from '../../shared/constants';
import { toCanonicalLower, toNFC } from '../../shared/utils/unicode';
import { Census2011IdAllocator } from './idAllocator';
import { Census2011ImportPlan, Census2011DryRunOptions, Census2011PlaceDocument } from './types';

export class Census2011DryRunImporter {
  /**
   * Executes a strict in-memory dry-run import simulation against Census 2011 staging files.
   * Strictly read-only: does NOT write or modify any files on disk and makes ZERO database connections.
   */
  public static async executeDryRun(options: Census2011DryRunOptions = {}): Promise<Census2011ImportPlan> {
    const baseDir = process.cwd();
    const stagingDir = options.stagingDir ?? path.join(baseDir, 'data/staging/census2011');
    const reportsDir = options.reportsDir ?? path.join(baseDir, 'reports');

    const failureReasons: string[] = [];
    const breakdownByLevel: Record<string, number> = {
      [PLACE_LEVELS.COUNTRY]: 0,
      [PLACE_LEVELS.STATE_UT]: 0,
      [PLACE_LEVELS.DISTRICT]: 0,
      [PLACE_LEVELS.TEHSIL]: 0,
      [PLACE_LEVELS.CITY_TOWN]: 0,
      [PLACE_LEVELS.VILLAGE]: 0,
    };

    // 1. Pre-load Collision, Duplicate Code, and Exception Registers
    const reviewJsonPath = path.join(reportsDir, 'village_collision_authoritative_evidence_review.json');
    const structuralExceptionsJsonPath = path.join(reportsDir, 'census2011_structural_exceptions.json');
    const urbanSummariesJsonPath = path.join(stagingDir, 'unresolved_hierarchy_records.json');
    const duplicateCandidatesJsonPath = path.join(stagingDir, 'duplicate_code_candidates.json');

    const collisionRowSet = new Set<number>();
    const keepSeparateRowSet = new Set<number>();
    if (fs.existsSync(reviewJsonPath)) {
      const reviewData = JSON.parse(fs.readFileSync(reviewJsonPath, 'utf-8'));
      if (Array.isArray(reviewData.records)) {
        for (const rec of reviewData.records) {
          if (rec.sourceRow) {
            if (rec.authoritativeRecommendation === 'KEEP_SEPARATE') {
              keepSeparateRowSet.add(rec.sourceRow);
            } else {
              collisionRowSet.add(rec.sourceRow);
            }
          }
        }
      }
    }

    const duplicateCodeRowSet = new Set<number>();
    if (fs.existsSync(duplicateCandidatesJsonPath)) {
      const dupData = JSON.parse(fs.readFileSync(duplicateCandidatesJsonPath, 'utf-8'));
      if (dupData.villageCodeDuplicates && typeof dupData.villageCodeDuplicates === 'object') {
        for (const rows of Object.values(dupData.villageCodeDuplicates)) {
          if (Array.isArray(rows)) {
            for (const r of rows) {
              if (r.sourceRow) {
                duplicateCodeRowSet.add(r.sourceRow);
              }
            }
          }
        }
      }
    }

    const structuralExceptionsRowSet = new Set<number>();
    let structuralExceptionsCount = 0;
    if (fs.existsSync(structuralExceptionsJsonPath)) {
      const excData = JSON.parse(fs.readFileSync(structuralExceptionsJsonPath, 'utf-8'));
      if (Array.isArray(excData.exceptions)) {
        structuralExceptionsCount = excData.exceptions.length;
        for (const exc of excData.exceptions) {
          if (exc.sourceRow) {
            structuralExceptionsRowSet.add(exc.sourceRow);
          }
        }
      }
    }

    let urbanAuxiliaryCount = 0;
    if (fs.existsSync(urbanSummariesJsonPath)) {
      const urbanData = JSON.parse(fs.readFileSync(urbanSummariesJsonPath, 'utf-8'));
      if (Array.isArray(urbanData)) {
        urbanAuxiliaryCount = urbanData.length;
      }
    }

    // In-memory sets and maps for canonical hierarchy validation
    const acceptedIds = new Set<string>();
    const acceptedEntities = new Map<string, { level: PlaceLevel; parentId: string | null }>();
    const parentScopedNames = new Set<string>();

    let totalSourceEntities = 0;
    let acceptedCandidateCount = 0;
    let quarantinedCount = 0;
    let invalidIdsCount = 0;
    let danglingParentCount = 0;
    let parentScopedCollisionCount = 0;

    // Helper: process and validate an entity candidate
    const processEntity = (candidate: {
      id: string;
      level: PlaceLevel;
      name: string;
      rawName?: string;
      parentId: string | null;
      stateCode?: string;
      districtCode?: string;
      subDistrictCode?: string;
      villageCode?: string;
      townCode?: string;
      sourceRow?: number | null;
    }): boolean => {
      totalSourceEntities++;

      // 1. ID Validation: Must match official Census namespaced pattern
      const isIdValid = Census2011IdAllocator.validateId(candidate.id, candidate.level);
      if (!isIdValid) {
        invalidIdsCount++;
        quarantinedCount++;
        failureReasons.push(`INVALID_ID: Entity '${candidate.name}' has invalid ID '${candidate.id}'`);
        return false;
      }

      if (acceptedIds.has(candidate.id)) {
        invalidIdsCount++;
        quarantinedCount++;
        failureReasons.push(`DUPLICATE_ID: ID '${candidate.id}' already exists in accepted set`);
        return false;
      }

      // 2. Parent Level Hierarchy Validation
      const allowedParents = VALID_PARENT_LEVEL[candidate.level];
      if (allowedParents === null && candidate.parentId !== null) {
        danglingParentCount++;
        quarantinedCount++;
        failureReasons.push(`ROOT_WITH_PARENT: Root entity '${candidate.id}' cannot have a parentId`);
        return false;
      }

      if (allowedParents !== null) {
        if (!candidate.parentId) {
          danglingParentCount++;
          quarantinedCount++;
          failureReasons.push(`MISSING_PARENT: Level ${candidate.level} entity '${candidate.id}' lacks parentId`);
          return false;
        }

        const parentEntity = acceptedEntities.get(candidate.parentId);
        if (!parentEntity) {
          danglingParentCount++;
          quarantinedCount++;
          failureReasons.push(`DANGLING_PARENT: Parent '${candidate.parentId}' of entity '${candidate.id}' not found`);
          return false;
        }

        if (!allowedParents.includes(parentEntity.level)) {
          danglingParentCount++;
          quarantinedCount++;
          failureReasons.push(
            `INVALID_PARENT_LEVEL: Entity '${candidate.id}' level ${candidate.level} under invalid parent level ${parentEntity.level}`
          );
          return false;
        }
      }

      // 3. Parent-Scoped Uniqueness:
      // For VILLAGE: Uniqueness is governed by official 6-digit Census code (DEC-01 Option B)
      // For other levels (Towns, Tehsils, Districts, States): Uniqueness is governed by canonical normalized name
      const canonicalNFC = toNFC(candidate.name);
      const canonicalLower = toCanonicalLower(canonicalNFC);
      const parentScopeKey = candidate.level === PLACE_LEVELS.VILLAGE && candidate.villageCode
        ? `${candidate.parentId}:VILLAGE:CODE_${candidate.villageCode}`
        : `${candidate.parentId ?? 'ROOT'}:${candidate.level}:NAME_${canonicalLower}`;

      if (parentScopedNames.has(parentScopeKey)) {
        parentScopedCollisionCount++;
        quarantinedCount++;
        failureReasons.push(`PARENT_SCOPED_COLLISION: Collision for key '${parentScopeKey}' under ID '${candidate.id}'`);
        return false;
      }

      // Entity accepted into canonical set
      acceptedIds.add(candidate.id);
      acceptedEntities.set(candidate.id, { level: candidate.level, parentId: candidate.parentId });
      parentScopedNames.add(parentScopeKey);
      breakdownByLevel[candidate.level] = (breakdownByLevel[candidate.level] ?? 0) + 1;
      acceptedCandidateCount++;
      return true;
    };

    // Step 2. Ingest Tiers 0 to 4 (Country, States, Districts, Tehsils, Towns)
    const countryPath = path.join(stagingDir, 'country.json');
    if (fs.existsSync(countryPath)) {
      const countries = JSON.parse(fs.readFileSync(countryPath, 'utf-8'));
      for (const c of countries) {
        processEntity({
          id: c.id,
          level: PLACE_LEVELS.COUNTRY,
          name: c.name,
          rawName: c.rawName,
          parentId: c.parentId,
        });
      }
    }

    const statesPath = path.join(stagingDir, 'states.json');
    if (fs.existsSync(statesPath)) {
      const states = JSON.parse(fs.readFileSync(statesPath, 'utf-8'));
      for (const s of states) {
        processEntity({
          id: s.id,
          level: PLACE_LEVELS.STATE_UT,
          name: s.name,
          rawName: s.rawName,
          parentId: s.parentId,
          stateCode: s.stateCode,
          sourceRow: s.sourceRow,
        });
      }
    }

    const districtsPath = path.join(stagingDir, 'districts.json');
    if (fs.existsSync(districtsPath)) {
      const districts = JSON.parse(fs.readFileSync(districtsPath, 'utf-8'));
      for (const d of districts) {
        processEntity({
          id: d.id,
          level: PLACE_LEVELS.DISTRICT,
          name: d.name,
          rawName: d.rawName,
          parentId: d.parentId,
          stateCode: d.stateCode,
          districtCode: d.districtCode,
          sourceRow: d.sourceRow,
        });
      }
    }

    const tehsilsPath = path.join(stagingDir, 'tehsils.json');
    if (fs.existsSync(tehsilsPath)) {
      const tehsils = JSON.parse(fs.readFileSync(tehsilsPath, 'utf-8'));
      for (const t of tehsils) {
        processEntity({
          id: t.id,
          level: PLACE_LEVELS.TEHSIL,
          name: t.name,
          rawName: t.rawName,
          parentId: t.parentId,
          stateCode: t.stateCode,
          districtCode: t.districtCode,
          subDistrictCode: t.subDistrictCode,
          sourceRow: t.sourceRow,
        });
      }
    }

    const townsPath = path.join(stagingDir, 'towns.json');
    if (fs.existsSync(townsPath)) {
      const towns = JSON.parse(fs.readFileSync(townsPath, 'utf-8'));
      for (const tw of towns) {
        processEntity({
          id: tw.id,
          level: PLACE_LEVELS.CITY_TOWN,
          name: tw.name,
          rawName: tw.rawName,
          parentId: tw.parentId,
          stateCode: tw.stateCode,
          districtCode: tw.districtCode,
          subDistrictCode: tw.subDistrictCode,
          townCode: tw.townCode,
          sourceRow: tw.sourceRow,
        });
      }
    }

    // Step 3. Stream and Validate Tier 5 Villages from villages.jsonl
    const villagesPath = path.join(stagingDir, 'villages.jsonl');
    if (fs.existsSync(villagesPath)) {
      const fileStream = fs.createReadStream(villagesPath);
      const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

      let villageLinesProcessed = 0;
      const maxVillages = options.maxVillages ?? Infinity;

      for await (const line of rl) {
        if (!line.trim()) continue;
        if (villageLinesProcessed >= maxVillages) {
          rl.close();
          fileStream.destroy();
          break;
        }
        villageLinesProcessed++;

        const v = JSON.parse(line);

        // Check if record is a quarantined collision record
        if (v.sourceRow && collisionRowSet.has(v.sourceRow)) {
          totalSourceEntities++;
          quarantinedCount++;
          continue;
        }

        // Check if record is a structural exception (e.g. missing subdistrict code row 306108)
        if (v.sourceRow && structuralExceptionsRowSet.has(v.sourceRow)) {
          totalSourceEntities++;
          quarantinedCount++;
          continue;
        }

        // Check if record has ambiguous duplicate village code within same tehsil
        if (v.sourceRow && duplicateCodeRowSet.has(v.sourceRow)) {
          totalSourceEntities++;
          quarantinedCount++;
          continue;
        }

        // Process canonical candidate village
        processEntity({
          id: v.id,
          level: PLACE_LEVELS.VILLAGE,
          name: v.name,
          rawName: v.rawName,
          parentId: v.parentId,
          stateCode: v.stateCode,
          districtCode: v.districtCode,
          subDistrictCode: v.subDistrictCode,
          villageCode: v.villageCode,
          sourceRow: v.sourceRow,
        });
      }
    }

    // Step 4. Compute Deterministic ID Fingerprint (SHA-256 of sorted accepted IDs)
    const sortedAcceptedIds = Array.from(acceptedIds).sort();
    const idFingerprint = crypto
      .createHash('sha256')
      .update(sortedAcceptedIds.join('\n'))
      .digest('hex');

    // Step 5. Evaluate Pass/Fail Status
    const isPassing =
      invalidIdsCount === 0 &&
      danglingParentCount === 0 &&
      parentScopedCollisionCount === 0 &&
      acceptedCandidateCount > 0 &&
      failureReasons.length === 0;

    return {
      totalSourceEntities,
      acceptedCandidateCount,
      quarantinedCount,
      urbanAuxiliaryCount,
      structuralExceptionsCount,
      invalidIdsCount,
      danglingParentCount,
      parentScopedCollisionCount,
      status: isPassing ? 'PASS' : 'FAIL',
      breakdownByLevel,
      idFingerprint,
      timestamp: new Date().toISOString(),
      failureReasons,
    };
  }

  /**
   * Runs two consecutive dry-runs and verifies deterministic idempotency.
   */
  public static async compareReruns(options: Census2011DryRunOptions = {}): Promise<{
    identical: boolean;
    plan1: Census2011ImportPlan;
    plan2: Census2011ImportPlan;
  }> {
    const plan1 = await this.executeDryRun(options);
    const plan2 = await this.executeDryRun(options);

    const identical =
      plan1.acceptedCandidateCount === plan2.acceptedCandidateCount &&
      plan1.quarantinedCount === plan2.quarantinedCount &&
      plan1.urbanAuxiliaryCount === plan2.urbanAuxiliaryCount &&
      plan1.structuralExceptionsCount === plan2.structuralExceptionsCount &&
      plan1.invalidIdsCount === plan2.invalidIdsCount &&
      plan1.danglingParentCount === plan2.danglingParentCount &&
      plan1.parentScopedCollisionCount === plan2.parentScopedCollisionCount &&
      plan1.status === plan2.status &&
      plan1.idFingerprint === plan2.idFingerprint;

    return { identical, plan1, plan2 };
  }
}
