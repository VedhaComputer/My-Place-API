/**
 * Unicode normalization utilities.
 * Enforces Unicode Normalization Form C (NFC) across all place name attributes.
 */

export function toNFC(input: string): string {
  if (typeof input !== 'string') return input;
  return input.normalize('NFC').trim();
}

export function toCanonicalLower(input: string): string {
  return toNFC(input).toLowerCase();
}
