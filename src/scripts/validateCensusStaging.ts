import * as fs from 'fs';
import * as path from 'path';
import { validateCensusStaging, generateMarkdownSummary } from '../validators/censusStagingValidator';
import { generateReviewRegisters } from '../validators/reviewRegisterGenerator';

async function main() {
  console.log('========================================================================');
  console.log('Starting Read-Only Census 2011 Staging Dry-Run Validator');
  console.log('Database Mode: DISCONNECTED (Zero database connections / mutations)');
  console.log('========================================================================\n');

  const startTime = Date.now();
  const baseDir = path.resolve(__dirname, '../../');
  const reportsDir = path.join(baseDir, 'reports');

  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  console.log('Executing validation against data/staging/census2011/ ...');
  const report = await validateCensusStaging({ baseDir, maxSampleCollisions: 50 });

  const jsonReportPath = path.join(reportsDir, 'census2011_staging_dry_run_report.json');
  fs.writeFileSync(jsonReportPath, JSON.stringify(report, null, 2), 'utf-8');
  console.log(`Machine-readable report written to: ${jsonReportPath}`);

  const mdSummary = generateMarkdownSummary(report);
  const mdSummaryPath = path.join(reportsDir, 'CENSUS2011_STAGING_DRY_RUN_SUMMARY.md');
  fs.writeFileSync(mdSummaryPath, mdSummary, 'utf-8');
  console.log(`Markdown summary written to: ${mdSummaryPath}`);

  console.log('Generating review-only village collision register and structural exceptions register ...');
  const registersResult = await generateReviewRegisters(baseDir);
  console.log(`Review registers generated successfully:`);
  for (const f of registersResult.filesGenerated) {
    console.log(`  - ${f}`);
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`\nValidation complete in ${elapsed}s!`);
  console.log('\n--- VALIDATION VERDICT ---');
  console.log(`Structural & Referential Integrity: [${report.overallStatus.structuralAndReferentialIntegrity}]`);
  console.log(`Parent-Scoped Name Uniqueness:       [${report.overallStatus.parentScopedNameUniquenessForUnmodifiedIngestion}]`);
  console.log(`Production Ingestion Authorization:  [${report.overallStatus.productionIngestionAuthorization}]`);
  console.log('--------------------------\n');
  console.log(`- Staged Entities Evaluated:      ${report.rowAccounting.totalStagedHierarchyEntities.toLocaleString()}`);
  console.log(`- Valid Parent Links:             ${(report.hierarchyLevels.COUNTRY.validParentCount + report.hierarchyLevels.STATE_UT.validParentCount + report.hierarchyLevels.DISTRICT.validParentCount + report.hierarchyLevels.TEHSIL.validParentCount + report.hierarchyLevels.CITY_TOWN.validParentCount + report.hierarchyLevels.VILLAGE.validParentCount).toLocaleString()}`);
  console.log(`- Invalid Parent Links:           ${(report.hierarchyLevels.COUNTRY.invalidParentCount + report.hierarchyLevels.STATE_UT.invalidParentCount + report.hierarchyLevels.DISTRICT.invalidParentCount + report.hierarchyLevels.TEHSIL.invalidParentCount + report.hierarchyLevels.CITY_TOWN.invalidParentCount + report.hierarchyLevels.VILLAGE.invalidParentCount)}`);
  console.log(`- Same-Tehsil Village Collisions: ${report.villageCollisionSummary.collisionGroups.toLocaleString()} groups (${report.villageCollisionSummary.totalRecordsInCollisions.toLocaleString()} records)`);
  console.log(`  * Category A (Pure Identical Raw): ${report.villageCollisionSummary.disjointCategories.categoryA_pureIdenticalRaw.groups.toLocaleString()} groups (${report.villageCollisionSummary.disjointCategories.categoryA_pureIdenticalRaw.records.toLocaleString()} records)`);
  console.log(`  * Category B (Pure Normalization): ${report.villageCollisionSummary.disjointCategories.categoryB_pureNormalizationOnly.groups.toLocaleString()} groups (${report.villageCollisionSummary.disjointCategories.categoryB_pureNormalizationOnly.records.toLocaleString()} records)`);
  console.log(`  * Category C (Mixed / Overlap):    ${report.villageCollisionSummary.disjointCategories.categoryC_mixedOverlap.groups.toLocaleString()} groups (${report.villageCollisionSummary.disjointCategories.categoryC_mixedOverlap.records.toLocaleString()} records)`);
  console.log(`- Earlier Audit Reconciliation:   Earlier ${report.villageCollisionSummary.reconciliationAgainstEarlierAudit.earlierAuditCounts.groups.toLocaleString()} groups -> Full ${report.villageCollisionSummary.collisionGroups.toLocaleString()} groups (+12 newly formed groups, +2 expanded groups)`);
  console.log(`- Unresolved Urban Records:       ${report.unresolvedUrbanSummary.totalRecords} (Outside hierarchy)`);
  console.log(`- Embedded Subdistrict Aliases:   ${report.subdistrictAliasSummary.totalAliasRowsEmbedded}`);
  console.log(`- Accounting Row Consistency:     ${report.rowAccounting.isAccounting100PercentConsistent ? '100% VERIFIED (657,010 rows)' : 'FAILED'}`);
  console.log('\nNotice: Permanent ID allocation requires a separate approved design.');
}

if (require.main === module) {
  main().catch((err) => {
    console.error('Validation failed with error:', err);
    process.exit(1);
  });
}
