import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { AppAuthenticationError } from '../shared/errors/AppError';
import { AuthenticatedRequest } from './authenticate';

interface AppTokenPayload {
  appId: string;
  platform: 'flutter_mobile' | 'flutter_web' | 'service';
  isApproved: boolean;
  iat: number;
  exp: number;
}

// In-memory cache for app verification with 30s TTL
interface CacheEntry {
  isValid: boolean;
  appId: string;
  platform: string;
  expiresAt: number;
}

const appCache = new Map<string, CacheEntry>();

export function authenticateApp(req: AuthenticatedRequest, _res: Response, next: NextFunction): void {
  const appToken = req.headers['x-app-attestation'] as string | undefined
    || req.headers['x-app-token'] as string | undefined;

  if (!appToken) {
    return next(new AppAuthenticationError('Missing required approved application token (X-App-Attestation)'));
  }

  const now = Date.now();
  const cached = appCache.get(appToken);

  if (cached && cached.expiresAt > now) {
    if (!cached.isValid) {
      return next(new AppAuthenticationError('Application registration revoked or unauthorized'));
    }
    req.appClient = {
      appId: cached.appId,
      platform: cached.platform,
      isApproved: true,
    };
    return next();
  }

  try {
    const decoded = jwt.verify(appToken, env.APP_GATE_SECRET) as AppTokenPayload;

    if (!decoded.isApproved) {
      appCache.set(appToken, {
        isValid: false,
        appId: decoded.appId,
        platform: decoded.platform,
        expiresAt: now + env.APP_CACHE_TTL_MS,
      });
      return next(new AppAuthenticationError('Application registration is not approved'));
    }

    appCache.set(appToken, {
      isValid: true,
      appId: decoded.appId,
      platform: decoded.platform,
      expiresAt: now + env.APP_CACHE_TTL_MS,
    });

    req.appClient = {
      appId: decoded.appId,
      platform: decoded.platform,
      isApproved: true,
    };

    next();
  } catch {
    // Fail-closed behavior
    return next(new AppAuthenticationError('Invalid or expired application attestation token'));
  }
}
