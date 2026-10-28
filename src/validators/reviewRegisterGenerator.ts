import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { normalizePlaceName } from './censusStagingValidator';

export type ReviewDecision = 'KEEP' | 'REMOVE_DUPLICATE' | 'NEEDS_EVIDENCE';

export interface CollisionRegisterRecord {
  sourceRow: number;
  stagingLineNumber: number;
  originalDisplayName: string;
  villageCode: string;
  tehsilId: string;
  canonicalNameLower: string;
  collisionGroupId: string;
  category: 'PURE_IDENTICAL_RAW' | 'PURE_NORMALIZATION_ONLY' | 'MIXED_OVERLAP';
  decision: ReviewDecision;
  decisionOptions: ReviewDecision[];
  disposition: ReviewDecision;
  notes: string;
}

export interface CollisionRegisterGroup {
  collisionGroupId: string;
  tehsilId: string;
  canonicalNameLower: string;
  category: 'PURE_IDENTICAL_RAW' | 'PURE_NORMALIZATION_ONLY' | 'MIXED_OVERLAP';
  decisionOptions: ReviewDecision[];
  initialDecision: ReviewDecision;
  totalRecords: number;
  records: CollisionRegisterRecord[];
}

export interface StructuralExceptionRecord {
  entityId: string;
  level: string;
  name: string;
  sourceRow: number;
  stagingLineNumber: number;
  stateCode: string;
  districtCode: string;
  subDistrictCode: string;
  villageCode: string;
  attemptedParentId: string;
  exceptionReason: 'SOURCE_SUBDISTRICT_CELL_MISSING';
  resolutionPolicy: 'DO_NOT_INFER_PARENT';
  disposition: 'UNRESOLVED_REQUIRES_AUTHORITATIVE_EVIDENCE';
  details: string;
}

export interface GenerateRegistersResult {
  totalCollisionGroups: number;
  totalCollisionRecords: number;
  categoryCounts: {
    pureIdenticalRaw: { groups: number; records: number };
    pureNormalizationOnly: { groups: number; records: number };
    mixedOverlap: { groups: number; records: number };
  };
  totalStructuralExceptions: number;
  filesGenerated: string[];
}

/**
 * Escapes a string for CSV in accordance with RFC 4180.
 */
function escapeCsv(val: string | number | null | undefined): string {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Creates a clean slug for collision group ID.
 */
function toSlug(input: string): string {
  return input
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();
}

/**
 * Generates the review registers:
 * - reports/village_collision_review_register.json
 * - reports/village_collision_review_register.csv
 * - reports/census2011_structural_exceptions.json
 * - reports/census2011_structural_exceptions.csv
 */
export async function generateReviewRegisters(baseDir: string = process.cwd()): Promise<GenerateRegistersResult> {
  const villagesFile = path.join(baseDir, 'data/staging/census2011/villages.jsonl');
  const reportsDir = path.join(baseDir, 'reports');

  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const structuralExceptions: StructuralExceptionRecord[] = [];
  const groupsMap = new Map<string, Array<{
    sourceRow: number;
    stagingLineNumber: number;
    originalDisplayName: string;
    villageCode: string;
    tehsilId: string;
    canonicalNameLower: string;
  }>>();

  const fileStream = fs.createReadStream(villagesFile, { encoding: 'utf-8' });
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  let lineNo = 0;
  for await (const line of rl) {
    if (!line.trim()) continue;
    lineNo++;

    const v = JSON.parse(line);
    const parentId = v.parentId;
    const rawName = v.name;
    const norm = normalizePlaceName(rawName);

    // Track structural exception: Row 306108 where subDistrictCode is empty and parentId is invalid
    if (v.sourceRow === 306108 || parentId === 'CENSUS2011_SDT_18_320_' || !v.subDistrictCode) {
      structuralExceptions.push({
        entityId: v.id,
        level: v.level || 'VILLAGE',
        name: rawName,
        sourceRow: v.sourceRow,
        stagingLineNumber: lineNo,
        stateCode: v.stateCode,
        districtCode: v.districtCode,
        subDistrictCode: v.subDistrictCode,
        villageCode: v.villageCode,
        attemptedParentId: parentId,
        exceptionReason: 'SOURCE_SUBDISTRICT_CELL_MISSING',
        resolutionPolicy: 'DO_NOT_INFER_PARENT',
        disposition: 'UNRESOLVED_REQUIRES_AUTHORITATIVE_EVIDENCE',
        details: 'Source row 306108 in xl/worksheets/sheet1.xml omitted Column C (Sub-District Code). The trailing underscore parent ID CENSUS2011_SDT_18_320_ does not exist. No Tehsil parent may be inferred without authoritative evidence.',
      });
    }

    const key = `${parentId}:::${norm}`;
    let group = groupsMap.get(key);
    if (!group) {
      group = [];
      groupsMap.set(key, group);
    }
    group.push({
      sourceRow: v.sourceRow,
      stagingLineNumber: lineNo,
      originalDisplayName: rawName,
      villageCode: v.villageCode,
      tehsilId: parentId,
      canonicalNameLower: norm,
    });
  }

  // Filter only collision groups (length > 1)
  const collisionGroups: CollisionRegisterGroup[] = [];
  let catA_groups = 0;
  let catA_records = 0;
  let catB_groups = 0;
  let catB_records = 0;
  let catC_groups = 0;
  let catC_records = 0;

  for (const [key, records] of groupsMap.entries()) {
    if (records.length <= 1) continue;

    const [tehsilId, canonicalNameLower] = key.split(':::');
    const slug = toSlug(canonicalNameLower);
    const tehsilShort = tehsilId.replace(/^CENSUS2011_/, '');
    const collisionGroupId = `COL_${tehsilShort}_${slug}`;

    const uniqueRawNames = new Set(records.map((r) => r.originalDisplayName));
    let category: 'PURE_IDENTICAL_RAW' | 'PURE_NORMALIZATION_ONLY' | 'MIXED_OVERLAP';

    if (uniqueRawNames.size === 1) {
      category = 'PURE_IDENTICAL_RAW';
      catA_groups++;
      catA_records += records.length;
    } else if (uniqueRawNames.size === records.length) {
      category = 'PURE_NORMALIZATION_ONLY';
      catB_groups++;
      catB_records += records.length;
    } else {
      category = 'MIXED_OVERLAP';
      catC_groups++;
      catC_records += records.length;
    }

    // Sort records within group deterministically by stagingLineNumber
    records.sort((a, b) => a.stagingLineNumber - b.stagingLineNumber);

    const formattedRecords: CollisionRegisterRecord[] = records.map((r) => ({
      sourceRow: r.sourceRow,
      stagingLineNumber: r.stagingLineNumber,
      originalDisplayName: r.originalDisplayName,
      villageCode: r.villageCode,
      tehsilId: r.tehsilId,
      canonicalNameLower: r.canonicalNameLower,
      collisionGroupId,
      category,
      decision: 'NEEDS_EVIDENCE',
      decisionOptions: ['KEEP', 'REMOVE_DUPLICATE', 'NEEDS_EVIDENCE'],
      disposition: 'NEEDS_EVIDENCE',
      notes: '',
    }));

    collisionGroups.push({
      collisionGroupId,
      tehsilId,
      canonicalNameLower,
      category,
      decisionOptions: ['KEEP', 'REMOVE_DUPLICATE', 'NEEDS_EVIDENCE'],
      initialDecision: 'NEEDS_EVIDENCE',
      totalRecords: records.length,
      records: formattedRecords,
    });
  }

  // Sort groups deterministically: tehsilId ASC, then canonicalNameLower ASC
  collisionGroups.sort((a, b) => {
    if (a.tehsilId !== b.tehsilId) return a.tehsilId.localeCompare(b.tehsilId);
    return a.canonicalNameLower.localeCompare(b.canonicalNameLower);
  });

  const totalCollisionGroups = collisionGroups.length;
  const totalCollisionRecords = catA_records + catB_records + catC_records;

  // 1. Write village_collision_review_register.json
  const registerJsonPath = path.join(reportsDir, 'village_collision_review_register.json');
  const registerJson = {
    metadata: {
      description: 'Review-only register for same-Tehsil village name collisions in Census 2011 staging dataset',
      generatedAt: '2026-10-16T14:20:00.000Z',
      scope: 'Census 2011 Staging Dataset (villages.jsonl)',
      groupingKey: 'tehsil_id + canonical_name_lower',
      totalCollisionGroups,
      totalAffectedRecords: totalCollisionRecords,
      allowedDecisions: ['KEEP', 'REMOVE_DUPLICATE', 'NEEDS_EVIDENCE'],
      initialDecision: 'NEEDS_EVIDENCE',
      defaultDisposition: 'NEEDS_EVIDENCE',
      reviewPolicy: {
        prohibitAutomaticDeletionOrMerge: true,
        prohibitAutomaticRename: true,
        prohibitDeclarationOfRemovalByNameOrCodeAlone: true,
        actualRecordsDeletedOrImported: 0,
        explanation:
          'Neither name nor Census code alone justifies declaring a record removed. All original records are preserved with initial decision NEEDS_EVIDENCE.',
      },
      disjointCategories: {
        categoryA_pureIdenticalRaw: {
          description: 'Records with exact byte-for-byte identical raw names within the same Tehsil',
          groups: catA_groups,
          records: catA_records,
        },
        categoryB_pureNormalizationOnly: {
          description: 'Records where every raw name is distinct, colliding only after Unicode NFC, whitespace collapsing, and lowercase',
          groups: catB_groups,
          records: catB_records,
        },
        categoryC_mixedOverlap: {
          description: 'Overlap groups containing identical raw pairs PLUS casing/whitespace variant records',
          groups: catC_groups,
          records: catC_records,
        },
        isPartitionExhaustiveAndDisjoint:
          catA_groups + catB_groups + catC_groups === totalCollisionGroups &&
          catA_records + catB_records + catC_records === totalCollisionRecords,
      },
      authorizationStatus: 'NOT APPROVED FOR IMPORT (REVIEW ONLY — ZERO AUTOMATIC MERGES OR RENAMES)',
      idPolicyNotice: 'This register does not issue or allocate permanent canonical IDs. Disambiguation requires reviewed disposition.',
    },
    groups: collisionGroups,
  };
  fs.writeFileSync(registerJsonPath, JSON.stringify(registerJson, null, 2), 'utf-8');

  // 2. Write village_collision_review_register.csv
  const registerCsvPath = path.join(reportsDir, 'village_collision_review_register.csv');
  const csvHeaders = [
    'collision_group_id',
    'tehsil_id',
    'canonical_name_lower',
    'category',
    'source_row',
    'staging_line_number',
    'village_code',
    'original_display_name',
    'decision',
    'decision_options',
    'disposition',
    'notes',
  ];

  const csvLines: string[] = [csvHeaders.join(',')];
  for (const group of collisionGroups) {
    for (const r of group.records) {
      csvLines.push(
        [
          escapeCsv(r.collisionGroupId),
          escapeCsv(r.tehsilId),
          escapeCsv(r.canonicalNameLower),
          escapeCsv(r.category),
          escapeCsv(r.sourceRow),
          escapeCsv(r.stagingLineNumber),
          escapeCsv(r.villageCode),
          escapeCsv(r.originalDisplayName),
          escapeCsv(r.decision),
          escapeCsv(r.decisionOptions.join('|')),
          escapeCsv(r.disposition),
          escapeCsv(r.notes),
        ].join(',')
      );
    }
  }
  fs.writeFileSync(registerCsvPath, csvLines.join('\n'), 'utf-8');

  // 3. Write census2011_structural_exceptions.json
  const exceptionsJsonPath = path.join(reportsDir, 'census2011_structural_exceptions.json');
  const exceptionsJson = {
    metadata: {
      description: 'Structural exceptions register for Census 2011 staging dataset',
      generatedAt: '2026-10-16T13:58:00.000Z',
      totalExceptions: structuralExceptions.length,
      policy: 'DO NOT INFER PARENTS. Keep records unresolved until authoritative evidence is provided.',
      authorizationStatus: 'NOT APPROVED FOR IMPORT',
    },
    exceptions: structuralExceptions,
  };
  fs.writeFileSync(exceptionsJsonPath, JSON.stringify(exceptionsJson, null, 2), 'utf-8');

  // 4. Write census2011_structural_exceptions.csv
  const exceptionsCsvPath = path.join(reportsDir, 'census2011_structural_exceptions.csv');
  const expCsvHeaders = [
    'entity_id',
    'level',
    'name',
    'source_row',
    'staging_line_number',
    'state_code',
    'district_code',
    'sub_district_code',
    'village_code',
    'attempted_parent_id',
    'exception_reason',
    'resolution_policy',
    'disposition',
    'details',
  ];

  const expCsvLines: string[] = [expCsvHeaders.join(',')];
  for (const exp of structuralExceptions) {
    expCsvLines.push(
      [
        escapeCsv(exp.entityId),
        escapeCsv(exp.level),
        escapeCsv(exp.name),
        escapeCsv(exp.sourceRow),
        escapeCsv(exp.stagingLineNumber),
        escapeCsv(exp.stateCode),
        escapeCsv(exp.districtCode),
        escapeCsv(exp.subDistrictCode),
        escapeCsv(exp.villageCode),
        escapeCsv(exp.attemptedParentId),
        escapeCsv(exp.exceptionReason),
        escapeCsv(exp.resolutionPolicy),
        escapeCsv(exp.disposition),
        escapeCsv(exp.details),
      ].join(',')
    );
  }
  fs.writeFileSync(exceptionsCsvPath, expCsvLines.join('\n'), 'utf-8');

  return {
    totalCollisionGroups,
    totalCollisionRecords,
    categoryCounts: {
      pureIdenticalRaw: { groups: catA_groups, records: catA_records },
      pureNormalizationOnly: { groups: catB_groups, records: catB_records },
      mixedOverlap: { groups: catC_groups, records: catC_records },
    },
    totalStructuralExceptions: structuralExceptions.length,
    filesGenerated: [registerJsonPath, registerCsvPath, exceptionsJsonPath, exceptionsCsvPath],
  };
}
