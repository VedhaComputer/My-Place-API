import { PlaceLevel } from '../../shared/constants';

export interface CensusPlaceName {
  language: string;
  name: string;
}

export interface Census2011PlaceDocument {
  _id: string; // Explicit string ID
  level: PlaceLevel;
  names: CensusPlaceName[];
  canonicalName: string;
  canonicalNameLower: string;
  parentId: string | null;
  censusYear: number;
  censusCode?: string;
  stateCode?: string;
  districtCode?: string;
  subDistrictCode?: string;
  villageCode?: string;
  townCode?: string;
  sourceRow?: number | null;
  metadata?: Record<string, unknown>;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface Census2011QuarantineDocument {
  _id: string;
  level: PlaceLevel | string;
  parentId: string | null;
  canonicalNameLower: string;
  collisionGroupId?: string;
  quarantineReason: string;
  status: 'PENDING_REVIEW' | 'RESOLVED_KEEP_SEPARATE' | 'CONFIRMED_DUPLICATE' | 'NEEDS_EVIDENCE' | 'EXCLUDED';
  record: Record<string, unknown>;
  quarantinedAt: Date;
}

export interface Census2011UrbanSummaryDocument {
  _id: string;
  sourceRow: number;
  stateCode: string;
  districtCode: string;
  subDistrictCode: string;
  code: string;
  name: string;
  rawName: string;
  entityType: string;
  reason: string;
  intendedParentLevel: string;
  actualSourceParentFound: boolean;
  metadata?: Record<string, unknown>;
}

export interface CensusRecordInput {
  level: PlaceLevel | string;
  name: string;
  rawName?: string;
  stateCode?: string;
  districtCode?: string;
  subDistrictCode?: string;
  villageCode?: string;
  townCode?: string;
  sourceRow?: number | null;
  parentId?: string | null;
}

export interface CensusIdAllocationResult {
  success: boolean;
  id?: string;
  error?: string;
  quarantineReason?: string;
}

export interface Census2011ImportPlan {
  totalSourceEntities: number;
  acceptedCandidateCount: number;
  quarantinedCount: number;
  urbanAuxiliaryCount: number;
  structuralExceptionsCount: number;
  invalidIdsCount: number;
  danglingParentCount: number;
  parentScopedCollisionCount: number;
  status: 'PASS' | 'FAIL';
  breakdownByLevel: Record<string, number>;
  idFingerprint: string;
  timestamp: string;
  failureReasons: string[];
}

export interface Census2011DryRunOptions {
  stagingDir?: string;
  reportsDir?: string;
  maxVillages?: number;
}

export interface Census2011FilterQuery {
  parentId?: string;
  level?: PlaceLevel | string;
  censusCode?: string;
  search?: string;
  page?: number | string;
  limit?: number | string;
}
