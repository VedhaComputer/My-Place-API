import { z } from 'zod';
import {
  PLACE_LEVELS,
  PlaceLevel,
  VERIFICATION_STATUS,
  VERIFICATION_DECISION,
} from '../../shared/constants';
import { canonicalizeLanguageTag, isValidLanguageTag } from '../../shared/utils/locale';
import { toNFC } from '../../shared/utils/unicode';

export const placeNameSchema = z.object({
  language: z.string().refine(isValidLanguageTag, {
    message: 'Must be a valid BCP 47 language tag',
  }).transform(canonicalizeLanguageTag),
  name: z.string().min(1, 'Localized name cannot be empty').max(200).transform(toNFC),
});

export const createPlaceSchema = z.object({
  level: z.enum([
    PLACE_LEVELS.COUNTRY,
    PLACE_LEVELS.STATE_UT,
    PLACE_LEVELS.DIVISION,
    PLACE_LEVELS.DISTRICT,
    PLACE_LEVELS.SUB_DIVISION,
    PLACE_LEVELS.TEHSIL,
    PLACE_LEVELS.BLOCK,
    PLACE_LEVELS.CITY_TOWN,
    PLACE_LEVELS.VILLAGE,
    PLACE_LEVELS.WARD,
  ]),
  canonicalName: z.string().min(1, 'canonicalName cannot be empty').max(200).transform(toNFC),
  names: z.array(placeNameSchema).min(1, 'At least one localized name is required')
    .refine((items) => {
      const seen = new Set<string>();
      for (const item of items) {
        if (seen.has(item.language)) return false;
        seen.add(item.language);
      }
      return true;
    }, {
      message: 'Duplicate language tags are not permitted on the same place',
    }),
  parentId: z.string().nullable().optional(),
  metadata: z.record(z.unknown()).optional(),
}).refine((data) => {
  if (data.level === PLACE_LEVELS.COUNTRY) {
    return !data.parentId;
  }
  return typeof data.parentId === 'string' && data.parentId.trim().length > 0;
}, {
  message: 'parentId must be null for COUNTRY, and a valid non-empty string for all child levels',
  path: ['parentId'],
});

export const updatePlaceSchema = z.object({
  canonicalName: z.string().min(1).max(200).transform(toNFC).optional(),
  names: z.array(placeNameSchema).min(1)
    .refine((items) => {
      const seen = new Set<string>();
      for (const item of items) {
        if (seen.has(item.language)) return false;
        seen.add(item.language);
      }
      return true;
    }, {
      message: 'Duplicate language tags are not permitted on the same place',
    }).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const verifyPlaceSchema = z.object({
  decision: z.enum([
    VERIFICATION_DECISION.VERIFY,
    VERIFICATION_DECISION.REJECT,
    VERIFICATION_DECISION.NEEDS_REVIEW,
  ]),
  evidence: z
    .string()
    .min(10, 'Evidence description must be at least 10 characters')
    .max(1000, 'Evidence description cannot exceed 1000 characters')
    .transform(toNFC),
  comments: z.string().max(1000).transform(toNFC).optional(),
});

export const placeQuerySchema = z.object({
  parentId: z.string().optional(),
  level: z.enum([
    PLACE_LEVELS.COUNTRY,
    PLACE_LEVELS.STATE_UT,
    PLACE_LEVELS.DIVISION,
    PLACE_LEVELS.DISTRICT,
    PLACE_LEVELS.SUB_DIVISION,
    PLACE_LEVELS.TEHSIL,
    PLACE_LEVELS.BLOCK,
    PLACE_LEVELS.CITY_TOWN,
    PLACE_LEVELS.VILLAGE,
    PLACE_LEVELS.WARD,
  ]).optional(),
  search: z.string().optional(),
  language: z.string().optional(),
  code: z.string().optional(),
  verificationStatus: z.enum([
    VERIFICATION_STATUS.PENDING_VERIFICATION,
    VERIFICATION_STATUS.VERIFIED,
    VERIFICATION_STATUS.REJECTED,
    VERIFICATION_STATUS.NEEDS_REVIEW,
  ]).optional(),
  page: z.string().optional(),
  limit: z.string().optional(),
});
