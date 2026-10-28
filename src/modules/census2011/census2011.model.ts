import mongoose, { Schema, Document } from 'mongoose';
import { PLACE_LEVELS } from '../../shared/constants';
import { Census2011PlaceDocument, Census2011QuarantineDocument, Census2011UrbanSummaryDocument } from './types';

// ==========================================
// 1. Census 2011 Place Schema (Historical Dedicated Model)
// ==========================================

const PlaceNameSchema = new Schema(
  {
    language: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
  },
  { _id: false }
);

export const Census2011PlaceSchema = new Schema<Census2011PlaceDocument & Document>(
  {
    // Explicit string _id overrides default Mongoose ObjectId casting
    _id: {
      type: String,
      required: true,
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
        validator: (v: Array<{ language: string; name: string }>) => Boolean(v && v.length > 0),
        message: 'A historical census place must have at least one localized name',
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
    censusYear: {
      type: Number,
      required: true,
      default: 2011,
    },
    censusCode: {
      type: String,
      default: null,
      trim: true,
      index: true,
    },
    stateCode: {
      type: String,
      default: null,
      trim: true,
    },
    districtCode: {
      type: String,
      default: null,
      trim: true,
    },
    subDistrictCode: {
      type: String,
      default: null,
      trim: true,
    },
    villageCode: {
      type: String,
      default: null,
      trim: true,
    },
    townCode: {
      type: String,
      default: null,
      trim: true,
    },
    sourceRow: {
      type: Number,
      default: null,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    collection: 'places_census2011',
  }
);

// Compound Unique Index: Preserves strict hierarchy uniqueness under immediate parent by villageCode for villages
Census2011PlaceSchema.index(
  { parentId: 1, villageCode: 1 },
  {
    unique: true,
    partialFilterExpression: {
      level: PLACE_LEVELS.VILLAGE,
      villageCode: { $type: 'string' },
    },
  }
);

// Query index for parent-scoped name searches (non-unique to accommodate verified statutory homonyms)
Census2011PlaceSchema.index({ parentId: 1, level: 1, canonicalNameLower: 1 });
Census2011PlaceSchema.index({ 'names.name': 'text', canonicalName: 'text' });
Census2011PlaceSchema.index({ level: 1, parentId: 1 });

export const Census2011PlaceModel = mongoose.model<Census2011PlaceDocument & Document>(
  'Census2011Place',
  Census2011PlaceSchema
);

// ==========================================
// 2. Census 2011 Quarantine Places Schema
// ==========================================

export const Census2011QuarantineSchema = new Schema<Census2011QuarantineDocument & Document>(
  {
    _id: {
      type: String,
      required: true,
    },
    level: {
      type: String,
      required: true,
    },
    parentId: {
      type: String,
      default: null,
      index: true,
    },
    canonicalNameLower: {
      type: String,
      required: true,
      index: true,
    },
    collisionGroupId: {
      type: String,
      default: null,
      index: true,
    },
    quarantineReason: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      required: true,
      enum: ['PENDING_REVIEW', 'RESOLVED_KEEP_SEPARATE', 'CONFIRMED_DUPLICATE', 'NEEDS_EVIDENCE', 'EXCLUDED'],
      default: 'PENDING_REVIEW',
      index: true,
    },
    record: {
      type: Schema.Types.Mixed,
      required: true,
    },
    quarantinedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    collection: 'census2011_quarantine_places',
  }
);

export const Census2011QuarantineModel = mongoose.model<Census2011QuarantineDocument & Document>(
  'Census2011Quarantine',
  Census2011QuarantineSchema
);

// ==========================================
// 3. Census 2011 Urban Summaries Schema (Auxiliary Unparented Records)
// ==========================================

export const Census2011UrbanSummarySchema = new Schema<Census2011UrbanSummaryDocument & Document>(
  {
    _id: {
      type: String,
      required: true,
    },
    sourceRow: {
      type: Number,
      required: true,
      index: true,
    },
    stateCode: {
      type: String,
      required: true,
    },
    districtCode: {
      type: String,
      required: true,
    },
    subDistrictCode: {
      type: String,
      required: true,
    },
    code: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    rawName: {
      type: String,
      required: true,
    },
    entityType: {
      type: String,
      required: true,
    },
    reason: {
      type: String,
      required: true,
    },
    intendedParentLevel: {
      type: String,
      required: true,
    },
    actualSourceParentFound: {
      type: Boolean,
      default: false,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    collection: 'census2011_urban_summaries',
  }
);

export const Census2011UrbanSummaryModel = mongoose.model<Census2011UrbanSummaryDocument & Document>(
  'Census2011UrbanSummary',
  Census2011UrbanSummarySchema
);
