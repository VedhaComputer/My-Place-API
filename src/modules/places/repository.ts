import crypto from 'crypto';
import { PlaceModel, PlaceCollisionReviewModel } from './place.model';
import {
  PlaceDocument,
  PlaceCollisionReviewDocument,
  PlaceFilterQuery,
  PlaceVerificationAuditEntry,
} from './types';
import {
  PLACE_LEVELS,
  PlaceLevel,
  REVIEW_TICKET_STATUS,
  ReviewTicketStatus,
  VALID_PARENT_LEVEL,
  VERIFICATION_STATUS,
  VerificationStatus,
  VERIFICATION_DECISION,
  VerificationDecision,
  USER_ROLES,
  UserRole,
  hasMinimumRole,
} from '../../shared/constants';
import {
  ConflictError,
  HierarchyError,
  NotFoundError,
  BusinessRuleError,
  ValidationError,
} from '../../shared/errors/AppError';
import { toCanonicalLower, toNFC } from '../../shared/utils/unicode';
import { generateInternalPlaceId, generateApiCode } from '../../shared/utils/identity';
import { AuthenticatedUser } from '../../middleware/authenticate';

/**
 * Authoritatively computes verification status from audit history.
 */
export function computeVerificationStatus(
  history: PlaceVerificationAuditEntry[]
): {
  status: VerificationStatus;
  verifiedBy: string | null;
  verifiedAt: Date | null;
} {
  if (!history || history.length === 0) {
    return {
      status: VERIFICATION_STATUS.PENDING_VERIFICATION,
      verifiedBy: null,
      verifiedAt: null,
    };
  }

  const latest = history[history.length - 1];

  if (latest.decision === VERIFICATION_DECISION.REJECT) {
    return {
      status: VERIFICATION_STATUS.REJECTED,
      verifiedBy: null,
      verifiedAt: null,
    };
  }

  if (latest.decision === VERIFICATION_DECISION.NEEDS_REVIEW) {
    return {
      status: VERIFICATION_STATUS.NEEDS_REVIEW,
      verifiedBy: null,
      verifiedAt: null,
    };
  }

  if (latest.decision === VERIFICATION_DECISION.VERIFY) {
    if (hasMinimumRole(latest.userRole, USER_ROLES.REVIEWER)) {
      return {
        status: VERIFICATION_STATUS.VERIFIED,
        verifiedBy: latest.userId,
        verifiedAt: latest.timestamp,
      };
    }

    const positiveVotes = history.filter((e) => e.decision === VERIFICATION_DECISION.VERIFY);
    if (positiveVotes.length >= 2) {
      return {
        status: VERIFICATION_STATUS.VERIFIED,
        verifiedBy: latest.userId,
        verifiedAt: latest.timestamp,
      };
    }

    return {
      status: VERIFICATION_STATUS.PENDING_VERIFICATION,
      verifiedBy: null,
      verifiedAt: null,
    };
  }

  return {
    status: VERIFICATION_STATUS.PENDING_VERIFICATION,
    verifiedBy: null,
    verifiedAt: null,
  };
}

export enum DuplicateKeyType {
  NAME_COLLISION = 'NAME_COLLISION',
  CODE_COLLISION = 'CODE_COLLISION',
  ID_COLLISION = 'ID_COLLISION',
  UNKNOWN = 'UNKNOWN',
}

export const MAX_CODE_RETRIES = 5;

/**
 * Accurately classifies MongoDB duplicate-key errors (E11000) using index metadata.
 */
export function classifyDuplicateKeyError(err: any): DuplicateKeyType {
  if (!err || (err.code !== 11000 && err.code !== '11000')) {
    return DuplicateKeyType.UNKNOWN;
  }

  // 1. Inspect keyPattern (authoritative in MongoDB/Mongoose)
  if (err.keyPattern && typeof err.keyPattern === 'object') {
    const keys = Object.keys(err.keyPattern);
    if (keys.length === 1 && keys[0] === 'code') {
      return DuplicateKeyType.CODE_COLLISION;
    }
    if (keys.length === 1 && keys[0] === '_id') {
      return DuplicateKeyType.ID_COLLISION;
    }
    if (
      err.keyPattern.canonicalNameLower !== undefined ||
      (err.keyPattern.parentId !== undefined && err.keyPattern.level !== undefined)
    ) {
      return DuplicateKeyType.NAME_COLLISION;
    }
  }

  // 2. Inspect keyValue
  if (err.keyValue && typeof err.keyValue === 'object') {
    const keys = Object.keys(err.keyValue);
    if (keys.length === 1 && keys[0] === 'code') {
      return DuplicateKeyType.CODE_COLLISION;
    }
    if (keys.length === 1 && keys[0] === '_id') {
      return DuplicateKeyType.ID_COLLISION;
    }
    if (err.keyValue.canonicalNameLower !== undefined) {
      return DuplicateKeyType.NAME_COLLISION;
    }
  }

  // 3. Fallback: Parse error message string
  if (typeof err.message === 'string') {
    if (err.message.includes('code_1') || err.message.includes('dup key: { code:')) {
      return DuplicateKeyType.CODE_COLLISION;
    }
    if (err.message.includes('_id_') || err.message.includes('dup key: { _id:')) {
      return DuplicateKeyType.ID_COLLISION;
    }
    if (
      err.message.includes('canonicalNameLower') ||
      err.message.includes('parentId_1_level_1_canonicalNameLower_1')
    ) {
      return DuplicateKeyType.NAME_COLLISION;
    }
  }

  return DuplicateKeyType.UNKNOWN;
}

export class PlaceRepository {
  private inMemoryMode = false;
  private inMemoryPlaces = new Map<string, PlaceDocument>();
  private inMemoryTickets = new Map<string, PlaceCollisionReviewDocument>();

  public enableInMemoryMode(initialPlaces: PlaceDocument[] = []): void {
    this.inMemoryMode = true;
    this.inMemoryPlaces.clear();
    this.inMemoryTickets.clear();
    for (const p of initialPlaces) {
      this.inMemoryPlaces.set(p._id, { ...p });
    }
  }

  public disableInMemoryMode(): void {
    this.inMemoryMode = false;
    this.inMemoryPlaces.clear();
    this.inMemoryTickets.clear();
  }

  public isInMemoryModeEnabled(): boolean {
    return this.inMemoryMode;
  }

  private isCodeTakenInMemory(code: string): boolean {
    for (const p of this.inMemoryPlaces.values()) {
      if (p.code === code) return true;
    }
    return false;
  }

  /**
   * Generates a deterministic SHA256 collision fingerprint for the unique natural constraint.
   */
  public generateFingerprint(parentId: string | null, level: string, canonicalNameLower: string): string {
    const parentKey = parentId ?? 'ROOT';
    return crypto.createHash('sha256').update(`${parentKey}:${level}:${canonicalNameLower}`).digest('hex');
  }

  public async findById(id: string): Promise<PlaceDocument | null> {
    if (this.inMemoryMode) {
      const byId = this.inMemoryPlaces.get(id);
      if (byId) return { ...byId };
      // Also check if lookup was by code
      for (const p of this.inMemoryPlaces.values()) {
        if (p.code === id) return { ...p };
      }
      return null;
    }
    return PlaceModel.findOne({ $or: [{ _id: id }, { code: id }] }).lean<PlaceDocument>();
  }

  public async findByCode(code: string): Promise<PlaceDocument | null> {
    if (this.inMemoryMode) {
      for (const p of this.inMemoryPlaces.values()) {
        if (p.code === code) return { ...p };
      }
      return null;
    }
    return PlaceModel.findOne({ code }).lean<PlaceDocument>();
  }

  public async findChildren(parentId: string): Promise<PlaceDocument[]> {
    if (this.inMemoryMode) {
      const children: PlaceDocument[] = [];
      for (const p of this.inMemoryPlaces.values()) {
        if (p.parentId === parentId) {
          children.push({ ...p });
        }
      }
      return children;
    }
    return PlaceModel.find({ parentId }).lean<PlaceDocument[]>();
  }

  public async query(filter: PlaceFilterQuery): Promise<{ data: PlaceDocument[]; total: number }> {
    if (this.inMemoryMode) {
      let filtered = Array.from(this.inMemoryPlaces.values());

      if (filter.parentId !== undefined) {
        filtered = filtered.filter((p) => p.parentId === filter.parentId);
      }
      if (filter.level !== undefined) {
        filtered = filtered.filter((p) => p.level === filter.level);
      }
      if (filter.code !== undefined) {
        filtered = filtered.filter((p) => p.code === filter.code);
      }
      if (filter.verificationStatus !== undefined) {
        filtered = filtered.filter((p) => p.verificationStatus === filter.verificationStatus);
      }
      if (filter.language !== undefined) {
        filtered = filtered.filter((p) => p.names.some((n) => n.language === filter.language));
      }
      if (filter.search !== undefined) {
        const lowerSearch = toCanonicalLower(filter.search);
        filtered = filtered.filter(
          (p) =>
            p.canonicalNameLower.includes(lowerSearch) ||
            p.names.some((n) => n.name.toLowerCase().includes(filter.search!.toLowerCase()))
        );
      }

      const total = filtered.length;
      const page = Math.max(1, Number(filter.page) || 1);
      const limit = Math.min(100, Math.max(1, Number(filter.limit) || 20));
      const skip = (page - 1) * limit;
      const data = filtered.slice(skip, skip + limit).map((p) => ({ ...p }));

      return { data, total };
    }

    const queryObj: Record<string, unknown> = {};

    if (filter.parentId) queryObj.parentId = filter.parentId;
    if (filter.level) queryObj.level = filter.level;
    if (filter.code) queryObj.code = filter.code;
    if (filter.verificationStatus) queryObj.verificationStatus = filter.verificationStatus;

    if (filter.search) {
      // canonicalNameLower is NFC-lowercased on write (via toCanonicalLower), so no
      // $options:'i' is needed — the search term is also lowercased before regex construction.
      // names.name is stored NFC-normalised but NOT lowercased, so $options:'i' is required
      // there. The names.name branch is retained to support multilingual names (e.g. Hindi,
      // Punjabi) whose script characters do not appear in canonicalNameLower.
      const lower = toCanonicalLower(filter.search);
      queryObj.$or = [
        { canonicalNameLower: { $regex: lower } },
        { 'names.name': { $regex: filter.search, $options: 'i' } },
      ];
    }

    if (filter.language) {
      queryObj['names.language'] = filter.language;
    }

    const page = Math.max(1, Number(filter.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(filter.limit) || 20));
    const skip = (page - 1) * limit;

    // Hybrid find / countDocuments strategy:
    //
    // PAGE 1 (skip === 0):
    //   Run find() sequentially. If data.length < limit, we know total exactly:
    //   total = data.length (no docs beyond these on page 1 → no countDocuments needed).
    //   This eliminates countDocuments entirely for most narrow searches.
    //
    //   Short-circuit is exact ONLY when skip === 0:
    //     total = 0 + data.length — mathematically provable, no remaining pages.
    //   It is NOT safe for skip > 0: an empty final page gives skip + 0 > actual_total.
    //   E.g. 154 results, page=9 (skip=160), 0 returned → skip + 0 = 160 ≠ 154.
    //
    // LATER PAGES (skip > 0):
    //   Run find() and countDocuments() concurrently via Promise.all — same total wall
    //   time as max(find_time, count_time). The short-circuit cannot be used safely here,
    //   and sequential execution would add find_time + count_time unnecessarily.
    //
    // Measured on 630,596 documents (mohal + VILLAGE, 154 results):
    //   Page 1 short-circuit:  find=103ms | count=skipped | total=103ms
    //   Page 1 full (no s-c):  find=103ms | count=1,575ms | total=1,678ms
    //   Page 8 parallel:       max(find~160ms, count~1,575ms) ≈ 1,600ms (concurrent)
    //   Page 8 sequential:     find=3,365ms + count=2,769ms = 6,134ms  ← avoided
    let data: PlaceDocument[];
    let total: number;

    if (skip === 0) {
      // Page 1: sequential with short-circuit
      data = await PlaceModel.find(queryObj).skip(0).limit(limit).lean<PlaceDocument[]>();
      total = data.length < limit
        ? data.length                                // exact — no countDocuments needed
        : await PlaceModel.countDocuments(queryObj); // full page — count for pagination UI
    } else {
      // Later pages: parallel — find and count are independent queries
      [data, total] = await Promise.all([
        PlaceModel.find(queryObj).skip(skip).limit(limit).lean<PlaceDocument[]>(),
        PlaceModel.countDocuments(queryObj),
      ]);
    }

    return { data, total };
  }

  public async createPlace(doc: {
    level: PlaceLevel;
    canonicalName: string;
    names: Array<{ language: string; name: string }>;
    parentId?: string | null;
    metadata?: Record<string, unknown>;
    createdBy: string;
    _id?: string;
    code?: string;
  }): Promise<PlaceDocument> {
    // 1. Hierarchy Validation
    const parentId = doc.parentId ?? null;
    const allowedParents = VALID_PARENT_LEVEL[doc.level];

    if (allowedParents === null && parentId !== null) {
      throw new HierarchyError(`Root level ${doc.level} cannot have a parentId`);
    }

    if (allowedParents !== null) {
      if (!parentId) {
        throw new HierarchyError(`Level ${doc.level} requires a valid parentId`);
      }
      const parent = await this.findById(parentId);
      if (!parent) {
        throw new NotFoundError(`Parent place with ID ${parentId}`);
      }
      if (!allowedParents.includes(parent.level)) {
        throw new HierarchyError(
          `Invalid parent level ${parent.level} for ${doc.level}. Expected one of: ${allowedParents.join(', ')}`
        );
      }
    }

    const canonicalNameNFC = toNFC(doc.canonicalName);
    const canonicalNameLower = toCanonicalLower(canonicalNameNFC);

    // 2. Duplicate scope check: Names are NOT identifiers; identical names under different
    // parents are allowed. However, duplicates under the SAME parent and SAME level are rejected.
    if (this.inMemoryMode) {
      for (const existing of this.inMemoryPlaces.values()) {
        if (
          existing.parentId === parentId &&
          existing.level === doc.level &&
          existing.canonicalNameLower === canonicalNameLower
        ) {
          await this.handleCollisionTicket({
            parentId,
            level: doc.level,
            canonicalNameLower,
            attemptedNames: doc.names,
          });
          throw new ConflictError(
            `Place with canonical name '${doc.canonicalName}' already exists at level ${doc.level} under parent ${parentId ?? 'ROOT'}. A review ticket has been created for administrative review.`
          );
        }
      }

      const placeId = doc._id || generateInternalPlaceId();
      if (this.inMemoryPlaces.has(placeId)) {
        throw new ConflictError(`Place with ID '${placeId}' already exists.`);
      }

      const isAutoGeneratedCode = !doc.code;
      let placeCode = doc.code || generateApiCode(doc.level);
      let retries = 0;

      while (this.isCodeTakenInMemory(placeCode)) {
        if (!isAutoGeneratedCode || retries >= MAX_CODE_RETRIES) {
          throw new ConflictError(
            isAutoGeneratedCode
              ? `Failed to generate a unique place code after ${MAX_CODE_RETRIES} attempts. Please try again.`
              : `Place code '${placeCode}' already exists.`
          );
        }
        retries++;
        placeCode = generateApiCode(doc.level);
      }

      const now = new Date();

      const newPlace: PlaceDocument = {
        _id: placeId,
        code: placeCode,
        level: doc.level,
        canonicalName: canonicalNameNFC,
        canonicalNameLower,
        names: doc.names.map((n) => ({
          language: n.language,
          name: toNFC(n.name),
        })),
        parentId,
        verificationStatus: VERIFICATION_STATUS.PENDING_VERIFICATION,
        createdBy: doc.createdBy,
        verifiedBy: null,
        verifiedAt: null,
        verificationHistory: [],
        metadata: doc.metadata ?? {},
        createdAt: now,
        updatedAt: now,
      };

      this.inMemoryPlaces.set(placeId, newPlace);
      return { ...newPlace };
    }

    // MongoDB Persistence Mode
    const placeId = doc._id || generateInternalPlaceId();
    const isAutoGeneratedCode = !doc.code;
    let placeCode = doc.code || generateApiCode(doc.level);
    let codeRetries = 0;

    while (true) {
      try {
        const newPlace = new PlaceModel({
          _id: placeId,
          code: placeCode,
          level: doc.level,
          canonicalName: canonicalNameNFC,
          canonicalNameLower,
          names: doc.names.map((n) => ({
            language: n.language,
            name: toNFC(n.name),
          })),
          parentId,
          verificationStatus: VERIFICATION_STATUS.PENDING_VERIFICATION,
          createdBy: doc.createdBy,
          verifiedBy: null,
          verifiedAt: null,
          verificationHistory: [],
          metadata: doc.metadata ?? {},
        });

        const saved = await newPlace.save();
        return saved.toObject() as PlaceDocument;
      } catch (err: any) {
        if (err.code === 11000 || err.code === '11000') {
          const dupType = classifyDuplicateKeyError(err);

          if (dupType === DuplicateKeyType.CODE_COLLISION) {
            if (isAutoGeneratedCode && codeRetries < MAX_CODE_RETRIES) {
              codeRetries++;
              placeCode = generateApiCode(doc.level);
              continue;
            }
            throw new ConflictError(
              isAutoGeneratedCode
                ? `Failed to generate a unique place code after ${MAX_CODE_RETRIES} attempts. Please try again.`
                : `Place code '${placeCode}' already exists.`
            );
          }

          if (dupType === DuplicateKeyType.NAME_COLLISION) {
            await this.handleCollisionTicket({
              parentId,
              level: doc.level,
              canonicalNameLower,
              attemptedNames: doc.names,
            });

            throw new ConflictError(
              `Place with canonical name '${doc.canonicalName}' already exists at level ${doc.level} under parent ${parentId ?? 'ROOT'}. A review ticket has been created for administrative review.`
            );
          }

          if (dupType === DuplicateKeyType.ID_COLLISION) {
            throw new ConflictError(`Place with ID '${placeId}' already exists.`);
          }

          // Unclassified duplicate key error: propagate controlled error without creating an incorrect name-collision review
          throw new ConflictError('A place record with conflicting unique constraints already exists.');
        }

        throw err;
      }
    }
  }

  /**
   * Admin correction of permitted fields: canonicalName, names, and metadata.
   */
  public async updatePlace(
    placeId: string,
    updates: {
      canonicalName?: string;
      names?: Array<{ language: string; name: string }>;
      metadata?: Record<string, unknown>;
    },
    adminUser: AuthenticatedUser
  ): Promise<PlaceDocument> {
    const place = await this.findById(placeId);
    if (!place) {
      throw new NotFoundError(`Place with ID ${placeId}`);
    }

    let newCanonicalName = place.canonicalName;
    let newCanonicalNameLower = place.canonicalNameLower;

    if (updates.canonicalName && updates.canonicalName.trim().length > 0) {
      newCanonicalName = toNFC(updates.canonicalName.trim());
      newCanonicalNameLower = toCanonicalLower(newCanonicalName);

      // Verify no collision under the same parent & level with another place
      if (newCanonicalNameLower !== place.canonicalNameLower) {
        if (this.inMemoryMode) {
          for (const existing of this.inMemoryPlaces.values()) {
            if (
              existing._id !== placeId &&
              existing.parentId === place.parentId &&
              existing.level === place.level &&
              existing.canonicalNameLower === newCanonicalNameLower
            ) {
              throw new ConflictError(
                `Cannot rename place: canonical name '${updates.canonicalName}' already exists at level ${place.level} under parent ${place.parentId ?? 'ROOT'}`
              );
            }
          }
        } else {
          const conflict = await PlaceModel.findOne({
            _id: { $ne: placeId },
            parentId: place.parentId,
            level: place.level,
            canonicalNameLower: newCanonicalNameLower,
          }).lean<PlaceDocument>();

          if (conflict) {
            throw new ConflictError(
              `Cannot rename place: canonical name '${updates.canonicalName}' already exists at level ${place.level} under parent ${place.parentId ?? 'ROOT'}`
            );
          }
        }
      }
    }

    const newNames = updates.names
      ? updates.names.map((n) => ({ language: n.language, name: toNFC(n.name) }))
      : place.names;

    const newMetadata = updates.metadata ? { ...place.metadata, ...updates.metadata } : place.metadata;
    const now = new Date();

    if (this.inMemoryMode) {
      place.canonicalName = newCanonicalName;
      place.canonicalNameLower = newCanonicalNameLower;
      place.names = newNames;
      place.metadata = newMetadata;
      place.updatedAt = now;
      this.inMemoryPlaces.set(placeId, { ...place });
      return { ...place };
    }

    const updated = await PlaceModel.findByIdAndUpdate(
      placeId,
      {
        $set: {
          canonicalName: newCanonicalName,
          canonicalNameLower: newCanonicalNameLower,
          names: newNames,
          metadata: newMetadata,
          updatedAt: now,
        },
      },
      { new: true }
    ).lean<PlaceDocument>();

    if (!updated) {
      throw new NotFoundError(`Place with ID ${placeId}`);
    }

    return updated;
  }

  /**
   * Submits a user verification decision for a place.
   * Enforces:
   * 1. Self-verification prevention (creator cannot verify their own place)
   * 2. Duplicate vote prevention (same user cannot vote multiple times, concurrency safe)
   * 3. Minimum evidence requirement
   * 4. Audit trail recording
   */
  public async verifyPlace(
    placeId: string,
    input: {
      decision: VerificationDecision;
      evidence: string;
      comments?: string;
    },
    user: AuthenticatedUser
  ): Promise<PlaceDocument> {
    // 1. Minimum evidence requirement
    if (!input.evidence || input.evidence.trim().length < 10) {
      throw new ValidationError('A minimum of 10 characters of verification evidence is required');
    }

    const place = await this.findById(placeId);
    if (!place) {
      throw new NotFoundError(`Place with ID ${placeId}`);
    }

    // 2. Prevent self-verification: Creator cannot verify their own submission
    if (place.createdBy === user.userId) {
      throw new BusinessRuleError(
        'Self-verification is not permitted. The creator of a place cannot verify their own submission.'
      );
    }

    const canonicalId = place._id;

    if (this.inMemoryMode) {
      const memPlace = this.inMemoryPlaces.get(canonicalId);
      if (!memPlace) {
        throw new NotFoundError(`Place with ID ${placeId}`);
      }

      // Check duplicate vote synchronously against the live in-memory store
      const alreadyVoted = memPlace.verificationHistory.some((entry) => entry.userId === user.userId);
      if (alreadyVoted) {
        throw new ConflictError(
          `User '${user.userId}' has already submitted a verification decision for place '${placeId}'.`
        );
      }

      const now = new Date();
      const previousStatus = memPlace.verificationStatus;

      let auditNewStatus: VerificationStatus = previousStatus;
      if (input.decision === VERIFICATION_DECISION.REJECT) {
        auditNewStatus = VERIFICATION_STATUS.REJECTED;
      } else if (input.decision === VERIFICATION_DECISION.NEEDS_REVIEW) {
        auditNewStatus = VERIFICATION_STATUS.NEEDS_REVIEW;
      } else if (input.decision === VERIFICATION_DECISION.VERIFY) {
        if (hasMinimumRole(user.role, USER_ROLES.REVIEWER)) {
          auditNewStatus = VERIFICATION_STATUS.VERIFIED;
        } else {
          const priorPositiveVotes = memPlace.verificationHistory.filter(
            (e) => e.decision === VERIFICATION_DECISION.VERIFY
          ).length;
          auditNewStatus =
            priorPositiveVotes + 1 >= 2
              ? VERIFICATION_STATUS.VERIFIED
              : VERIFICATION_STATUS.PENDING_VERIFICATION;
        }
      }

      const auditEntry: PlaceVerificationAuditEntry = {
        userId: user.userId,
        userEmail: user.email,
        userRole: user.role,
        decision: input.decision,
        evidence: toNFC(input.evidence.trim()),
        comments: input.comments ? toNFC(input.comments.trim()) : undefined,
        timestamp: now,
        previousStatus,
        newStatus: auditNewStatus,
      };

      // Push synchronously into in-memory store
      memPlace.verificationHistory.push(auditEntry);

      // Recompute authoritative status from complete history
      const computed = computeVerificationStatus(memPlace.verificationHistory);
      memPlace.verificationStatus = computed.status;
      memPlace.verifiedBy = computed.verifiedBy;
      memPlace.verifiedAt = computed.verifiedAt;
      memPlace.updatedAt = now;

      this.inMemoryPlaces.set(canonicalId, memPlace);
      return {
        ...memPlace,
        verificationHistory: [...memPlace.verificationHistory],
      };
    }

    // Live MongoDB mode: Atomic conditional update to prevent race conditions & duplicate votes
    const now = new Date();
    const previousStatus = place.verificationStatus;

    let auditNewStatus: VerificationStatus = previousStatus;
    if (input.decision === VERIFICATION_DECISION.REJECT) {
      auditNewStatus = VERIFICATION_STATUS.REJECTED;
    } else if (input.decision === VERIFICATION_DECISION.NEEDS_REVIEW) {
      auditNewStatus = VERIFICATION_STATUS.NEEDS_REVIEW;
    } else if (input.decision === VERIFICATION_DECISION.VERIFY) {
      if (hasMinimumRole(user.role, USER_ROLES.REVIEWER)) {
        auditNewStatus = VERIFICATION_STATUS.VERIFIED;
      } else {
        const priorPositiveVotes = place.verificationHistory.filter(
          (e) => e.decision === VERIFICATION_DECISION.VERIFY
        ).length;
        auditNewStatus =
          priorPositiveVotes + 1 >= 2
            ? VERIFICATION_STATUS.VERIFIED
            : VERIFICATION_STATUS.PENDING_VERIFICATION;
      }
    }

    const auditEntry: PlaceVerificationAuditEntry = {
      userId: user.userId,
      userEmail: user.email,
      userRole: user.role,
      decision: input.decision,
      evidence: toNFC(input.evidence.trim()),
      comments: input.comments ? toNFC(input.comments.trim()) : undefined,
      timestamp: now,
      previousStatus,
      newStatus: auditNewStatus,
    };

    // 1. Atomically push audit entry only if this userId has not already voted
    const updated = await PlaceModel.findOneAndUpdate(
      {
        _id: canonicalId,
        'verificationHistory.userId': { $ne: user.userId },
      },
      {
        $push: { verificationHistory: auditEntry },
      },
      { new: true }
    ).lean<PlaceDocument>();

    if (!updated) {
      const exists = await PlaceModel.exists({ _id: canonicalId });
      if (!exists) {
        throw new NotFoundError(`Place with ID ${placeId}`);
      }
      throw new ConflictError(
        `User '${user.userId}' has already submitted a verification decision for place '${placeId}'.`
      );
    }

    // 2. Authoritative recalculation of status from updated.verificationHistory
    const computed = computeVerificationStatus(updated.verificationHistory);

    const statusQuery: Record<string, unknown> = { _id: canonicalId };
    if (computed.status !== VERIFICATION_STATUS.VERIFIED) {
      statusQuery.verificationStatus = { $ne: VERIFICATION_STATUS.VERIFIED };
    }

    const finalDoc = await PlaceModel.findOneAndUpdate(
      statusQuery,
      {
        $set: {
          verificationStatus: computed.status,
          verifiedBy: computed.verifiedBy,
          verifiedAt: computed.verifiedAt,
          updatedAt: now,
        },
      },
      { new: true }
    ).lean<PlaceDocument>();

    return finalDoc || (await PlaceModel.findById(canonicalId).lean<PlaceDocument>())!;
  }

  /**
   * Concurrency-safe atomic upsert for collision review tickets.
   */
  public async handleCollisionTicket(params: {
    parentId: string | null;
    level: any;
    canonicalNameLower: string;
    attemptedNames: Array<{ language: string; name: string }>;
  }): Promise<void> {
    const fingerprint = this.generateFingerprint(params.parentId, params.level, params.canonicalNameLower);
    const now = new Date();

    if (this.inMemoryMode) {
      const existing = this.inMemoryTickets.get(fingerprint);
      if (existing && existing.status === REVIEW_TICKET_STATUS.PENDING_REVIEW) {
        existing.attemptCount += 1;
        existing.lastAttemptedAt = now;
      } else {
        const newTicket: PlaceCollisionReviewDocument = {
          _id: `ticket_${fingerprint.slice(0, 16)}`,
          collisionFingerprint: fingerprint,
          parentId: params.parentId,
          level: params.level,
          canonicalNameLower: params.canonicalNameLower,
          attemptedNames: params.attemptedNames,
          attemptCount: 1,
          status: REVIEW_TICKET_STATUS.PENDING_REVIEW,
          firstAttemptedAt: now,
          lastAttemptedAt: now,
        };
        this.inMemoryTickets.set(fingerprint, newTicket);
      }
      return;
    }

    try {
      await PlaceCollisionReviewModel.findOneAndUpdate(
        {
          collisionFingerprint: fingerprint,
          status: REVIEW_TICKET_STATUS.PENDING_REVIEW,
        },
        {
          $setOnInsert: {
            collisionFingerprint: fingerprint,
            parentId: params.parentId,
            level: params.level,
            canonicalNameLower: params.canonicalNameLower,
            attemptedNames: params.attemptedNames,
            status: REVIEW_TICKET_STATUS.PENDING_REVIEW,
            firstAttemptedAt: now,
          },
          $set: { lastAttemptedAt: now },
          $inc: { attemptCount: 1 },
        },
        { upsert: true, new: true }
      );
    } catch (upsertError: any) {
      if (upsertError.code === 11000) {
        await PlaceCollisionReviewModel.updateOne(
          {
            collisionFingerprint: fingerprint,
            status: REVIEW_TICKET_STATUS.PENDING_REVIEW,
          },
          {
            $set: { lastAttemptedAt: now },
            $inc: { attemptCount: 1 },
          }
        );
      } else {
        console.error('Failed to record collision review ticket:', upsertError);
      }
    }
  }

  public async listCollisionTickets(status: ReviewTicketStatus = REVIEW_TICKET_STATUS.PENDING_REVIEW): Promise<PlaceCollisionReviewDocument[]> {
    if (this.inMemoryMode) {
      return Array.from(this.inMemoryTickets.values()).filter((t) => t.status === status);
    }
    return PlaceCollisionReviewModel.find({ status }).lean<PlaceCollisionReviewDocument[]>();
  }

  /**
   * Resolves a collision ticket enforcing strict state precondition immutability.
   */
  public async resolveCollisionTicket(
    ticketId: string,
    targetStatus: ReviewTicketStatus,
    adminId: string,
    notes?: string
  ): Promise<PlaceCollisionReviewDocument> {
    if (this.inMemoryMode) {
      for (const ticket of this.inMemoryTickets.values()) {
        if (ticket._id === ticketId || ticket.collisionFingerprint === ticketId) {
          if (ticket.status !== REVIEW_TICKET_STATUS.PENDING_REVIEW) {
            throw new ConflictError('Ticket not found or has already been resolved / closed');
          }
          ticket.status = targetStatus;
          ticket.resolvedAt = new Date();
          ticket.resolvedBy = adminId;
          ticket.resolutionNotes = notes ?? '';
          return { ...ticket };
        }
      }
      throw new ConflictError('Ticket not found or has already been resolved / closed');
    }

    const result = await PlaceCollisionReviewModel.findOneAndUpdate(
      {
        _id: ticketId,
        status: REVIEW_TICKET_STATUS.PENDING_REVIEW,
      },
      {
        $set: {
          status: targetStatus,
          resolvedAt: new Date(),
          resolvedBy: adminId,
          resolutionNotes: notes ?? '',
        },
      },
      { new: true }
    ).lean<PlaceCollisionReviewDocument>();

    if (!result) {
      throw new ConflictError('Ticket not found or has already been resolved / closed');
    }

    return result;
  }
}
