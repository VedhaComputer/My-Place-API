import {
  PlaceLevel,
  ReviewTicketStatus,
  VerificationStatus,
  VerificationDecision,
  UserRole,
} from '../../shared/constants';

export interface PlaceName {
  language: string; // BCP 47 baseName, e.g. "hi", "en", "pa-Guru"
  name: string;     // Unicode NFC normalized
}

export interface PlaceVerificationAuditEntry {
  userId: string;
  userEmail: string;
  userRole: UserRole;
  decision: VerificationDecision;
  evidence: string;
  comments?: string;
  timestamp: Date;
  previousStatus: VerificationStatus;
  newStatus: VerificationStatus;
}

export interface PlaceDocument {
  _id: string;
  code?: string;               // Independent public API code (e.g. IN-DST-A7F92B1C)
  level: PlaceLevel;
  names: PlaceName[];
  canonicalName: string;      // Independent canonical string, Unicode NFC
  canonicalNameLower: string; // NFC lower-cased for index uniqueness
  parentId: string | null;    // Parent place ID (null only for COUNTRY)
  verificationStatus: VerificationStatus;
  createdBy: string;          // User ID of creator
  verifiedBy?: string | null; // Last verifier user ID
  verifiedAt?: Date | null;   // Timestamp when verified
  verificationHistory: PlaceVerificationAuditEntry[];
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface PlaceCollisionReviewDocument {
  _id: string;
  collisionFingerprint: string;
  parentId: string | null;
  level: PlaceLevel;
  canonicalNameLower: string;
  attemptedNames: PlaceName[];
  attemptCount: number;
  status: ReviewTicketStatus;
  firstAttemptedAt: Date;
  lastAttemptedAt: Date;
  resolvedAt?: Date;
  resolvedBy?: string;
  resolutionNotes?: string;
}

export interface PlaceFilterQuery {
  parentId?: string;
  level?: PlaceLevel;
  search?: string;
  language?: string;
  code?: string;
  verificationStatus?: VerificationStatus;
  page?: string;
  limit?: string;
}
