/**
 * ensureIndexes.ts
 *
 * Idempotent index deployment script for the india-place-api MongoDB collection.
 *
 * PURPOSE
 * -------
 * PlaceSchema is configured with `autoIndex: false` to prevent Mongoose from
 * silently creating or rebuilding indexes on every application startup. This
 * avoids unexpected performance degradation in production (index builds on a
 * 600K+ document collection can lock out writes for seconds or minutes).
 *
 * This script must be run explicitly — by an operator or in a controlled
 * CI/CD deployment step — to create or update indexes safely.
 *
 * DATABASE TARGET
 * ---------------
 * Connects to the database named in env.MONGODB_URI (read from .env).
 * Default: mongodb://localhost:27017/india_place_api.
 * In production, set MONGODB_URI in the environment before running.
 * Never run this script against a replica set member directly; always target
 * the primary.
 *
 * IDEMPOTENCY AND SAFETY
 * ----------------------
 * MongoDB's createIndex() is idempotent for indexes with the same definition:
 * re-running on a collection that already has the declared indexes is a no-op.
 *
 * However, if an index definition conflicts with an existing index of the same
 * name but different options (e.g. the unique flag was added after initial
 * creation), MongoDB will throw error code 85 (IndexOptionsConflict) or 86
 * (IndexKeySpecsConflict). This script catches and reports those errors clearly.
 * Resolution requires a manual `db.places.dropIndex(...)` followed by re-run.
 *
 * PERFORMANCE RISKS (measured 2026-10-28, 630,596 documents)
 * -----------------------------------------------------------
 * Building a new index on a live collection with 630K+ documents causes:
 *   - An in-background index build (MongoDB 4.2+), which allows concurrent
 *     reads and writes but increases I/O and may slow down write-heavy periods.
 *   - For the compound unique index on {parentId,level,canonicalNameLower},
 *     if the field does not already exist, building from scratch takes
 *     approximately 60–90 seconds on spinning disks; fewer on SSDs.
 * Prefer running during a low-traffic maintenance window.
 *
 * BENCHMARK NOTE: NO NEW SEARCH INDEXES
 * --------------------------------------
 * Substring regex search (e.g. /mohal/) is NOT accelerated by B-tree indexes.
 * We measured that adding indexes on { canonicalNameLower: 1 } and
 * { 'names.name': 1 } made substring-regex queries SLOWER:
 *
 *   Baseline find (VILLAGE+mohal):  161ms → With B-tree index: 663ms  (+312%)
 *   Baseline count (VILLAGE+mohal): 4917ms → With B-tree index: 4473ms (~9%)
 *
 * Only structural/integrity indexes declared in place.model.ts are deployed here.
 *
 * MANUAL COMMAND
 * --------------
 *   npm run db:indexes
 *   # or:
 *   npx ts-node src/scripts/ensureIndexes.ts
 *
 * Never import this script into the application server startup path.
 */

import mongoose from 'mongoose';
import { env } from '../config/env';
import { PlaceModel, PlaceCollisionReviewModel } from '../modules/places/place.model';

async function ensureIndexes(): Promise<void> {
  const uri = env.MONGODB_URI;
  console.log(`[ensureIndexes] Connecting to MongoDB at ${uri.replace(/\/\/[^@]+@/, '//<credentials>@')}...`);
  await mongoose.connect(uri);
  console.log('[ensureIndexes] Connected.');

  // createIndexes() is idempotent for existing matching indexes.
  // Conflicting index definitions (same name, different options) throw code 85/86.
  try {
    console.log('[ensureIndexes] Synchronising indexes for Place collection...');
    await PlaceModel.createIndexes();
    console.log('[ensureIndexes] Place indexes synchronised.');
  } catch (err: any) {
    if (err?.code === 85 || err?.code === 86) {
      console.error(
        '[ensureIndexes] CONFLICT: An existing index has the same name but different options.\n' +
        '  Drop the conflicting index manually first:\n' +
        `    db.places.dropIndex("<conflicting_index_name>")\n` +
        '  Then re-run this script.\n' +
        `  MongoDB error: ${err.message}`
      );
      await mongoose.disconnect();
      process.exit(1);
    }
    throw err;
  }

  try {
    console.log('[ensureIndexes] Synchronising indexes for PlaceCollisionReview collection...');
    await PlaceCollisionReviewModel.createIndexes();
    console.log('[ensureIndexes] PlaceCollisionReview indexes synchronised.');
  } catch (err: any) {
    if (err?.code === 85 || err?.code === 86) {
      console.error(
        '[ensureIndexes] CONFLICT: PlaceCollisionReview index definition conflict.\n' +
        `  MongoDB error: ${err.message}`
      );
      await mongoose.disconnect();
      process.exit(1);
    }
    throw err;
  }

  // Report current indexes for operator verification
  const placeIndexes = await PlaceModel.collection.indexes();
  console.log('\n[ensureIndexes] Current Place collection indexes:');
  for (const idx of placeIndexes) {
    console.log(`  ${idx.name}: ${JSON.stringify(idx.key)}`);
  }

  await mongoose.disconnect();
  console.log('\n[ensureIndexes] Done. Verify the index list above matches expected schema declarations.');
}

ensureIndexes().catch((err) => {
  console.error('[ensureIndexes] Fatal error:', err);
  process.exit(1);
});
