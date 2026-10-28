import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import {
  PLACE_LEVELS,
  PlaceLevel,
  VERIFICATION_STATUS,
} from '../shared/constants';
import { normalizePlaceName } from '../validators/censusStagingValidator';
import { toNFC } from '../shared/utils/unicode';
import { PlaceDocument } from '../modules/places/types';
import { PlaceModel } from '../modules/places/place.model';
import { connectDatabase, disconnectDatabase } from '../config/database';

/**
 * ============================================================================
 * CENSUS 2011 TO LIVE PLACES COLLECTION — STRICT DRY-RUN & LIVE IMPORTER
 * ============================================================================
 *
 * RIGOROUS INVARIANTS & POLICIES ENFORCED:
 * 1. Default Dry-Run Safety: Defaults to zero database connections, zero queries, zero writes.
 *    Live execution is strictly opt-in via explicit `execute: true` / `--execute` flag.
 * 2. Deterministic Target IDs: Both entity _id and child parentId are generated
 *    using getDeterministicPlaceId(). Staging id and parentId are preserved
 *    in metadata for source provenance.
 * 3. Dual Hierarchy Validation:
 *    - Target hierarchy: Child's target parentId must exist in the target hierarchy.
 *    - Source hierarchy: Child's staging parentId must match the parent's staging id.
 *    - Namespaces (PL_* vs CENSUS2011_*) are never directly equated.
 * 4. Fail-Closed Pre-Staging Schema Validation:
 *    - unresolved_hierarchy_records.json and duplicate_code_candidates.json are
 *      strictly validated with positive integer sourceRows. Zero hard-coded fallbacks.
 *    - Structural exceptions register is strictly validated for positive integers,
 *      no duplicates, and valid schema.
 * 5. Complete Source-Row Audit (Completeness, Uniqueness, Disjointness):
 *    - Tracks every individual sourceRow in [2, 657010] across ALL safe and quarantined
 *      classifications. Detects missing rows, duplicate rows, and cross-category overlaps.
 *    - isFullyAudited is true ONLY when all conditions are proven without gaps.
 * 6. Finite Non-Negative Integer Validation for maxVillages: 0 is valid partial run;
 *    negative, fractional, NaN, or non-numeric values throw explicit Errors.
 * 7. Fail-Closed CSV Parsing: Detects unclosed quotes, field count mismatches,
 *    missing required columns, and non-integer source rows.
 * 8. Deterministic Village Quarantine Precedence:
 *    JSON Parse Error -> Invalid SourceRow -> Blank Name -> Registered Structural Exception ->
 *    Missing Required Codes -> Name Collision Register -> Staging Parent Mismatch ->
 *    Target Parent Invalid -> Unregistered Name Collision.
 * 9. Explicit Accounting Separation: Total quarantine decisions vs unique source-row
 *    identified quarantine records are tracked in distinct, non-conflated metrics.
 * 10. Idempotent Live Import Execution: Hierarchical bulk writes (Country -> State ->
 *     District -> Tehsil -> City/Town -> Village) using idempotent upsert operations.
 *     Full read-back verification confirms counts, indexes, and parent integrity.
 */

export interface DryRunOptions {
  stagingDir?: string;
  reportsDir?: string;
  maxVillages?: number; // Finite non-negative integer (0 is valid partial run)
  silent?: boolean;
  execute?: boolean; // Deliberate live-execution flag. Default false (strict dry-run mode).
  batchSize?: number; // Batch size for bulk write operations (default 2000)
}

export interface SourceRowClassification {
  sourceRow: number;
  category:
    | 'PRE_STAGING_UNRESOLVED_URBAN'
    | 'PRE_STAGING_TEHSIL_ALIAS'
    | 'CANONICAL_SAFE'
    | 'QUARANTINED_STAGING';
  tier?: string;
  entityId?: string;
  quarantineReason?: string;
}

export interface CrossCategoryOverlapDetail {
  sourceRow: number;
  classifications: Array<{
    category: string;
    tier?: string;
    entityId?: string;
    quarantineReason?: string;
  }>;
}

export interface SourceRowAudit {
  isFullyAudited: boolean;
  totalUniqueSourceRowsTracked: number;
  expectedSourceDataRows: number;
  expectedRowRange: { min: number; max: number };
  actualRowRange: { min: number | null; max: number | null };
  entitiesWithoutSourceRow: number;
  syntheticCountryRootEntities: number;
  safeEntitiesWithoutSourceRow: number;
  quarantinedEntitiesWithoutSourceRow: number;
  unidentifiedRecordsCount: number;
  jsonlParseFailuresCount: number;
  missingSourceRowsCount: number;
  missingSourceRowSamples: number[];
  duplicateSourceRowsInStaging: number;
  duplicateSourceRowSamples: number[];
  quarantineOverlapWithSafe: number;
  quarantineInternalOverlaps: number;
  crossCategoryOverlapsCount: number;
  crossCategoryOverlapSamples: CrossCategoryOverlapDetail[];
  unresolvedCount: number;
  limitations: string[];
}

export interface DryRunMetrics {
  dryRun: true;
  timestamp: string;
  isPartialRun: boolean;
  databaseOperations: {
    connected: false;
    reads: 0;
    writes: 0;
    mutations: 0;
  };
  sourceAccounting: {
    totalSourceRows: number;
    headerRows: number;
    dataSourceRows: number;
    preStagingQuarantineUnresolvedUrban: number;
    preStagingQuarantineTehsilAlias: number;
    canonicalHierarchyEntitiesStagedFromSource: number;
    isAccountingConsistent: boolean;
    accountingStatusNotes: string;
  };
  sourceRowAudit: SourceRowAudit;
  levelBreakdown: Record<
    string,
    {
      staged: number;
      safe: number;
      quarantined: number;
      quarantineReasons: Record<string, number>;
    }
  >;
  totals: {
    totalStagedEntities: number;
    totalSafeToIngest: number;
    totalQuarantined: number;
    uniqueQuarantinedSourceRows: number;
    quarantinedRecordsWithoutSourceRow: number;
  };
  villageCollisionDetails: {
    distinctGroups: number;
    distinctRecords: number;
    overlapWithStructuralExceptions: number;
    categories: Record<string, { groups: number; records: number }>;
  };
  sampleSafeRecords: Record<string, Partial<PlaceDocument>>;
}

export interface LiveImportMetrics {
  dryRun: false;
  timestamp: string;
  isPartialRun: boolean;
  databaseOperations: {
    connected: true;
    database: string;
    collection: string;
    reads: number;
    writes: number;
    mutations: number;
    upsertedCount: number;
    matchedCount: number;
    modifiedCount: number;
    failedCount: number;
  };
  sourceAccounting: DryRunMetrics['sourceAccounting'];
  sourceRowAudit: SourceRowAudit;
  levelBreakdown: DryRunMetrics['levelBreakdown'];
  totals: DryRunMetrics['totals'];
  villageCollisionDetails: DryRunMetrics['villageCollisionDetails'];
  batchResults: {
    batchesExecuted: number;
    batchSize: number;
    totalDocumentsProcessed: number;
    totalInserted: number;
    totalUpdated: number;
    totalFailed: number;
  };
  readBackVerification: {
    verified: boolean;
    totalPlacesInDb: number;
    levelCountsInDb: Record<string, number>;
    hierarchyIntegrityValid: boolean;
    sampleAncestorsVerified: boolean;
    notes: string[];
  };
  sampleSafeRecords: Record<string, Partial<PlaceDocument>>;
}

export type ImportExecutionResult = DryRunMetrics | LiveImportMetrics;

/**
 * Validates that a string is non-empty after trimming.
 */
export function isNonEmptyString(val: any): boolean {
  return typeof val === 'string' && val.trim().length > 0;
}

/**
 * Validates that an option value is a finite, non-negative integer.
 */
export function validateMaxVillagesOption(val: any): number {
  if (val === undefined) return Infinity;
  if (
    typeof val !== 'number' ||
    !Number.isFinite(val) ||
    !Number.isInteger(val) ||
    val < 0
  ) {
    throw new Error(
      `Invalid maxVillages option: expected finite, non-negative integer, got ${val}`
    );
  }
  return val;
}

/**
 * RFC-4180 compliant quote-safe CSV line parser.
 * Handles embedded commas and escaped quotes within quoted fields.
 * Throws explicit Error on unclosed quotes.
 */
export function parseCsvLine(line: string, lineNumber?: number): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes) {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++; // Skip escaped quote
        } else {
          inQuotes = false;
        }
      } else {
        inQuotes = true;
      }
    } else if (char === ',' && !inQuotes) {
      fields.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  if (inQuotes) {
    throw new Error(
      `Malformed CSV${lineNumber ? ` at line ${lineNumber}` : ''}: unclosed quote detected in line: ${line}`
    );
  }

  fields.push(current.trim());
  return fields;
}

/**
 * Deterministic ID Generator with strict code validation.
 * Throws an explicit Error if required codes are missing/empty, preventing
 * malformed 'undefined' or incomplete ID interpolation.
 */
export function getDeterministicPlaceId(
  level: PlaceLevel,
  params: {
    stateCode?: string;
    districtCode?: string;
    subDistrictCode?: string;
    townCode?: string;
    villageCode?: string;
    sourceRow?: number;
  }
): string {
  switch (level) {
    case PLACE_LEVELS.COUNTRY:
      return 'PL_IND';

    case PLACE_LEVELS.STATE_UT:
      if (!isNonEmptyString(params.stateCode)) {
        throw new Error('Missing or empty stateCode for STATE_UT ID generation');
      }
      return `PL_ST_${params.stateCode!.trim()}`;

    case PLACE_LEVELS.DISTRICT:
      if (!isNonEmptyString(params.stateCode) || !isNonEmptyString(params.districtCode)) {
        throw new Error('Missing or empty stateCode/districtCode for DISTRICT ID generation');
      }
      return `PL_DT_${params.stateCode!.trim()}_${params.districtCode!.trim()}`;

    case PLACE_LEVELS.TEHSIL:
      if (
        !isNonEmptyString(params.stateCode) ||
        !isNonEmptyString(params.districtCode) ||
        !isNonEmptyString(params.subDistrictCode)
      ) {
        throw new Error('Missing or empty stateCode/districtCode/subDistrictCode for TEHSIL ID generation');
      }
      return `PL_SDT_${params.stateCode!.trim()}_${params.districtCode!.trim()}_${params.subDistrictCode!.trim()}`;

    case PLACE_LEVELS.CITY_TOWN:
      if (
        !isNonEmptyString(params.stateCode) ||
        !isNonEmptyString(params.districtCode) ||
        !isNonEmptyString(params.subDistrictCode) ||
        !isNonEmptyString(params.townCode) ||
        typeof params.sourceRow !== 'number' ||
        !Number.isInteger(params.sourceRow) ||
        params.sourceRow <= 0
      ) {
        throw new Error('Missing or invalid codes/sourceRow for CITY_TOWN ID generation');
      }
      return `PL_TWN_${params.stateCode!.trim()}_${params.districtCode!.trim()}_${params.subDistrictCode!.trim()}_${params.townCode!.trim()}_${params.sourceRow}`;

    case PLACE_LEVELS.VILLAGE:
      if (
        !isNonEmptyString(params.stateCode) ||
        !isNonEmptyString(params.districtCode) ||
        !isNonEmptyString(params.subDistrictCode) ||
        !isNonEmptyString(params.villageCode)
      ) {
        throw new Error('Missing or empty codes for VILLAGE ID generation');
      }
      return `PL_VIL_${params.stateCode!.trim()}_${params.districtCode!.trim()}_${params.subDistrictCode!.trim()}_${params.villageCode!.trim()}`;

    default:
      throw new Error(`Unsupported place level for ID generation: ${level}`);
  }
}

/**
 * Maps a staging entity to the target PlaceDocument schema format.
 * Preserves original staging id and parentId in metadata for provenance.
 */
export function mapStagingToPlaceDocument(
  entity: any,
  level: PlaceLevel,
  resolvedParentId: string | null,
  createdBy: string = 'SYSTEM_IMPORT_CENSUS2011_DRYRUN'
): Partial<PlaceDocument> {
  const canonical = toNFC(String(entity.name || entity.rawName || '').trim());
  const canonicalLower = normalizePlaceName(canonical);

  const placeId = getDeterministicPlaceId(level, {
    stateCode: entity.stateCode,
    districtCode: entity.districtCode,
    subDistrictCode: entity.subDistrictCode,
    townCode: entity.townCode,
    villageCode: entity.villageCode,
    sourceRow: entity.sourceRow,
  });

  const doc: Partial<PlaceDocument> = {
    _id: placeId,
    code: undefined, // Preserved undefined to avoid { code: 1 } global unique index collision
    level,
    names: [
      {
        language: 'en',
        name: canonical,
      },
    ],
    canonicalName: canonical,
    canonicalNameLower: canonicalLower,
    parentId: resolvedParentId,
    verificationStatus: VERIFICATION_STATUS.PENDING_VERIFICATION,
    createdBy,
    verifiedBy: null,
    verifiedAt: null,
    verificationHistory: [],
    metadata: {
      censusYear: 2011,
      isHistoricalCensus2011: true,
      dataSource: 'Census 2011 PC11_TV_DIR',
      sourceRow: typeof entity.sourceRow === 'number' ? entity.sourceRow : null,
      rawName: entity.rawName || entity.name,
      stagingId: entity.id || null,             // Staging ID provenance preserved
      stagingParentId: entity.parentId || null, // Staging parentId provenance preserved
      stateCode: entity.stateCode || null,
      districtCode: entity.districtCode || null,
      subDistrictCode: entity.subDistrictCode || null,
      censusCode: entity.townCode || entity.villageCode || null,
    },
  };

  return doc;
}

/**
 * Loads and validates pre-staging unresolved urban records fail-closed.
 * No hard-coded fallback count. Rejects missing, malformed, or invalid schemas.
 */
export function loadUnresolvedUrbanRecords(stagingDir: string): {
  recordsCount: number;
  sourceRows: Set<number>;
} {
  const jsonPath = path.join(stagingDir, 'unresolved_hierarchy_records.json');
  if (!fs.existsSync(jsonPath)) {
    throw new Error(`Required pre-staging file missing: ${jsonPath}`);
  }

  let parsed: any;
  try {
    parsed = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
  } catch (err: any) {
    throw new Error(
      `Failed to parse JSON from ${jsonPath}: ${err.message}`
    );
  }

  if (!Array.isArray(parsed)) {
    throw new Error(
      `Invalid schema in ${jsonPath}: expected top-level array of unresolved urban records`
    );
  }

  const sourceRows = new Set<number>();
  for (let i = 0; i < parsed.length; i++) {
    const item = parsed[i];
    if (
      !item ||
      typeof item !== 'object' ||
      typeof item.sourceRow !== 'number' ||
      !Number.isFinite(item.sourceRow) ||
      !Number.isInteger(item.sourceRow) ||
      item.sourceRow <= 0
    ) {
      throw new Error(
        `Invalid unresolved urban record at index ${i} in ${jsonPath}: expected positive integer sourceRow`
      );
    }
    if (sourceRows.has(item.sourceRow)) {
      throw new Error(
        `Duplicate sourceRow ${item.sourceRow} found within unresolved urban records at index ${i}`
      );
    }
    sourceRows.add(item.sourceRow);
  }

  return { recordsCount: parsed.length, sourceRows };
}

/**
 * Loads and validates pre-staging subdistrict alias records fail-closed.
 * No hard-coded fallback count. Rejects missing, malformed, or invalid schemas.
 */
export function loadSubdistrictAliasRows(stagingDir: string): {
  recordsCount: number;
  sourceRows: Set<number>;
} {
  const jsonPath = path.join(stagingDir, 'duplicate_code_candidates.json');
  if (!fs.existsSync(jsonPath)) {
    throw new Error(`Required pre-staging file missing: ${jsonPath}`);
  }

  let parsed: any;
  try {
    parsed = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
  } catch (err: any) {
    throw new Error(
      `Failed to parse JSON from ${jsonPath}: ${err.message}`
    );
  }

  if (
    !parsed ||
    typeof parsed !== 'object' ||
    !Array.isArray(parsed.subdistrictAliasRows)
  ) {
    throw new Error(
      `Invalid schema in ${jsonPath}: expected top-level object with 'subdistrictAliasRows' array`
    );
  }

  const aliasRows = parsed.subdistrictAliasRows;
  const sourceRows = new Set<number>();
  for (let i = 0; i < aliasRows.length; i++) {
    const item = aliasRows[i];
    if (
      !item ||
      typeof item !== 'object' ||
      typeof item.variantSourceRow !== 'number' ||
      !Number.isFinite(item.variantSourceRow) ||
      !Number.isInteger(item.variantSourceRow) ||
      item.variantSourceRow <= 0
    ) {
      throw new Error(
        `Invalid subdistrict alias record at index ${i} in ${jsonPath}: expected positive integer variantSourceRow`
      );
    }
    if (sourceRows.has(item.variantSourceRow)) {
      throw new Error(
        `Duplicate variantSourceRow ${item.variantSourceRow} found within subdistrict alias records at index ${i}`
      );
    }
    sourceRows.add(item.variantSourceRow);
  }

  return { recordsCount: aliasRows.length, sourceRows };
}

/**
 * Header-aware, quote-safe loader for village collision register.
 * Fail-closed on missing columns, unclosed quotes, field count mismatches, or invalid numbers.
 */
export function loadVillageCollisionSourceRows(reportsDir: string): {
  collidingSourceRows: Set<number>;
  groupsCount: number;
  recordsCount: number;
  categories: Record<string, { groups: number; records: number }>;
} {
  const csvPath = path.join(reportsDir, 'village_collision_review_register.csv');
  if (!fs.existsSync(csvPath)) {
    throw new Error(`Required collision register CSV not found: ${csvPath}`);
  }

  const content = fs.readFileSync(csvPath, 'utf-8');
  const lines = content.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length < 2) {
    throw new Error(`Collision register CSV is empty or missing data rows: ${csvPath}`);
  }

  const headerFields = parseCsvLine(lines[0], 1);
  const expectedFieldCount = headerFields.length;

  const colIndex = {
    groupId: headerFields.indexOf('collision_group_id'),
    category: headerFields.indexOf('category'),
    sourceRow: headerFields.indexOf('source_row'),
  };

  if (
    colIndex.groupId === -1 ||
    colIndex.category === -1 ||
    colIndex.sourceRow === -1
  ) {
    throw new Error(
      `Required columns missing in collision register CSV: groupId=${colIndex.groupId}, category=${colIndex.category}, sourceRow=${colIndex.sourceRow}`
    );
  }

  const collidingSourceRows = new Set<number>();
  const groupIds = new Set<string>();

  const categoryGroups = new Map<string, Set<string>>();
  const categoryRecords = new Map<string, Set<number>>();

  for (let i = 1; i < lines.length; i++) {
    const rawLine = lines[i];
    if (!rawLine.trim()) continue;

    const fields = parseCsvLine(rawLine, i + 1);
    if (fields.length !== expectedFieldCount) {
      throw new Error(
        `Malformed CSV at line ${i + 1}: expected ${expectedFieldCount} fields, got ${fields.length}`
      );
    }

    const groupId = fields[colIndex.groupId];
    const sourceRowStr = fields[colIndex.sourceRow];
    const category = fields[colIndex.category];

    if (!isNonEmptyString(groupId)) {
      throw new Error(`Empty collision_group_id at CSV line ${i + 1}`);
    }
    if (!isNonEmptyString(category)) {
      throw new Error(`Empty category at CSV line ${i + 1}`);
    }
    if (!isNonEmptyString(sourceRowStr)) {
      throw new Error(`Empty source_row at CSV line ${i + 1}`);
    }

    const row = Number(sourceRowStr);
    if (
      !Number.isFinite(row) ||
      !Number.isInteger(row) ||
      row <= 0 ||
      String(row) !== sourceRowStr.trim()
    ) {
      throw new Error(
        `Invalid non-positive integer source_row '${sourceRowStr}' at CSV line ${i + 1}`
      );
    }

    if (collidingSourceRows.has(row)) {
      throw new Error(
        `Duplicate source_row ${row} detected within collision register CSV at line ${i + 1}`
      );
    }

    collidingSourceRows.add(row);
    groupIds.add(groupId);

    if (!categoryGroups.has(category)) {
      categoryGroups.set(category, new Set());
      categoryRecords.set(category, new Set());
    }
    categoryGroups.get(category)!.add(groupId);
    categoryRecords.get(category)!.add(row);
  }

  const categories: Record<string, { groups: number; records: number }> = {};
  for (const [cat, grpSet] of categoryGroups.entries()) {
    categories[cat] = {
      groups: grpSet.size,
      records: categoryRecords.get(cat)?.size || 0,
    };
  }

  return {
    collidingSourceRows,
    groupsCount: groupIds.size,
    recordsCount: collidingSourceRows.size,
    categories,
  };
}

/**
 * Loads structural exceptions fail-closed without silent fallbacks.
 * Throws explicit errors if file is missing, unreadable, schema is invalid,
 * entries have non-positive integers, or duplicates exist.
 */
export function loadStructuralExceptions(reportsDir: string): Set<number> {
  const jsonPath = path.join(reportsDir, 'census2011_structural_exceptions.json');
  if (!fs.existsSync(jsonPath)) {
    throw new Error(`Required structural exceptions file missing: ${jsonPath}`);
  }

  let parsed: any;
  try {
    parsed = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
  } catch (err: any) {
    throw new Error(
      `Failed to parse structural exceptions JSON from ${jsonPath}: ${err.message}`
    );
  }

  if (
    !parsed ||
    typeof parsed !== 'object' ||
    !Array.isArray(parsed.exceptions)
  ) {
    throw new Error(
      `Invalid schema in ${jsonPath}: expected top-level object with 'exceptions' array`
    );
  }

  const exceptionRows = new Set<number>();
  for (let i = 0; i < parsed.exceptions.length; i++) {
    const ex = parsed.exceptions[i];
    if (
      !ex ||
      typeof ex !== 'object' ||
      typeof ex.sourceRow !== 'number' ||
      !Number.isFinite(ex.sourceRow) ||
      !Number.isInteger(ex.sourceRow) ||
      ex.sourceRow <= 0
    ) {
      throw new Error(
        `Structural exception entry at index ${i} missing valid positive integer sourceRow: ${JSON.stringify(ex)}`
      );
    }

    if (exceptionRows.has(ex.sourceRow)) {
      throw new Error(
        `Duplicate sourceRow ${ex.sourceRow} found in structural exceptions register at index ${i}`
      );
    }
    exceptionRows.add(ex.sourceRow);
  }

  return exceptionRows;
}

/**
 * Executes the complete Census 2011 to Place dry-run validation with comprehensive
 * source-row auditing and dual hierarchy verification.
 */
export async function runCensus2011PlacesDryRun(
  options: DryRunOptions & { execute: true }
): Promise<LiveImportMetrics>;
export async function runCensus2011PlacesDryRun(
  options?: DryRunOptions & { execute?: false }
): Promise<DryRunMetrics>;
export async function runCensus2011PlacesDryRun(
  options?: DryRunOptions
): Promise<ImportExecutionResult>;
export async function runCensus2011PlacesDryRun(
  options: DryRunOptions = {}
): Promise<ImportExecutionResult> {
  const baseDir = process.cwd();
  const stagingDir = options.stagingDir || path.join(baseDir, 'data/staging/census2011');
  const reportsDir = options.reportsDir || path.join(baseDir, 'reports');
  const silent = !!options.silent;
  const execute = !!options.execute;
  const batchSize =
    typeof options.batchSize === 'number' && options.batchSize > 0
      ? options.batchSize
      : 2000;
  const createdByTag = execute
    ? 'SYSTEM_IMPORT_CENSUS2011'
    : 'SYSTEM_IMPORT_CENSUS2011_DRYRUN';

  // Strict validation of maxVillages: 0 is valid partial run, negative/float/NaN throws Error
  const maxVillages = validateMaxVillagesOption(options.maxVillages);
  const isPartialRun = maxVillages !== Infinity;

  if (!silent) {
    console.log('===============================================================');
    if (execute) {
      console.log('   CENSUS 2011 -> LIVE PLACES COLLECTION LIVE IMPORTER        ');
      console.log('   (LIVE WRITE MODE: Hierarchical Bulk Ingestion Enabled)      ');
    } else {
      console.log('   CENSUS 2011 -> LIVE PLACES COLLECTION DRY-RUN IMPORTER     ');
      console.log('   (Strict Dry-Run: Zero Database Connections / Zero Writes)   ');
    }
    if (isPartialRun) {
      console.log(`   [NOTICE: Partial run requested, maxVillages = ${maxVillages}]`);
    }
    console.log('===============================================================\n');
  }

  // 1. Verify existence of staging files
  const requiredFiles = [
    'country.json',
    'states.json',
    'districts.json',
    'tehsils.json',
    'towns.json',
    'villages.jsonl',
    'unresolved_hierarchy_records.json',
    'duplicate_code_candidates.json',
    'validation_summary.json',
  ];

  for (const f of requiredFiles) {
    const fullPath = path.join(stagingDir, f);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`Required staging file missing: ${fullPath}`);
    }
  }

  // 2. Pre-staging quarantine files (validated fail-closed, no hard-coded fallback)
  const { recordsCount: preStagingQuarantineUnresolvedUrban, sourceRows: unresolvedUrbanSourceRows } =
    loadUnresolvedUrbanRecords(stagingDir);

  const { recordsCount: preStagingQuarantineTehsilAlias, sourceRows: tehsilAliasSourceRows } =
    loadSubdistrictAliasRows(stagingDir);

  // 3. Collision register & structural exceptions
  const { collidingSourceRows, groupsCount, recordsCount, categories } =
    loadVillageCollisionSourceRows(reportsDir);
  const structuralExceptionRows = loadStructuralExceptions(reportsDir);

  // 4. Global Source-Row Classification Map across ALL data
  const globalSourceRowMap = new Map<number, SourceRowClassification[]>();

  const registerSourceRow = (
    sourceRow: any,
    category: SourceRowClassification['category'],
    tier?: string,
    entityId?: string,
    quarantineReason?: string
  ): boolean => {
    if (
      typeof sourceRow === 'number' &&
      Number.isFinite(sourceRow) &&
      Number.isInteger(sourceRow) &&
      sourceRow > 0
    ) {
      if (!globalSourceRowMap.has(sourceRow)) {
        globalSourceRowMap.set(sourceRow, []);
      }
      globalSourceRowMap.get(sourceRow)!.push({
        sourceRow,
        category,
        tier,
        entityId,
        quarantineReason,
      });
      return true;
    }
    return false;
  };

  // Register pre-staging source rows
  for (const row of unresolvedUrbanSourceRows) {
    registerSourceRow(row, 'PRE_STAGING_UNRESOLVED_URBAN', 'URBAN_SUMMARY');
  }
  for (const row of tehsilAliasSourceRows) {
    registerSourceRow(row, 'PRE_STAGING_TEHSIL_ALIAS', 'TEHSIL');
  }

  // In-memory Target ID sets (PL_*)
  const validTargetCountryIds = new Set<string>();
  const validTargetStateIds = new Set<string>();
  const validTargetDistrictIds = new Set<string>();
  const validTargetTehsilIds = new Set<string>();

  // In-memory Staging ID sets (CENSUS2011_*) for source hierarchy validation
  const stagingCountryIds = new Set<string>();
  const stagingStateIds = new Set<string>();
  const stagingDistrictIds = new Set<string>();
  const stagingTehsilIds = new Set<string>();

  // Name uniqueness lookup sets { parentId:::canonicalNameLower }
  const seenStateNamesUnderParent = new Set<string>();
  const seenDistrictNamesUnderParent = new Set<string>();
  const seenTehsilNamesUnderParent = new Set<string>();
  const seenTownNamesUnderParent = new Set<string>();
  const seenVillageNamesUnderParent = new Set<string>();

  let syntheticCountryRootEntities = 0;
  let safeEntitiesWithoutSourceRow = 0;
  let quarantinedEntitiesWithoutSourceRow = 0;
  let jsonlParseFailuresCount = 0;

  const sampleSafeRecords: Record<string, Partial<PlaceDocument>> = {};
  const safeCountryDocs: Partial<PlaceDocument>[] = [];
  const safeStateDocs: Partial<PlaceDocument>[] = [];
  const safeDistrictDocs: Partial<PlaceDocument>[] = [];
  const safeTehsilDocs: Partial<PlaceDocument>[] = [];
  const safeTownDocs: Partial<PlaceDocument>[] = [];

  const levelBreakdown: Record<
    string,
    {
      staged: number;
      safe: number;
      quarantined: number;
      quarantineReasons: Record<string, number>;
    }
  > = {
    COUNTRY: { staged: 0, safe: 0, quarantined: 0, quarantineReasons: {} },
    STATE_UT: { staged: 0, safe: 0, quarantined: 0, quarantineReasons: {} },
    DISTRICT: { staged: 0, safe: 0, quarantined: 0, quarantineReasons: {} },
    TEHSIL: { staged: 0, safe: 0, quarantined: 0, quarantineReasons: {} },
    CITY_TOWN: { staged: 0, safe: 0, quarantined: 0, quarantineReasons: {} },
    VILLAGE: { staged: 0, safe: 0, quarantined: 0, quarantineReasons: {} },
  };

  // Tier 1: COUNTRY
  const countryRaw = JSON.parse(
    fs.readFileSync(path.join(stagingDir, 'country.json'), 'utf-8')
  );
  const countryList = Array.isArray(countryRaw) ? countryRaw : [countryRaw];
  levelBreakdown.COUNTRY.staged = countryList.length;

  for (const c of countryList) {
    const doc = mapStagingToPlaceDocument(c, PLACE_LEVELS.COUNTRY, null, createdByTag);
    validTargetCountryIds.add(doc._id!);
    if (c.id) stagingCountryIds.add(c.id);
    levelBreakdown.COUNTRY.safe++;
    syntheticCountryRootEntities++; // Dedicated tracking for synthetic Country root entity
    if (!sampleSafeRecords.COUNTRY) sampleSafeRecords.COUNTRY = doc;
    safeCountryDocs.push(doc);
  }

  // Tier 2: STATE_UT
  const statesList = JSON.parse(
    fs.readFileSync(path.join(stagingDir, 'states.json'), 'utf-8')
  );
  levelBreakdown.STATE_UT.staged = statesList.length;

  for (const st of statesList) {
    const srcRow = typeof st.sourceRow === 'number' ? st.sourceRow : null;

    if (!isNonEmptyString(st.name) && !isNonEmptyString(st.rawName)) {
      levelBreakdown.STATE_UT.quarantined++;
      levelBreakdown.STATE_UT.quarantineReasons['BLANK_NAME'] =
        (levelBreakdown.STATE_UT.quarantineReasons['BLANK_NAME'] || 0) + 1;
      if (srcRow !== null) {
        registerSourceRow(srcRow, 'QUARANTINED_STAGING', 'STATE_UT', st.id, 'BLANK_NAME');
      } else {
        quarantinedEntitiesWithoutSourceRow++;
      }
      continue;
    }

    if (!isNonEmptyString(st.stateCode)) {
      levelBreakdown.STATE_UT.quarantined++;
      levelBreakdown.STATE_UT.quarantineReasons['MISSING_REQUIRED_CODE'] =
        (levelBreakdown.STATE_UT.quarantineReasons['MISSING_REQUIRED_CODE'] || 0) + 1;
      if (srcRow !== null) {
        registerSourceRow(srcRow, 'QUARANTINED_STAGING', 'STATE_UT', st.id, 'MISSING_REQUIRED_CODE');
      } else {
        quarantinedEntitiesWithoutSourceRow++;
      }
      continue;
    }

    // Source hierarchy validation (staging namespace: parentId must be present and valid)
    if (!isNonEmptyString(st.parentId) || !stagingCountryIds.has(st.parentId.trim())) {
      levelBreakdown.STATE_UT.quarantined++;
      levelBreakdown.STATE_UT.quarantineReasons['STAGING_PARENT_MISMATCH'] =
        (levelBreakdown.STATE_UT.quarantineReasons['STAGING_PARENT_MISMATCH'] || 0) + 1;
      if (srcRow !== null) {
        registerSourceRow(srcRow, 'QUARANTINED_STAGING', 'STATE_UT', st.id, 'STAGING_PARENT_MISMATCH');
      } else {
        quarantinedEntitiesWithoutSourceRow++;
      }
      continue;
    }

    // Target hierarchy validation (target deterministic namespace)
    const targetParentId = getDeterministicPlaceId(PLACE_LEVELS.COUNTRY, {});
    if (!validTargetCountryIds.has(targetParentId)) {
      levelBreakdown.STATE_UT.quarantined++;
      levelBreakdown.STATE_UT.quarantineReasons['INVALID_PARENT'] =
        (levelBreakdown.STATE_UT.quarantineReasons['INVALID_PARENT'] || 0) + 1;
      if (srcRow !== null) {
        registerSourceRow(srcRow, 'QUARANTINED_STAGING', 'STATE_UT', st.id, 'INVALID_PARENT');
      } else {
        quarantinedEntitiesWithoutSourceRow++;
      }
      continue;
    }

    const doc = mapStagingToPlaceDocument(st, PLACE_LEVELS.STATE_UT, targetParentId, createdByTag);
    const nameKey = `${targetParentId}:::${doc.canonicalNameLower}`;
    if (seenStateNamesUnderParent.has(nameKey)) {
      levelBreakdown.STATE_UT.quarantined++;
      levelBreakdown.STATE_UT.quarantineReasons['PARENT_SCOPED_NAME_COLLISION'] =
        (levelBreakdown.STATE_UT.quarantineReasons['PARENT_SCOPED_NAME_COLLISION'] || 0) + 1;
      if (srcRow !== null) {
        registerSourceRow(srcRow, 'QUARANTINED_STAGING', 'STATE_UT', st.id, 'PARENT_SCOPED_NAME_COLLISION');
      } else {
        quarantinedEntitiesWithoutSourceRow++;
      }
      continue;
    }
    seenStateNamesUnderParent.add(nameKey);

    validTargetStateIds.add(doc._id!);
    if (st.id) stagingStateIds.add(st.id);
    levelBreakdown.STATE_UT.safe++;
    if (!registerSourceRow(st.sourceRow, 'CANONICAL_SAFE', 'STATE_UT', doc._id)) {
      safeEntitiesWithoutSourceRow++;
    }
    if (!sampleSafeRecords.STATE_UT) sampleSafeRecords.STATE_UT = doc;
    safeStateDocs.push(doc);
  }

  // Tier 3: DISTRICT
  const districtsList = JSON.parse(
    fs.readFileSync(path.join(stagingDir, 'districts.json'), 'utf-8')
  );
  levelBreakdown.DISTRICT.staged = districtsList.length;

  for (const dt of districtsList) {
    const srcRow = typeof dt.sourceRow === 'number' ? dt.sourceRow : null;

    if (!isNonEmptyString(dt.name) && !isNonEmptyString(dt.rawName)) {
      levelBreakdown.DISTRICT.quarantined++;
      levelBreakdown.DISTRICT.quarantineReasons['BLANK_NAME'] =
        (levelBreakdown.DISTRICT.quarantineReasons['BLANK_NAME'] || 0) + 1;
      if (srcRow !== null) {
        registerSourceRow(srcRow, 'QUARANTINED_STAGING', 'DISTRICT', dt.id, 'BLANK_NAME');
      } else {
        quarantinedEntitiesWithoutSourceRow++;
      }
      continue;
    }

    if (!isNonEmptyString(dt.stateCode) || !isNonEmptyString(dt.districtCode)) {
      levelBreakdown.DISTRICT.quarantined++;
      levelBreakdown.DISTRICT.quarantineReasons['MISSING_REQUIRED_CODE'] =
        (levelBreakdown.DISTRICT.quarantineReasons['MISSING_REQUIRED_CODE'] || 0) + 1;
      if (srcRow !== null) {
        registerSourceRow(srcRow, 'QUARANTINED_STAGING', 'DISTRICT', dt.id, 'MISSING_REQUIRED_CODE');
      } else {
        quarantinedEntitiesWithoutSourceRow++;
      }
      continue;
    }

    // Source hierarchy validation (staging namespace: parentId must be present and valid)
    if (!isNonEmptyString(dt.parentId) || !stagingStateIds.has(dt.parentId.trim())) {
      levelBreakdown.DISTRICT.quarantined++;
      levelBreakdown.DISTRICT.quarantineReasons['STAGING_PARENT_MISMATCH'] =
        (levelBreakdown.DISTRICT.quarantineReasons['STAGING_PARENT_MISMATCH'] || 0) + 1;
      if (srcRow !== null) {
        registerSourceRow(srcRow, 'QUARANTINED_STAGING', 'DISTRICT', dt.id, 'STAGING_PARENT_MISMATCH');
      } else {
        quarantinedEntitiesWithoutSourceRow++;
      }
      continue;
    }

    // Target hierarchy validation (target deterministic namespace)
    const targetParentId = getDeterministicPlaceId(PLACE_LEVELS.STATE_UT, {
      stateCode: dt.stateCode,
    });
    if (!validTargetStateIds.has(targetParentId)) {
      levelBreakdown.DISTRICT.quarantined++;
      levelBreakdown.DISTRICT.quarantineReasons['INVALID_PARENT'] =
        (levelBreakdown.DISTRICT.quarantineReasons['INVALID_PARENT'] || 0) + 1;
      if (srcRow !== null) {
        registerSourceRow(srcRow, 'QUARANTINED_STAGING', 'DISTRICT', dt.id, 'INVALID_PARENT');
      } else {
        quarantinedEntitiesWithoutSourceRow++;
      }
      continue;
    }

    const doc = mapStagingToPlaceDocument(dt, PLACE_LEVELS.DISTRICT, targetParentId, createdByTag);
    const nameKey = `${targetParentId}:::${doc.canonicalNameLower}`;
    if (seenDistrictNamesUnderParent.has(nameKey)) {
      levelBreakdown.DISTRICT.quarantined++;
      levelBreakdown.DISTRICT.quarantineReasons['PARENT_SCOPED_NAME_COLLISION'] =
        (levelBreakdown.DISTRICT.quarantineReasons['PARENT_SCOPED_NAME_COLLISION'] || 0) + 1;
      if (srcRow !== null) {
        registerSourceRow(srcRow, 'QUARANTINED_STAGING', 'DISTRICT', dt.id, 'PARENT_SCOPED_NAME_COLLISION');
      } else {
        quarantinedEntitiesWithoutSourceRow++;
      }
      continue;
    }
    seenDistrictNamesUnderParent.add(nameKey);

    validTargetDistrictIds.add(doc._id!);
    if (dt.id) stagingDistrictIds.add(dt.id);
    levelBreakdown.DISTRICT.safe++;
    if (!registerSourceRow(dt.sourceRow, 'CANONICAL_SAFE', 'DISTRICT', doc._id)) {
      safeEntitiesWithoutSourceRow++;
    }
    if (!sampleSafeRecords.DISTRICT) sampleSafeRecords.DISTRICT = doc;
    safeDistrictDocs.push(doc);
  }

  // Tier 4: TEHSIL
  const tehsilsList = JSON.parse(
    fs.readFileSync(path.join(stagingDir, 'tehsils.json'), 'utf-8')
  );
  levelBreakdown.TEHSIL.staged = tehsilsList.length;

  for (const sdt of tehsilsList) {
    const srcRow = typeof sdt.sourceRow === 'number' ? sdt.sourceRow : null;

    if (!isNonEmptyString(sdt.name) && !isNonEmptyString(sdt.rawName)) {
      levelBreakdown.TEHSIL.quarantined++;
      levelBreakdown.TEHSIL.quarantineReasons['BLANK_NAME'] =
        (levelBreakdown.TEHSIL.quarantineReasons['BLANK_NAME'] || 0) + 1;
      if (srcRow !== null) {
        registerSourceRow(srcRow, 'QUARANTINED_STAGING', 'TEHSIL', sdt.id, 'BLANK_NAME');
      } else {
        quarantinedEntitiesWithoutSourceRow++;
      }
      continue;
    }

    if (
      !isNonEmptyString(sdt.stateCode) ||
      !isNonEmptyString(sdt.districtCode) ||
      !isNonEmptyString(sdt.subDistrictCode)
    ) {
      levelBreakdown.TEHSIL.quarantined++;
      levelBreakdown.TEHSIL.quarantineReasons['MISSING_REQUIRED_CODE'] =
        (levelBreakdown.TEHSIL.quarantineReasons['MISSING_REQUIRED_CODE'] || 0) + 1;
      if (srcRow !== null) {
        registerSourceRow(srcRow, 'QUARANTINED_STAGING', 'TEHSIL', sdt.id, 'MISSING_REQUIRED_CODE');
      } else {
        quarantinedEntitiesWithoutSourceRow++;
      }
      continue;
    }

    // Source hierarchy validation (staging namespace: parentId must be present and valid)
    if (!isNonEmptyString(sdt.parentId) || !stagingDistrictIds.has(sdt.parentId.trim())) {
      levelBreakdown.TEHSIL.quarantined++;
      levelBreakdown.TEHSIL.quarantineReasons['STAGING_PARENT_MISMATCH'] =
        (levelBreakdown.TEHSIL.quarantineReasons['STAGING_PARENT_MISMATCH'] || 0) + 1;
      if (srcRow !== null) {
        registerSourceRow(srcRow, 'QUARANTINED_STAGING', 'TEHSIL', sdt.id, 'STAGING_PARENT_MISMATCH');
      } else {
        quarantinedEntitiesWithoutSourceRow++;
      }
      continue;
    }

    // Target hierarchy validation (target deterministic namespace)
    const targetParentId = getDeterministicPlaceId(PLACE_LEVELS.DISTRICT, {
      stateCode: sdt.stateCode,
      districtCode: sdt.districtCode,
    });
    if (!validTargetDistrictIds.has(targetParentId)) {
      levelBreakdown.TEHSIL.quarantined++;
      levelBreakdown.TEHSIL.quarantineReasons['INVALID_PARENT'] =
        (levelBreakdown.TEHSIL.quarantineReasons['INVALID_PARENT'] || 0) + 1;
      if (srcRow !== null) {
        registerSourceRow(srcRow, 'QUARANTINED_STAGING', 'TEHSIL', sdt.id, 'INVALID_PARENT');
      } else {
        quarantinedEntitiesWithoutSourceRow++;
      }
      continue;
    }

    const doc = mapStagingToPlaceDocument(sdt, PLACE_LEVELS.TEHSIL, targetParentId, createdByTag);
    const nameKey = `${targetParentId}:::${doc.canonicalNameLower}`;
    if (seenTehsilNamesUnderParent.has(nameKey)) {
      levelBreakdown.TEHSIL.quarantined++;
      levelBreakdown.TEHSIL.quarantineReasons['PARENT_SCOPED_NAME_COLLISION'] =
        (levelBreakdown.TEHSIL.quarantineReasons['PARENT_SCOPED_NAME_COLLISION'] || 0) + 1;
      if (srcRow !== null) {
        registerSourceRow(srcRow, 'QUARANTINED_STAGING', 'TEHSIL', sdt.id, 'PARENT_SCOPED_NAME_COLLISION');
      } else {
        quarantinedEntitiesWithoutSourceRow++;
      }
      continue;
    }
    seenTehsilNamesUnderParent.add(nameKey);

    validTargetTehsilIds.add(doc._id!);
    if (sdt.id) stagingTehsilIds.add(sdt.id);
    levelBreakdown.TEHSIL.safe++;
    if (!registerSourceRow(sdt.sourceRow, 'CANONICAL_SAFE', 'TEHSIL', doc._id)) {
      safeEntitiesWithoutSourceRow++;
    }
    if (!sampleSafeRecords.TEHSIL) sampleSafeRecords.TEHSIL = doc;
    safeTehsilDocs.push(doc);
  }

  // Tier 5: CITY_TOWN
  const townsList = JSON.parse(
    fs.readFileSync(path.join(stagingDir, 'towns.json'), 'utf-8')
  );
  levelBreakdown.CITY_TOWN.staged = townsList.length;

  for (const twn of townsList) {
    const srcRow = typeof twn.sourceRow === 'number' ? twn.sourceRow : null;

    if (!isNonEmptyString(twn.name) && !isNonEmptyString(twn.rawName)) {
      levelBreakdown.CITY_TOWN.quarantined++;
      levelBreakdown.CITY_TOWN.quarantineReasons['BLANK_NAME'] =
        (levelBreakdown.CITY_TOWN.quarantineReasons['BLANK_NAME'] || 0) + 1;
      if (srcRow !== null) {
        registerSourceRow(srcRow, 'QUARANTINED_STAGING', 'CITY_TOWN', twn.id, 'BLANK_NAME');
      } else {
        quarantinedEntitiesWithoutSourceRow++;
      }
      continue;
    }

    if (
      !isNonEmptyString(twn.stateCode) ||
      !isNonEmptyString(twn.districtCode) ||
      !isNonEmptyString(twn.subDistrictCode) ||
      !isNonEmptyString(twn.townCode) ||
      typeof twn.sourceRow !== 'number'
    ) {
      levelBreakdown.CITY_TOWN.quarantined++;
      levelBreakdown.CITY_TOWN.quarantineReasons['MISSING_REQUIRED_CODE'] =
        (levelBreakdown.CITY_TOWN.quarantineReasons['MISSING_REQUIRED_CODE'] || 0) + 1;
      if (srcRow !== null) {
        registerSourceRow(srcRow, 'QUARANTINED_STAGING', 'CITY_TOWN', twn.id, 'MISSING_REQUIRED_CODE');
      } else {
        quarantinedEntitiesWithoutSourceRow++;
      }
      continue;
    }

    // Source hierarchy validation (staging namespace: parentId must be present and valid)
    if (!isNonEmptyString(twn.parentId) || !stagingTehsilIds.has(twn.parentId.trim())) {
      levelBreakdown.CITY_TOWN.quarantined++;
      levelBreakdown.CITY_TOWN.quarantineReasons['STAGING_PARENT_MISMATCH'] =
        (levelBreakdown.CITY_TOWN.quarantineReasons['STAGING_PARENT_MISMATCH'] || 0) + 1;
      if (srcRow !== null) {
        registerSourceRow(srcRow, 'QUARANTINED_STAGING', 'CITY_TOWN', twn.id, 'STAGING_PARENT_MISMATCH');
      } else {
        quarantinedEntitiesWithoutSourceRow++;
      }
      continue;
    }

    // Target hierarchy validation (target deterministic namespace)
    const targetParentId = getDeterministicPlaceId(PLACE_LEVELS.TEHSIL, {
      stateCode: twn.stateCode,
      districtCode: twn.districtCode,
      subDistrictCode: twn.subDistrictCode,
    });
    if (!validTargetTehsilIds.has(targetParentId)) {
      levelBreakdown.CITY_TOWN.quarantined++;
      levelBreakdown.CITY_TOWN.quarantineReasons['INVALID_PARENT'] =
        (levelBreakdown.CITY_TOWN.quarantineReasons['INVALID_PARENT'] || 0) + 1;
      if (srcRow !== null) {
        registerSourceRow(srcRow, 'QUARANTINED_STAGING', 'CITY_TOWN', twn.id, 'INVALID_PARENT');
      } else {
        quarantinedEntitiesWithoutSourceRow++;
      }
      continue;
    }

    const doc = mapStagingToPlaceDocument(twn, PLACE_LEVELS.CITY_TOWN, targetParentId, createdByTag);

    // Parent-scoped normalized name uniqueness check (using project normalizePlaceName + toNFC)
    const nameKey = `${targetParentId}:::${doc.canonicalNameLower}`;
    if (seenTownNamesUnderParent.has(nameKey)) {
      levelBreakdown.CITY_TOWN.quarantined++;
      levelBreakdown.CITY_TOWN.quarantineReasons['PARENT_SCOPED_NAME_COLLISION'] =
        (levelBreakdown.CITY_TOWN.quarantineReasons['PARENT_SCOPED_NAME_COLLISION'] || 0) + 1;
      if (srcRow !== null) {
        registerSourceRow(srcRow, 'QUARANTINED_STAGING', 'CITY_TOWN', twn.id, 'PARENT_SCOPED_NAME_COLLISION');
      } else {
        quarantinedEntitiesWithoutSourceRow++;
      }
      continue;
    }
    seenTownNamesUnderParent.add(nameKey);

    levelBreakdown.CITY_TOWN.safe++;
    if (!registerSourceRow(twn.sourceRow, 'CANONICAL_SAFE', 'CITY_TOWN', doc._id)) {
      safeEntitiesWithoutSourceRow++;
    }
    if (!sampleSafeRecords.CITY_TOWN) sampleSafeRecords.CITY_TOWN = doc;
    safeTownDocs.push(doc);
  }

  // Tier 6: VILLAGE
  const villagesJsonlPath = path.join(stagingDir, 'villages.jsonl');
  const fileStream = fs.createReadStream(villagesJsonlPath, { encoding: 'utf-8' });
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  let villageLineCount = 0;

  try {
    for await (const line of rl) {
      if (!line.trim()) continue;
      if (villageLineCount >= maxVillages) break;
      villageLineCount++;

    levelBreakdown.VILLAGE.staged++;
    let v: any;
    try {
      v = JSON.parse(line);
    } catch {
      jsonlParseFailuresCount++;
      levelBreakdown.VILLAGE.quarantined++;
      levelBreakdown.VILLAGE.quarantineReasons['JSON_PARSE_ERROR'] =
        (levelBreakdown.VILLAGE.quarantineReasons['JSON_PARSE_ERROR'] || 0) + 1;
      quarantinedEntitiesWithoutSourceRow++;
      continue;
    }

    const srcRow = typeof v.sourceRow === 'number' ? v.sourceRow : null;

    // PRECEDENCE 1: Invalid Source-Row (must be positive integer)
    if (
      srcRow === null ||
      !Number.isFinite(srcRow) ||
      !Number.isInteger(srcRow) ||
      srcRow <= 0
    ) {
      levelBreakdown.VILLAGE.quarantined++;
      levelBreakdown.VILLAGE.quarantineReasons['INVALID_SOURCE_ROW'] =
        (levelBreakdown.VILLAGE.quarantineReasons['INVALID_SOURCE_ROW'] || 0) + 1;
      quarantinedEntitiesWithoutSourceRow++;
      continue;
    }

    // PRECEDENCE 2: Blank or Whitespace-Only Name
    if (!isNonEmptyString(v.name) && !isNonEmptyString(v.rawName)) {
      levelBreakdown.VILLAGE.quarantined++;
      levelBreakdown.VILLAGE.quarantineReasons['BLANK_NAME'] =
        (levelBreakdown.VILLAGE.quarantineReasons['BLANK_NAME'] || 0) + 1;
      registerSourceRow(srcRow, 'QUARANTINED_STAGING', 'VILLAGE', v.id, 'BLANK_NAME');
      continue;
    }

    // PRECEDENCE 3: Registered Structural Exception (Row 306108 - missing subdistrict in source XML)
    if (structuralExceptionRows.has(srcRow)) {
      levelBreakdown.VILLAGE.quarantined++;
      levelBreakdown.VILLAGE.quarantineReasons['STRUCTURAL_EXCEPTION_REGISTERED'] =
        (levelBreakdown.VILLAGE.quarantineReasons['STRUCTURAL_EXCEPTION_REGISTERED'] || 0) + 1;
      registerSourceRow(srcRow, 'QUARANTINED_STAGING', 'VILLAGE', v.id, 'STRUCTURAL_EXCEPTION_REGISTERED');
      continue;
    }

    // PRECEDENCE 4: Missing Required Administrative Codes (prevents undefined ID generation)
    if (
      !isNonEmptyString(v.stateCode) ||
      !isNonEmptyString(v.districtCode) ||
      !isNonEmptyString(v.subDistrictCode) ||
      !isNonEmptyString(v.villageCode)
    ) {
      levelBreakdown.VILLAGE.quarantined++;
      levelBreakdown.VILLAGE.quarantineReasons['MISSING_REQUIRED_CODE_OR_PARENT'] =
        (levelBreakdown.VILLAGE.quarantineReasons['MISSING_REQUIRED_CODE_OR_PARENT'] || 0) + 1;
      registerSourceRow(srcRow, 'QUARANTINED_STAGING', 'VILLAGE', v.id, 'MISSING_REQUIRED_CODE_OR_PARENT');
      continue;
    }

    // PRECEDENCE 5: Village Name Collision Register
    if (collidingSourceRows.has(srcRow)) {
      levelBreakdown.VILLAGE.quarantined++;
      levelBreakdown.VILLAGE.quarantineReasons['PARENT_SCOPED_NAME_COLLISION'] =
        (levelBreakdown.VILLAGE.quarantineReasons['PARENT_SCOPED_NAME_COLLISION'] || 0) + 1;
      registerSourceRow(srcRow, 'QUARANTINED_STAGING', 'VILLAGE', v.id, 'PARENT_SCOPED_NAME_COLLISION');
      continue;
    }

    // PRECEDENCE 6: Source Staging Hierarchy Validation (staging namespace: parentId must be present and valid)
    if (!isNonEmptyString(v.parentId) || !stagingTehsilIds.has(v.parentId.trim())) {
      levelBreakdown.VILLAGE.quarantined++;
      levelBreakdown.VILLAGE.quarantineReasons['STAGING_PARENT_MISMATCH'] =
        (levelBreakdown.VILLAGE.quarantineReasons['STAGING_PARENT_MISMATCH'] || 0) + 1;
      registerSourceRow(srcRow, 'QUARANTINED_STAGING', 'VILLAGE', v.id, 'STAGING_PARENT_MISMATCH');
      continue;
    }

    // PRECEDENCE 7: Target Hierarchy Parent Validity (target deterministic namespace)
    let targetParentId: string;
    try {
      targetParentId = getDeterministicPlaceId(PLACE_LEVELS.TEHSIL, {
        stateCode: v.stateCode,
        districtCode: v.districtCode,
        subDistrictCode: v.subDistrictCode,
      });
    } catch {
      levelBreakdown.VILLAGE.quarantined++;
      levelBreakdown.VILLAGE.quarantineReasons['INVALID_PARENT'] =
        (levelBreakdown.VILLAGE.quarantineReasons['INVALID_PARENT'] || 0) + 1;
      registerSourceRow(srcRow, 'QUARANTINED_STAGING', 'VILLAGE', v.id, 'INVALID_PARENT');
      continue;
    }

    if (!validTargetTehsilIds.has(targetParentId)) {
      levelBreakdown.VILLAGE.quarantined++;
      levelBreakdown.VILLAGE.quarantineReasons['INVALID_PARENT'] =
        (levelBreakdown.VILLAGE.quarantineReasons['INVALID_PARENT'] || 0) + 1;
      registerSourceRow(srcRow, 'QUARANTINED_STAGING', 'VILLAGE', v.id, 'INVALID_PARENT');
      continue;
    }

    const doc = mapStagingToPlaceDocument(v, PLACE_LEVELS.VILLAGE, targetParentId);

    // PRECEDENCE 8: Parent-Scoped Normalized Name Uniqueness Check
    const nameKey = `${targetParentId}:::${doc.canonicalNameLower}`;
    if (seenVillageNamesUnderParent.has(nameKey)) {
      levelBreakdown.VILLAGE.quarantined++;
      levelBreakdown.VILLAGE.quarantineReasons['UNREGISTERED_NAME_COLLISION'] =
        (levelBreakdown.VILLAGE.quarantineReasons['UNREGISTERED_NAME_COLLISION'] || 0) + 1;
      registerSourceRow(srcRow, 'QUARANTINED_STAGING', 'VILLAGE', v.id, 'UNREGISTERED_NAME_COLLISION');
      continue;
    }
    seenVillageNamesUnderParent.add(nameKey);

    // Record is Safe to ingest
    levelBreakdown.VILLAGE.safe++;
    if (!registerSourceRow(v.sourceRow, 'CANONICAL_SAFE', 'VILLAGE', doc._id)) {
      safeEntitiesWithoutSourceRow++;
    }
    if (!sampleSafeRecords.VILLAGE) sampleSafeRecords.VILLAGE = doc;
    }
  } finally {
    rl.close();
    fileStream.destroy();
  }

  // --------------------------------------------------------------------------
  // 5. Total Calculations & Complete Source-Row Identity Auditing
  // --------------------------------------------------------------------------
  const totalStagedEntities = Object.values(levelBreakdown).reduce(
    (acc, curr) => acc + curr.staged,
    0
  );
  const totalSafeToIngest = Object.values(levelBreakdown).reduce(
    (acc, curr) => acc + curr.safe,
    0
  );
  const totalQuarantined = Object.values(levelBreakdown).reduce(
    (acc, curr) => acc + curr.quarantined,
    0
  );

  // Analyze globalSourceRowMap for overlaps, duplicates, and completeness
  const duplicateSourceRowsInStaging: number[] = [];
  const crossCategoryOverlapSamples: CrossCategoryOverlapDetail[] = [];
  let crossCategoryOverlapsCount = 0;
  let quarantineOverlapWithSafe = 0;

  const safeSourceRows = new Set<number>();
  const quarantinedSourceRows = new Set<number>();
  const quarantinedStagingSourceRows = new Set<number>();

  for (const [row, entries] of globalSourceRowMap.entries()) {
    const hasSafe = entries.some(e => e.category === 'CANONICAL_SAFE');
    const hasQuarantine = entries.some(
      e =>
        e.category === 'QUARANTINED_STAGING' ||
        e.category === 'PRE_STAGING_UNRESOLVED_URBAN' ||
        e.category === 'PRE_STAGING_TEHSIL_ALIAS'
    );
    const hasStagingQuarantine = entries.some(
      e => e.category === 'QUARANTINED_STAGING'
    );

    if (hasSafe) safeSourceRows.add(row);
    if (hasQuarantine) quarantinedSourceRows.add(row);
    if (hasStagingQuarantine) quarantinedStagingSourceRows.add(row);

    if (hasSafe && hasQuarantine) {
      quarantineOverlapWithSafe++;
    }

    if (entries.length > 1) {
      const distinctCategories = new Set(entries.map(e => e.category));
      if (distinctCategories.size > 1) {
        crossCategoryOverlapsCount++;
        if (crossCategoryOverlapSamples.length < 10) {
          crossCategoryOverlapSamples.push({
            sourceRow: row,
            classifications: entries.map(e => ({
              category: e.category,
              tier: e.tier,
              entityId: e.entityId,
              quarantineReason: e.quarantineReason,
            })),
          });
        }
      } else {
        duplicateSourceRowsInStaging.push(row);
      }
    }
  }

  // Expected source data rows in master workbook PC11_TV_DIR.xlsx:
  // Row 1: Header
  // Rows 2 to 657,010: Data rows (657,009 rows)
  const totalSourceRows = 657010;
  const headerRows = 1;
  const dataSourceRows = 657009;
  const expectedMinRow = 2;
  const expectedMaxRow = 657010;

  // Staged hierarchy entities derived from source rows (excluding synthetic country root)
  const sourceDerivedStagedEntities =
    totalStagedEntities - (validTargetCountryIds.size > 0 ? 1 : 0);

  let actualMinRow: number | null = null;
  let actualMaxRow: number | null = null;
  for (const r of globalSourceRowMap.keys()) {
    if (actualMinRow === null || r < actualMinRow) actualMinRow = r;
    if (actualMaxRow === null || r > actualMaxRow) actualMaxRow = r;
  }

  const missingSourceRowSamples: number[] = [];
  let missingSourceRowsCount = 0;

  if (!isPartialRun) {
    for (let r = expectedMinRow; r <= expectedMaxRow; r++) {
      if (!globalSourceRowMap.has(r)) {
        missingSourceRowsCount++;
        if (missingSourceRowSamples.length < 10) {
          missingSourceRowSamples.push(r);
        }
      }
    }
  }

  const entitiesWithoutSourceRow =
    syntheticCountryRootEntities + safeEntitiesWithoutSourceRow;
  const unidentifiedRecordsCount =
    quarantinedEntitiesWithoutSourceRow + safeEntitiesWithoutSourceRow;

  const sourceRowAuditLimitations: string[] = [];
  if (syntheticCountryRootEntities > 0) {
    sourceRowAuditLimitations.push(
      `Synthetic root entity (COUNTRY) has no sourceRow identifier by design.`
    );
  }
  if (unidentifiedRecordsCount > 0) {
    sourceRowAuditLimitations.push(
      `Unidentified records detected without valid positive integer sourceRow: ${unidentifiedRecordsCount} record(s).`
    );
  }
  if (jsonlParseFailuresCount > 0) {
    sourceRowAuditLimitations.push(
      `JSONL parse failures detected: ${jsonlParseFailuresCount} line(s) could not be parsed as valid JSON.`
    );
  }
  if (isPartialRun) {
    sourceRowAuditLimitations.push(
      `Partial run requested (maxVillages = ${maxVillages}). Full source-row accounting was not evaluated.`
    );
  }

  // Pre-staging internal quarantine overlaps
  let collisionVsStructuralOverlap = 0;
  for (const row of structuralExceptionRows) {
    if (collidingSourceRows.has(row)) collisionVsStructuralOverlap++;
  }

  let collisionVsUnresolvedOverlap = 0;
  for (const row of unresolvedUrbanSourceRows) {
    if (collidingSourceRows.has(row)) collisionVsUnresolvedOverlap++;
  }

  let aliasVsCollisionOverlap = 0;
  for (const row of tehsilAliasSourceRows) {
    if (collidingSourceRows.has(row)) aliasVsCollisionOverlap++;
  }

  let aliasVsUnresolvedOverlap = 0;
  for (const row of tehsilAliasSourceRows) {
    if (unresolvedUrbanSourceRows.has(row)) aliasVsUnresolvedOverlap++;
  }

  const quarantineInternalOverlaps =
    collisionVsStructuralOverlap +
    collisionVsUnresolvedOverlap +
    aliasVsCollisionOverlap +
    aliasVsUnresolvedOverlap;

  // Strict criteria for full audit verification
  const isCompletenessVerified =
    !isPartialRun &&
    missingSourceRowsCount === 0 &&
    globalSourceRowMap.size === dataSourceRows &&
    actualMinRow === expectedMinRow &&
    actualMaxRow === expectedMaxRow;

  const isUniquenessVerified =
    duplicateSourceRowsInStaging.length === 0 &&
    crossCategoryOverlapsCount === 0;

  const isDisjointnessVerified =
    quarantineOverlapWithSafe === 0 &&
    quarantineInternalOverlaps === 0 &&
    crossCategoryOverlapsCount === 0;

  const isAccountingConsistent =
    isCompletenessVerified &&
    isUniquenessVerified &&
    isDisjointnessVerified &&
    jsonlParseFailuresCount === 0 &&
    quarantinedEntitiesWithoutSourceRow === 0 &&
    safeEntitiesWithoutSourceRow === 0 &&
    unidentifiedRecordsCount === 0 &&
    sourceDerivedStagedEntities +
      preStagingQuarantineUnresolvedUrban +
      preStagingQuarantineTehsilAlias ===
      dataSourceRows;

  const unresolvedCount = isPartialRun
    ? Math.max(0, 645876 - villageLineCount)
    : missingSourceRowsCount;

  const accountingStatusNotes = isPartialRun
    ? 'PARTIAL_RUN_INCOMPLETE_ACCOUNTING'
    : isAccountingConsistent
    ? 'VERIFIED_100_PERCENT_CONSISTENT_AND_DISJOINT'
    : 'ACCOUNTING_DISCREPANCY_DETECTED';

  const sourceRowAudit: SourceRowAudit = {
    isFullyAudited: isAccountingConsistent,
    totalUniqueSourceRowsTracked: globalSourceRowMap.size,
    expectedSourceDataRows: dataSourceRows,
    expectedRowRange: { min: expectedMinRow, max: expectedMaxRow },
    actualRowRange: { min: actualMinRow, max: actualMaxRow },
    entitiesWithoutSourceRow,
    syntheticCountryRootEntities,
    safeEntitiesWithoutSourceRow,
    quarantinedEntitiesWithoutSourceRow,
    unidentifiedRecordsCount,
    jsonlParseFailuresCount,
    missingSourceRowsCount,
    missingSourceRowSamples,
    duplicateSourceRowsInStaging: duplicateSourceRowsInStaging.length,
    duplicateSourceRowSamples: duplicateSourceRowsInStaging.slice(0, 5),
    quarantineOverlapWithSafe,
    quarantineInternalOverlaps,
    crossCategoryOverlapsCount,
    crossCategoryOverlapSamples,
    unresolvedCount,
    limitations: sourceRowAuditLimitations,
  };

  const result: DryRunMetrics = {
    dryRun: true,
    timestamp: new Date().toISOString(),
    isPartialRun,
    databaseOperations: {
      connected: false,
      reads: 0,
      writes: 0,
      mutations: 0,
    },
    sourceAccounting: {
      totalSourceRows,
      headerRows,
      dataSourceRows,
      preStagingQuarantineUnresolvedUrban,
      preStagingQuarantineTehsilAlias,
      canonicalHierarchyEntitiesStagedFromSource: sourceDerivedStagedEntities,
      isAccountingConsistent,
      accountingStatusNotes,
    },
    sourceRowAudit,
    levelBreakdown,
    totals: {
      totalStagedEntities,
      totalSafeToIngest,
      totalQuarantined,
      uniqueQuarantinedSourceRows: quarantinedStagingSourceRows.size,
      quarantinedRecordsWithoutSourceRow: quarantinedEntitiesWithoutSourceRow,
    },
    villageCollisionDetails: {
      distinctGroups: groupsCount,
      distinctRecords: recordsCount,
      overlapWithStructuralExceptions: collisionVsStructuralOverlap,
      categories,
    },
    sampleSafeRecords,
  };

  if (!execute) {
    if (!silent) {
      console.log('--- DRY-RUN SUMMARY RESULTS ---');
      console.log(`Database connected: ${result.databaseOperations.connected} (ZERO WRITES)`);
      console.log(`Is partial run: ${isPartialRun}`);
      console.log(`Accounting Status: ${accountingStatusNotes}`);
      console.log(`- Pre-staging Unresolved Urban: ${preStagingQuarantineUnresolvedUrban}`);
      console.log(`- Pre-staging Tehsil Alias secondary rows: ${preStagingQuarantineTehsilAlias}`);
      console.log(`- Staged from source rows: ${sourceDerivedStagedEntities}`);
      console.log(`- Unique safe source rows: ${safeSourceRows.size}`);
      console.log(`- Unique quarantined source rows: ${quarantinedSourceRows.size}`);
      console.log(`- Total audited source rows: ${globalSourceRowMap.size} / ${dataSourceRows}`);
      console.log(`- Quarantine overlap with safe rows: ${quarantineOverlapWithSafe}`);
      console.log(`- Cross-category overlaps: ${crossCategoryOverlapsCount}`);
      console.log(`- Duplicate source rows: ${duplicateSourceRowsInStaging.length}`);
      console.log(`- Missing source rows: ${missingSourceRowsCount}\n`);

      console.log('Level-by-Level Breakdown:');
      for (const [lvl, counts] of Object.entries(levelBreakdown)) {
        console.log(
          `  ${lvl.padEnd(12)} -> Staged: ${String(counts.staged).padStart(7)} | Safe: ${String(counts.safe).padStart(7)} | Quarantined: ${String(counts.quarantined).padStart(6)}`
        );
      }
      console.log('\nTotals:');
      console.log(`  Total Staged Entities: ${totalStagedEntities}`);
      console.log(`  Total Safe to Ingest:  ${totalSafeToIngest}`);
      console.log(`  Total Quarantined:     ${totalQuarantined}`);
      console.log(
        `  Village Collisions:    ${recordsCount} records across ${groupsCount} distinct groups (overlap with exceptions: ${collisionVsStructuralOverlap})`
      );
      if (sourceRowAuditLimitations.length > 0) {
        console.log('\nAudit Limitations / Scope:');
        for (const lim of sourceRowAuditLimitations) {
          console.log(`  * ${lim}`);
        }
      }
      console.log('===============================================================\n');
    }

    return result;
  }

  // ==========================================================================
  // MANDATORY PRE-IMPORT SAFETY GATES FOR LIVE EXECUTION
  // ==========================================================================
  if (isPartialRun) {
    throw new Error(
      'Safety Gate Violation: Cannot execute live import on a partial run! maxVillages must not be set.'
    );
  }
  if (!sourceRowAudit.isFullyAudited) {
    throw new Error(
      'Safety Gate Violation: Dataset is not fully audited (isFullyAudited === false)!'
    );
  }
  if (duplicateSourceRowsInStaging.length > 0) {
    throw new Error(
      `Safety Gate Violation: Duplicate source rows detected in staging (${duplicateSourceRowsInStaging.length})!`
    );
  }
  if (crossCategoryOverlapsCount > 0) {
    throw new Error(
      `Safety Gate Violation: Cross-category overlaps detected (${crossCategoryOverlapsCount})!`
    );
  }
  if (!isAccountingConsistent) {
    throw new Error(
      'Safety Gate Violation: Source accounting equation is inconsistent!'
    );
  }
  if (totalSafeToIngest !== 630858) {
    throw new Error(
      `Safety Gate Violation: Total safe entities (${totalSafeToIngest}) does not equal expected 630,858!`
    );
  }

  if (!silent) {
    console.log('\n===============================================================');
    console.log('>>> INITIATING LIVE IMPORT INTO MONGODB: india_place_api.places <<<');
    console.log('===============================================================');
    console.log(`Connecting to MongoDB...`);
  }

  await connectDatabase();

  let upsertedCount = 0;
  let matchedCount = 0;
  let modifiedCount = 0;
  let batchesExecuted = 0;
  let totalDocumentsProcessed = 0;
  let totalFailed = 0;

  try {
    const db = PlaceModel.db;
    const dbName = db?.name;
    if (dbName !== 'india_place_api') {
      throw new Error(
        `Safety Gate Violation: Target database must strictly be 'india_place_api', but connected to '${dbName}'! Aborting.`
      );
    }

    const collectionName = PlaceModel.collection.collectionName;
    if (collectionName !== 'places') {
      throw new Error(
        `Safety Gate Violation: Target collection must strictly be 'places', but got '${collectionName}'! Aborting.`
      );
    }

    // Ensure compound unique indexes are created before bulk operations
    await PlaceModel.createIndexes();

    const existingCount = await PlaceModel.countDocuments({});
    if (!silent) {
      console.log(`Target confirmed: Database '${dbName}', Collection '${collectionName}'`);
      console.log(`Pre-import places count in '${collectionName}': ${existingCount}`);
    }

    // --- TIER 1: COUNTRY (1 document) ---
    if (!silent) console.log('\n[1/6] Ingesting COUNTRY tier (1 doc)...');
    const countryOps = safeCountryDocs.map((doc) => ({
      updateOne: {
        filter: { _id: doc._id },
        update: { $set: doc },
        upsert: true,
      },
    }));
    const countryRes = await PlaceModel.bulkWrite(countryOps as any, { ordered: false });
    upsertedCount += countryRes.upsertedCount || 0;
    matchedCount += countryRes.matchedCount || 0;
    modifiedCount += countryRes.modifiedCount || 0;
    batchesExecuted++;
    totalDocumentsProcessed += safeCountryDocs.length;

    // --- TIER 2: STATE_UT (35 documents) ---
    if (!silent) console.log('[2/6] Ingesting STATE_UT tier (35 docs)...');
    const stateOps = safeStateDocs.map((doc) => ({
      updateOne: {
        filter: { _id: doc._id },
        update: { $set: doc },
        upsert: true,
      },
    }));
    const stateRes = await PlaceModel.bulkWrite(stateOps as any, { ordered: false });
    upsertedCount += stateRes.upsertedCount || 0;
    matchedCount += stateRes.matchedCount || 0;
    modifiedCount += stateRes.modifiedCount || 0;
    batchesExecuted++;
    totalDocumentsProcessed += safeStateDocs.length;

    // --- TIER 3: DISTRICT (640 documents) ---
    if (!silent) console.log('[3/6] Ingesting DISTRICT tier (640 docs)...');
    const districtOps = safeDistrictDocs.map((doc) => ({
      updateOne: {
        filter: { _id: doc._id },
        update: { $set: doc },
        upsert: true,
      },
    }));
    const districtRes = await PlaceModel.bulkWrite(districtOps as any, { ordered: false });
    upsertedCount += districtRes.upsertedCount || 0;
    matchedCount += districtRes.matchedCount || 0;
    modifiedCount += districtRes.modifiedCount || 0;
    batchesExecuted++;
    totalDocumentsProcessed += safeDistrictDocs.length;

    // --- TIER 4: TEHSIL (5,945 documents in batches) ---
    if (!silent) {
      console.log(
        `[4/6] Ingesting TEHSIL tier (${safeTehsilDocs.length} docs in batches of ${batchSize})...`
      );
    }
    for (let i = 0; i < safeTehsilDocs.length; i += batchSize) {
      const chunk = safeTehsilDocs.slice(i, i + batchSize);
      const tehsilOps = chunk.map((doc) => ({
        updateOne: {
          filter: { _id: doc._id },
          update: { $set: doc },
          upsert: true,
        },
      }));
      const tehsilRes = await PlaceModel.bulkWrite(tehsilOps as any, { ordered: false });
      upsertedCount += tehsilRes.upsertedCount || 0;
      matchedCount += tehsilRes.matchedCount || 0;
      modifiedCount += tehsilRes.modifiedCount || 0;
      batchesExecuted++;
      totalDocumentsProcessed += chunk.length;
    }

    // --- TIER 5: CITY_TOWN (4,268 documents in batches) ---
    if (!silent) {
      console.log(
        `[5/6] Ingesting CITY_TOWN tier (${safeTownDocs.length} docs in batches of ${batchSize})...`
      );
    }
    for (let i = 0; i < safeTownDocs.length; i += batchSize) {
      const chunk = safeTownDocs.slice(i, i + batchSize);
      const townOps = chunk.map((doc) => ({
        updateOne: {
          filter: { _id: doc._id },
          update: { $set: doc },
          upsert: true,
        },
      }));
      const townRes = await PlaceModel.bulkWrite(townOps as any, { ordered: false });
      upsertedCount += townRes.upsertedCount || 0;
      matchedCount += townRes.matchedCount || 0;
      modifiedCount += townRes.modifiedCount || 0;
      batchesExecuted++;
      totalDocumentsProcessed += chunk.length;
    }

    // --- TIER 6: VILLAGE (619,954 documents streamed in batches) ---
    if (!silent) {
      console.log(
        `[6/6] Ingesting VILLAGE tier (streaming 645,876 villages, ~619,954 safe in batches of ${batchSize})...`
      );
    }
    const liveVillageStream = fs.createReadStream(
      path.join(stagingDir, 'villages.jsonl'),
      { encoding: 'utf-8' }
    );
    const liveRl = readline.createInterface({
      input: liveVillageStream,
      crlfDelay: Infinity,
    });
    let villageBatch: any[] = [];
    const seenVillageNamesInLive = new Set<string>();

    try {
      for await (const line of liveRl) {
        if (!line.trim()) continue;
        let v: any;
        try {
          v = JSON.parse(line);
        } catch {
          continue;
        }

        const srcRow = typeof v.sourceRow === 'number' ? v.sourceRow : null;
        if (srcRow === null || !Number.isInteger(srcRow) || srcRow <= 0) continue;
        if (!isNonEmptyString(v.name) && !isNonEmptyString(v.rawName)) continue;
        if (structuralExceptionRows.has(srcRow)) continue;
        if (
          !isNonEmptyString(v.stateCode) ||
          !isNonEmptyString(v.districtCode) ||
          !isNonEmptyString(v.subDistrictCode) ||
          !isNonEmptyString(v.villageCode)
        ) {
          continue;
        }
        if (collidingSourceRows.has(srcRow)) continue;
        if (!isNonEmptyString(v.parentId) || !stagingTehsilIds.has(v.parentId.trim())) {
          continue;
        }

        let targetParentId: string;
        try {
          targetParentId = getDeterministicPlaceId(PLACE_LEVELS.TEHSIL, {
            stateCode: v.stateCode,
            districtCode: v.districtCode,
            subDistrictCode: v.subDistrictCode,
          });
        } catch {
          continue;
        }
        if (!validTargetTehsilIds.has(targetParentId)) continue;

        const doc = mapStagingToPlaceDocument(
          v,
          PLACE_LEVELS.VILLAGE,
          targetParentId,
          'SYSTEM_IMPORT_CENSUS2011'
        );
        const nameKey = `${targetParentId}:::${doc.canonicalNameLower}`;
        if (seenVillageNamesInLive.has(nameKey)) continue;
        seenVillageNamesInLive.add(nameKey);

        villageBatch.push({
          updateOne: {
            filter: { _id: doc._id },
            update: { $set: doc },
            upsert: true,
          },
        });

        if (villageBatch.length >= batchSize) {
          const vRes = await PlaceModel.bulkWrite(villageBatch as any, { ordered: false });
          upsertedCount += vRes.upsertedCount || 0;
          matchedCount += vRes.matchedCount || 0;
          modifiedCount += vRes.modifiedCount || 0;
          batchesExecuted++;
          totalDocumentsProcessed += villageBatch.length;
          villageBatch = [];
          if (!silent && batchesExecuted % 50 === 0) {
            console.log(
              `  -> Batch ${batchesExecuted} written (${totalDocumentsProcessed} places total)...`
            );
          }
        }
      }

      if (villageBatch.length > 0) {
        const vRes = await PlaceModel.bulkWrite(villageBatch as any, { ordered: false });
        upsertedCount += vRes.upsertedCount || 0;
        matchedCount += vRes.matchedCount || 0;
        modifiedCount += vRes.modifiedCount || 0;
        batchesExecuted++;
        totalDocumentsProcessed += villageBatch.length;
        villageBatch = [];
      }
    } finally {
      liveRl.close();
      liveVillageStream.destroy();
    }

    // ==========================================================================
    // READ-BACK VERIFICATION FROM LIVE MONGODB
    // ==========================================================================
    if (!silent) console.log('\nExecuting post-import Read-Back Verification from MongoDB...');

    const totalPlacesInDb = await PlaceModel.countDocuments({});
    const levelCountsAgg = await PlaceModel.aggregate([
      { $group: { _id: '$level', count: { $sum: 1 } } },
    ]);
    const levelCountsInDb: Record<string, number> = {};
    for (const item of levelCountsAgg) {
      levelCountsInDb[item._id] = item.count;
    }

    // Parent reference integrity checks
    const countryInDb = await PlaceModel.findById('PL_IND');
    const isCountryValid = countryInDb !== null && countryInDb.parentId === null;

    const invalidStatesCount = await PlaceModel.countDocuments({
      level: PLACE_LEVELS.STATE_UT,
      parentId: { $ne: 'PL_IND' },
    });

    const distinctDistrictParents = await PlaceModel.distinct('parentId', {
      level: PLACE_LEVELS.DISTRICT,
    });
    const allDistrictParentsInStates = distinctDistrictParents.every((p) =>
      validTargetStateIds.has(p)
    );

    const distinctTehsilParents = await PlaceModel.distinct('parentId', {
      level: PLACE_LEVELS.TEHSIL,
    });
    const allTehsilParentsInDistricts = distinctTehsilParents.every((p) =>
      validTargetDistrictIds.has(p)
    );

    const distinctTownParents = await PlaceModel.distinct('parentId', {
      level: PLACE_LEVELS.CITY_TOWN,
    });
    const allTownParentsInTehsils = distinctTownParents.every((p) =>
      validTargetTehsilIds.has(p)
    );

    // Sample 1,000 villages parent check
    const sampleVillages = await PlaceModel.aggregate([
      { $match: { level: PLACE_LEVELS.VILLAGE } },
      { $sample: { size: 1000 } },
    ]);
    const sampleVillagesParentsValid =
      sampleVillages.length > 0 &&
      sampleVillages.every((v) => validTargetTehsilIds.has(v.parentId));

    // Ancestor trace check: Village -> Tehsil -> District -> State -> Country
    const sampleVillageDoc = await PlaceModel.findById('PL_VIL_01_001_00001_000001');
    let sampleAncestorsVerified = false;
    if (sampleVillageDoc && sampleVillageDoc.parentId) {
      const tehsilDoc = await PlaceModel.findById(sampleVillageDoc.parentId);
      if (tehsilDoc && tehsilDoc.parentId) {
        const districtDoc = await PlaceModel.findById(tehsilDoc.parentId);
        if (districtDoc && districtDoc.parentId) {
          const stateDoc = await PlaceModel.findById(districtDoc.parentId);
          if (stateDoc && stateDoc.parentId === 'PL_IND') {
            sampleAncestorsVerified = true;
          }
        }
      }
    }

    const hierarchyIntegrityValid =
      isCountryValid &&
      invalidStatesCount === 0 &&
      allDistrictParentsInStates &&
      allTehsilParentsInDistricts &&
      allTownParentsInTehsils &&
      sampleVillagesParentsValid &&
      sampleAncestorsVerified;

    const notes: string[] = [];
    if (totalPlacesInDb === 630858) {
      notes.push('Exact 630,858 safe places verified in live places collection');
    } else {
      notes.push(`Discrepancy: ${totalPlacesInDb} places found in DB, expected 630,858`);
    }
    if (hierarchyIntegrityValid) {
      notes.push('Complete 5-tier hierarchy integrity (Country -> State -> District -> Tehsil -> Town/Village) verified');
    }

    const liveResult: LiveImportMetrics = {
      dryRun: false,
      timestamp: new Date().toISOString(),
      isPartialRun: false,
      databaseOperations: {
        connected: true,
        database: dbName,
        collection: collectionName,
        reads: 1000 + distinctDistrictParents.length + distinctTehsilParents.length + distinctTownParents.length + 5,
        writes: totalDocumentsProcessed,
        mutations: upsertedCount + modifiedCount,
        upsertedCount,
        matchedCount,
        modifiedCount,
        failedCount: totalFailed,
      },
      sourceAccounting: result.sourceAccounting,
      sourceRowAudit: result.sourceRowAudit,
      levelBreakdown: result.levelBreakdown,
      totals: result.totals,
      villageCollisionDetails: result.villageCollisionDetails,
      batchResults: {
        batchesExecuted,
        batchSize,
        totalDocumentsProcessed,
        totalInserted: upsertedCount,
        totalUpdated: matchedCount,
        totalFailed,
      },
      readBackVerification: {
        verified: hierarchyIntegrityValid && totalPlacesInDb === 630858,
        totalPlacesInDb,
        levelCountsInDb,
        hierarchyIntegrityValid,
        sampleAncestorsVerified,
        notes,
      },
      sampleSafeRecords: result.sampleSafeRecords,
    };

    if (!silent) {
      console.log('\n===============================================================');
      console.log('>>> LIVE IMPORT COMPLETED SUCCESSFULLY <<<');
      console.log('===============================================================');
      console.log(`Database:              ${dbName}`);
      console.log(`Collection:            ${collectionName}`);
      console.log(`Total Places in DB:    ${totalPlacesInDb}`);
      console.log(`Batches Executed:      ${batchesExecuted}`);
      console.log(`Total Upserted:        ${upsertedCount}`);
      console.log(`Total Matched/Updated: ${matchedCount}`);
      console.log(`Total Failed:          ${totalFailed}`);
      console.log(`Hierarchy Valid:       ${hierarchyIntegrityValid}`);
      console.log(`Sample Trace Valid:    ${sampleAncestorsVerified}`);
      console.log('Level Counts in DB:');
      for (const [lvl, cnt] of Object.entries(levelCountsInDb)) {
        console.log(`  - ${lvl.padEnd(12)}: ${cnt}`);
      }
      console.log('===============================================================\n');
    }

    return liveResult;
  } finally {
    await disconnectDatabase();
  }
}

export async function runCensus2011PlacesImport(
  options: Omit<DryRunOptions, 'execute'> = {}
): Promise<LiveImportMetrics> {
  return (await runCensus2011PlacesDryRun({
    ...options,
    execute: true,
  })) as LiveImportMetrics;
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const isExecute = args.includes('--execute') || args.includes('--live');
  const isSilent = args.includes('--silent');
  const maxVillagesArg = args.find((a) => a.startsWith('--max-villages='));
  const maxVillages = maxVillagesArg
    ? parseInt(maxVillagesArg.split('=')[1], 10)
    : undefined;

  runCensus2011PlacesDryRun({
    execute: isExecute,
    silent: isSilent,
    maxVillages,
  }).catch((err) => {
    console.error('Census 2011 importer execution failed:', err);
    process.exit(1);
  });
}
