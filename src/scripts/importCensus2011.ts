import fs from 'fs';
import path from 'path';
import readline from 'readline';
import mongoose from 'mongoose';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/india_place_api';
import { PLACE_LEVELS, PlaceLevel } from '../shared/constants';
import { toCanonicalLower, toNFC } from '../shared/utils/unicode';
import { Census2011PlaceModel, Census2011PlaceSchema } from '../modules/census2011/census2011.model';
import { Census2011IdAllocator } from '../modules/census2011/idAllocator';

export interface ImportMetrics {
  startTime: string;
  endTime: string;
  elapsedMs: number;
  preExistingRecords: number;
  newlyInserted: number;
  idempotentSkips: number;
  failedCount: number;
  duplicateIdsCount: number;
  unresolvedParentsCount: number;
  finalDocumentCount: number;
  breakdownByLevel: Record<string, number>;
  livePlacesCount: number;
  verified23ReadBackCount: number;
  quarantinedPreservedCount: number;
}

export async function runCensus2011Import(): Promise<ImportMetrics> {
  const startTime = new Date();
  const baseDir = process.cwd();
  const stagingDir = path.join(baseDir, 'data/staging/census2011');
  const reportsDir = path.join(baseDir, 'reports');

  console.log('=== CENSUS 2011 PERSISTENT IMPORT TO MONGODB ===');
  console.log(`Connecting to database: ${MONGODB_URI}...`);
  await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
  console.log('✅ Connected to MongoDB');

  const db = mongoose.connection.db;
  if (!db) {
    throw new Error('Database connection object is undefined');
  }

  const placesCollection = db.collection('places_census2011');
  const livePlacesCollection = db.collection('places');

  // Pre-flight checks
  const preExistingRecords = await placesCollection.countDocuments();
  const preLiveCount = await livePlacesCollection.countDocuments();
  console.log(`Pre-existing records in places_census2011: ${preExistingRecords}`);
  console.log(`Pre-existing records in live places: ${preLiveCount}`);

  // Ensure indexes are built
  console.log('Ensuring schema indexes on places_census2011...');
  await Census2011PlaceModel.syncIndexes();
  console.log('✅ Schema indexes ensured');

  // 1. Pre-load Collision, Duplicate Code, and Exception Registers
  const reviewJsonPath = path.join(reportsDir, 'village_collision_authoritative_evidence_review.json');
  const structuralExceptionsJsonPath = path.join(reportsDir, 'census2011_structural_exceptions.json');
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
  if (fs.existsSync(structuralExceptionsJsonPath)) {
    const excData = JSON.parse(fs.readFileSync(structuralExceptionsJsonPath, 'utf-8'));
    if (Array.isArray(excData.exceptions)) {
      for (const exc of excData.exceptions) {
        if (exc.sourceRow) {
          structuralExceptionsRowSet.add(exc.sourceRow);
        }
      }
    }
  }

  console.log(`Quarantine sets loaded:`);
  console.log(`  Collision records held in quarantine: ${collisionRowSet.size}`);
  console.log(`  Verified KEEP_SEPARATE eligible for import: ${keepSeparateRowSet.size}`);
  console.log(`  Duplicate village codes held in quarantine: ${duplicateCodeRowSet.size}`);
  console.log(`  Structural exceptions held in quarantine: ${structuralExceptionsRowSet.size}`);

  const knownParentIds = new Set<string>();
  let newlyInserted = 0;
  let idempotentSkips = 0;
  let failedCount = 0;
  const BATCH_SIZE = 5000;

  // Helper to build document
  const buildDoc = (candidate: {
    id: string;
    level: PlaceLevel;
    name: string;
    rawName?: string;
    parentId: string | null;
    stateCode?: string | null;
    districtCode?: string | null;
    subDistrictCode?: string | null;
    villageCode?: string | null;
    townCode?: string | null;
    sourceRow?: number | null;
    metadata?: Record<string, any>;
  }) => {
    const canonicalNFC = toNFC(candidate.name);
    const canonicalLower = toCanonicalLower(canonicalNFC);
    const censusCode =
      candidate.villageCode ||
      candidate.townCode ||
      candidate.subDistrictCode ||
      candidate.districtCode ||
      candidate.stateCode ||
      null;

    return {
      _id: candidate.id,
      level: candidate.level,
      names: [
        {
          language: 'en',
          name: candidate.rawName || candidate.name,
        },
      ],
      canonicalName: candidate.name,
      canonicalNameLower: canonicalLower,
      parentId: candidate.parentId,
      censusYear: 2011,
      censusCode,
      stateCode: candidate.stateCode || null,
      districtCode: candidate.districtCode || null,
      subDistrictCode: candidate.subDistrictCode || null,
      villageCode: candidate.villageCode || null,
      townCode: candidate.townCode || null,
      sourceRow: candidate.sourceRow || null,
      metadata: candidate.metadata || { source: 'Census 2011 Master Ingestion' },
    };
  };

  // Helper to execute bulk upsert
  const executeBatch = async (docs: any[]) => {
    if (docs.length === 0) return;
    const ops = docs.map((doc) => ({
      updateOne: {
        filter: { _id: doc._id },
        update: { $set: doc },
        upsert: true,
      },
    }));

    const result = await placesCollection.bulkWrite(ops, { ordered: false });
    newlyInserted += result.upsertedCount;
    idempotentSkips += result.matchedCount;
  };

  // Step 1: Ingest Tiers 0 to 4
  console.log('Ingesting Tiers 0 to 4 (Country, States, Districts, Tehsils, Towns)...');
  const upperDocs: any[] = [];

  // Country
  const countryPath = path.join(stagingDir, 'country.json');
  if (fs.existsSync(countryPath)) {
    const countries = JSON.parse(fs.readFileSync(countryPath, 'utf-8'));
    for (const c of countries) {
      upperDocs.push(
        buildDoc({
          id: c.id,
          level: PLACE_LEVELS.COUNTRY,
          name: c.name,
          rawName: c.rawName,
          parentId: c.parentId,
        })
      );
      knownParentIds.add(c.id);
    }
  }

  // States
  const statesPath = path.join(stagingDir, 'states.json');
  if (fs.existsSync(statesPath)) {
    const states = JSON.parse(fs.readFileSync(statesPath, 'utf-8'));
    for (const s of states) {
      upperDocs.push(
        buildDoc({
          id: s.id,
          level: PLACE_LEVELS.STATE_UT,
          name: s.name,
          rawName: s.rawName,
          parentId: s.parentId,
          stateCode: s.stateCode,
          sourceRow: s.sourceRow,
        })
      );
      knownParentIds.add(s.id);
    }
  }

  // Districts
  const districtsPath = path.join(stagingDir, 'districts.json');
  if (fs.existsSync(districtsPath)) {
    const districts = JSON.parse(fs.readFileSync(districtsPath, 'utf-8'));
    for (const d of districts) {
      upperDocs.push(
        buildDoc({
          id: d.id,
          level: PLACE_LEVELS.DISTRICT,
          name: d.name,
          rawName: d.rawName,
          parentId: d.parentId,
          stateCode: d.stateCode,
          districtCode: d.districtCode,
          sourceRow: d.sourceRow,
        })
      );
      knownParentIds.add(d.id);
    }
  }

  // Tehsils
  const tehsilsPath = path.join(stagingDir, 'tehsils.json');
  if (fs.existsSync(tehsilsPath)) {
    const tehsils = JSON.parse(fs.readFileSync(tehsilsPath, 'utf-8'));
    for (const t of tehsils) {
      upperDocs.push(
        buildDoc({
          id: t.id,
          level: PLACE_LEVELS.TEHSIL,
          name: t.name,
          rawName: t.rawName,
          parentId: t.parentId,
          stateCode: t.stateCode,
          districtCode: t.districtCode,
          subDistrictCode: t.subDistrictCode,
          sourceRow: t.sourceRow,
        })
      );
      knownParentIds.add(t.id);
    }
  }

  // Towns
  const townsPath = path.join(stagingDir, 'towns.json');
  if (fs.existsSync(townsPath)) {
    const towns = JSON.parse(fs.readFileSync(townsPath, 'utf-8'));
    for (const tw of towns) {
      upperDocs.push(
        buildDoc({
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
        })
      );
    }
  }

  await executeBatch(upperDocs);
  console.log(`✅ Ingested Tiers 0 to 4: ${upperDocs.length} entities`);

  // Step 2: Stream and Ingest Tier 5 Villages
  console.log('Streaming Tier 5 Villages from villages.jsonl...');
  const villagesPath = path.join(stagingDir, 'villages.jsonl');
  let villageBuffer: any[] = [];
  let totalVillagesSeen = 0;
  let totalVillagesIngested = 0;
  let unresolvedParentsCount = 0;

  const fileStream = fs.createReadStream(villagesPath);
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  for await (const line of rl) {
    if (!line.trim()) continue;
    totalVillagesSeen++;

    const v = JSON.parse(line);

    // Skip quarantined collision records (excluding the 23 verified KEEP_SEPARATE records)
    if (v.sourceRow && collisionRowSet.has(v.sourceRow)) {
      continue;
    }

    // Skip duplicate code candidates
    if (v.sourceRow && duplicateCodeRowSet.has(v.sourceRow)) {
      continue;
    }

    // Skip structural exceptions
    if (v.sourceRow && structuralExceptionsRowSet.has(v.sourceRow)) {
      continue;
    }

    // Validate parent existence
    if (!v.parentId || !knownParentIds.has(v.parentId)) {
      unresolvedParentsCount++;
      failedCount++;
      continue;
    }

    villageBuffer.push(
      buildDoc({
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
      })
    );
    totalVillagesIngested++;

    if (villageBuffer.length >= BATCH_SIZE) {
      await executeBatch(villageBuffer);
      villageBuffer = [];
      if (totalVillagesIngested % 50000 === 0) {
        console.log(`   Processed ${totalVillagesIngested} eligible villages...`);
      }
    }
  }

  if (villageBuffer.length > 0) {
    await executeBatch(villageBuffer);
    villageBuffer = [];
  }

  console.log(`✅ Completed streaming villages. Total ingested: ${totalVillagesIngested}`);

  // Step 3: Real Database Read-Back Verification
  console.log('\n=== REAL DATABASE READ-BACK VERIFICATION ===');
  const finalDocumentCount = await placesCollection.countDocuments();
  const livePlacesCount = await livePlacesCollection.countDocuments();

  const levelCounts = await placesCollection
    .aggregate([{ $group: { _id: '$level', count: { $sum: 1 } } }])
    .toArray();

  const breakdownByLevel: Record<string, number> = {};
  for (const item of levelCounts) {
    breakdownByLevel[item._id] = item.count;
  }

  // Check 23 KEEP_SEPARATE records read-back
  let verified23ReadBackCount = 0;
  for (const sRow of keepSeparateRowSet) {
    const found = await placesCollection.findOne({ sourceRow: sRow, level: PLACE_LEVELS.VILLAGE });
    if (found) {
      verified23ReadBackCount++;
    }
  }

  const endTime = new Date();
  const elapsedMs = endTime.getTime() - startTime.getTime();

  const metrics: ImportMetrics = {
    startTime: startTime.toISOString(),
    endTime: endTime.toISOString(),
    elapsedMs,
    preExistingRecords,
    newlyInserted,
    idempotentSkips,
    failedCount,
    duplicateIdsCount: 0,
    unresolvedParentsCount,
    finalDocumentCount,
    breakdownByLevel,
    livePlacesCount,
    verified23ReadBackCount,
    quarantinedPreservedCount: collisionRowSet.size + duplicateCodeRowSet.size + structuralExceptionsRowSet.size,
  };

  console.log(`Final places_census2011 count: ${finalDocumentCount}`);
  console.log(`Live places count: ${livePlacesCount}`);
  console.log(`23 KEEP_SEPARATE verified in DB: ${verified23ReadBackCount} / 23`);
  console.log(`Breakdown:`, breakdownByLevel);
  console.log(`Elapsed time: ${Math.round(elapsedMs / 1000)}s`);

  await mongoose.disconnect();
  console.log('🔌 Disconnected from MongoDB');

  return metrics;
}

if (require.main === module) {
  runCensus2011Import()
    .then((metrics) => {
      console.log('\nImport execution completed successfully.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('\nFatal import execution error:', err);
      process.exit(1);
    });
}
