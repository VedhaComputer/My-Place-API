import fs from 'fs';
import crypto from 'crypto';
import { env } from './env';

let cachedPublicKey: string | null = null;

function parseAndValidatePublicKey(pem: string): crypto.KeyObject {
  try {
    const key = crypto.createPublicKey(pem);
    if (key.asymmetricKeyType !== 'rsa') {
      throw new Error(`Expected RSA key, but received ${key.asymmetricKeyType}`);
    }
    return key;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to parse RSA public key: ${msg}`);
  }
}

export function getJwtPublicKey(): string {
  if (cachedPublicKey) {
    return cachedPublicKey;
  }

  // 1. Resolve in-memory PEM string before file path
  let rawPem = process.env.JWT_PUBLIC_KEY || env.JWT_PUBLIC_KEY;
  if (!rawPem && env.JWT_PUBLIC_KEY_PATH) {
    try {
      rawPem = fs.readFileSync(env.JWT_PUBLIC_KEY_PATH, 'utf8');
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to read public key from path "${env.JWT_PUBLIC_KEY_PATH}": ${msg}`);
    }
  }

  if (!rawPem || !rawPem.trim()) {
    throw new Error('No RSA public key configured. Set JWT_PUBLIC_KEY (in-memory) or JWT_PUBLIC_KEY_PATH.');
  }

  parseAndValidatePublicKey(rawPem);
  cachedPublicKey = rawPem;
  return cachedPublicKey;
}

export function _resetKeysForTesting(): void {
  cachedPublicKey = null;
}
