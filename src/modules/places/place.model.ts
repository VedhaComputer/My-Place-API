import mongoose, { Schema, Document } from 'mongoose';
import {
  PLACE_LEVELS,
  PlaceLevel,
  REVIEW_TICKET_STATUS,
  ReviewTicketStatus,
  VERIFICATION_STATUS,
  VERIFICATION_DECISION,
} from '../../shared/constants';
import { PlaceDocument, PlaceCollisionReviewDocument } from './types';

// ==========================================
// 1. Master Place Schema
// ==========================================

const PlaceNameSchema = new Schema(
  {
    language: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const VerificationAuditSchema = new Schema(
  {
    userId: { type: String, required: true },
    userEmail: { type: String, required: true },
    userRole: { type: String, required: true },
    decision: {
      type: String,
      required: true,
      enum: Object.values(VERIFICATION_DECISION),
    },
    evidence: { type: String, required: true },
    comments: { type: String },
    timestamp: { type: Date, default: Date.now },
    previousStatus: {
      type: String,
      required: true,
      enum: Object.values(VERIFICATION_STATUS),
    },
    newStatus: {
      type: String,
      required: true,
      enum: Object.values(VERIFICATION_STATUS),
    },
  },
  { _id: false }
);

export const PlaceSchema = new Schema<PlaceDocument & Document>(
  {
    _id: {
      type: String,
      required: true,
    },
    code: {
      type: String,
      trim: true,
    },
    level: {
      type: String,
      required: true,
      enum: Object.values(PLACE_LEVELS),
      index: true,
    },
    names: {
      type: [PlaceNameSchema],
      required: true,
      validate: {
        validator: (v: Array<{ language: string; name: string }>) => v && v.length > 0,
        message: 'A place must have at least one localized name',
      },
    },
    canonicalName: {
      type: String,
      required: true,
      trim: true,
    },
    canonicalNameLower: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    parentId: {
      type: String,
      default: null,
      index: true,
    },
    verificationStatus: {
      type: String,
      required: true,
      enum: Object.values(VERIFICATION_STATUS),
      default: VERIFICATION_STATUS.PENDING_VERIFICATION,
    },
    createdBy: {
      type: String,
      required: true,
      index: true,
    },
    verifiedBy: {
      type: String,
      default: null,
    },
    verifiedAt: {
      type: Date,
      default: null,
    },
    verificationHistory: {
      type: [VerificationAuditSchema],
      default: [],
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    collection: 'places',
    autoIndex: false,
  }
);

// Compound Unique Index: Preserves strict hierarchy uniqueness
PlaceSchema.index(
  { parentId: 1, level: 1, canonicalNameLower: 1 },
  { unique: true }
);

// General Query Indexes
PlaceSchema.index(
  { code: 1 },
  {
    unique: true,
    partialFilterExpression: { code: { $type: 'string' } },
  }
);
PlaceSchema.index({ 'names.name': 'text', canonicalName: 'text' });
PlaceSchema.index({ level: 1, parentId: 1 });
PlaceSchema.index({ verificationStatus: 1 });

export const PlaceModel = mongoose.model<PlaceDocument & Document>('Place', PlaceSchema);

// ==========================================
// 2. Place Collision Review Schema
// ==========================================

const PlaceCollisionReviewSchema = new Schema<PlaceCollisionReviewDocument & Document>(
  {
    collisionFingerprint: {
      type: String,
      required: true,
    },
    parentId: {
      type: String,
      default: null,
    },
    level: {
      type: String,
      required: true,
      enum: Object.values(PLACE_LEVELS),
    },
    canonicalNameLower: {
      type: String,
      required: true,
    },
    attemptedNames: {
      type: [PlaceNameSchema],
      required: true,
    },
    attemptCount: {
      type: Number,
      default: 1,
      min: 1,
    },
    status: {
      type: String,
      required: true,
      enum: Object.values(REVIEW_TICKET_STATUS),
      default: REVIEW_TICKET_STATUS.PENDING_REVIEW,
      index: true,
    },
    firstAttemptedAt: {
      type: Date,
      default: Date.now,
    },
    lastAttemptedAt: {
      type: Date,
      default: Date.now,
    },
    resolvedAt: {
      type: Date,
    },
    resolvedBy: {
      type: String,
    },
    resolutionNotes: {
      type: String,
    },
  },
  {
    timestamps: true,
    collection: 'place_collision_reviews',
  }
);

// Partial Unique Index: Only one PENDING_REVIEW ticket per collisionFingerprint
PlaceCollisionReviewSchema.index(
  { collisionFingerprint: 1 },
  {
    unique: true,
    partialFilterExpression: { status: REVIEW_TICKET_STATUS.PENDING_REVIEW },
  }
);

export const PlaceCollisionReviewModel = mongoose.model<PlaceCollisionReviewDocument & Document>(
  'PlaceCollisionReview',
  PlaceCollisionReviewSchema
);
