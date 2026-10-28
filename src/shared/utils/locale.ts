/**
 * BCP 47 Language Tag normalization and validation.
 * Uses standard Intl.Locale.baseName to canonicalize subtags while
 * preserving valid script and region distinctions (e.g., 'pa-Guru' vs 'pa-Arab').
 */

export function canonicalizeLanguageTag(rawTag: string): string {
  if (!rawTag || typeof rawTag !== 'string') {
    throw new Error('Language tag must be a non-empty string');
  }
  const trimmed = rawTag.trim();
  const locale = new Intl.Locale(trimmed);
  return locale.baseName;
}

export function isValidLanguageTag(rawTag: string): boolean {
  if (!rawTag || typeof rawTag !== 'string') return false;
  try {
    const locale = new Intl.Locale(rawTag.trim());
    return Boolean(locale.language);
  } catch {
    return false;
  }
}
