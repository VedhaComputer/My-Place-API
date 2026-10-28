import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { getJwtPublicKey } from '../config/keys';
import { AuthenticationError } from '../shared/errors/AppError';
import { UserRole, USER_ROLES } from '../shared/constants';

export interface AuthenticatedUser {
  userId: string;
  email: string;
  role: UserRole;
  displayName: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
  appClient?: {
    appId: string;
    platform: string;
    isApproved: boolean;
  };
}

function mapAndValidateUser(decoded: any): AuthenticatedUser {
  const rawId = decoded?.userId || decoded?.sub;
  if (typeof rawId !== 'string' || !rawId.trim()) {
    throw new AuthenticationError('Invalid or expired token');
  }

  if (!decoded?.role || typeof decoded.role !== 'string') {
    throw new AuthenticationError('Invalid or expired token');
  }

  const normalizedRole = decoded.role.trim().toUpperCase() as UserRole;
  if (!Object.values(USER_ROLES).includes(normalizedRole)) {
    throw new AuthenticationError('Invalid or expired token');
  }

  const email = typeof decoded.email === 'string' ? decoded.email.trim() : '';
  const displayName = typeof decoded.displayName === 'string' ? decoded.displayName.trim() : '';

  return {
    userId: rawId.trim(),
    email,
    role: normalizedRole,
    displayName,
  };
}

export function authenticate(req: AuthenticatedRequest, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new AuthenticationError('Authentication required'));
  }

  const token = authHeader.split(' ')[1];

  const unverified = jwt.decode(token, { complete: true });
  if (!unverified || typeof unverified !== 'object' || !unverified.header) {
    return next(new AuthenticationError('Invalid or expired token'));
  }

  const alg = unverified.header.alg;

  if (alg === 'RS256') {
    try {
      const decoded = jwt.verify(token, getJwtPublicKey(), {
        algorithms: ['RS256'],
        issuer: env.JWT_ISSUER,
        audience: env.JWT_AUDIENCE,
      }) as any;
      req.user = mapAndValidateUser(decoded);
      return next();
    } catch {
      return next(new AuthenticationError('Invalid or expired token'));
    }
  }

  if (alg === 'HS256') {
    if (!env.JWT_ALLOW_HS256_FALLBACK) {
      return next(new AuthenticationError('Invalid or expired token'));
    }
    try {
      const decodedLegacy = jwt.verify(token, env.JWT_ACCESS_SECRET, {
        algorithms: ['HS256'],
      }) as any;
      req.user = mapAndValidateUser(decodedLegacy);
      return next();
    } catch {
      return next(new AuthenticationError('Invalid or expired token'));
    }
  }

  return next(new AuthenticationError('Invalid or expired token'));
}
