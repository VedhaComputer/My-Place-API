import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { PlaceLevel, PLACE_LEVELS } from '../constants';

const LEVEL_PREFIX_MAP: Record<PlaceLevel, string> = {
  [PLACE_LEVELS.COUNTRY]: 'CTY',
  [PLACE_LEVELS.STATE_UT]: 'ST',
  [PLACE_LEVELS.DIVISION]: 'DIV',
  [PLACE_LEVELS.DISTRICT]: 'DST',
  [PLACE_LEVELS.SUB_DIVISION]: 'SDV',
  [PLACE_LEVELS.TEHSIL]: 'THS',
  [PLACE_LEVELS.BLOCK]: 'BLK',
  [PLACE_LEVELS.CITY_TOWN]: 'TWN',
  [PLACE_LEVELS.VILLAGE]: 'VLG',
  [PLACE_LEVELS.WARD]: 'WRD',
};

/**
 * Generates a stable, unique internal place ID.
 * Independent of government codes and external dependencies.
 * Format: plc_<32_hex_chars>
 */
export function generateInternalPlaceId(): string {
  return `plc_${uuidv4().replace(/-/g, '')}`;
}

/**
 * Generates a unique, non-government API code for a place.
 * Human-readable, stable, and independent of government systems.
 * Format: IN-${LEVEL_PREFIX}-${8_HEX_CHARS}
 * e.g. IN-DST-A7F92B1C, IN-VLG-3E8A9F10
 */
export function generateApiCode(level: PlaceLevel): string {
  const prefix = LEVEL_PREFIX_MAP[level] || 'PLC';
  const randomHex = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `IN-${prefix}-${randomHex}`;
}
