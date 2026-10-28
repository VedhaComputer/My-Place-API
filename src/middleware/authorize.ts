import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './authenticate';
import { UserRole, USER_ROLES, hasMinimumRole } from '../shared/constants';
import { AuthorizationError } from '../shared/errors/AppError';

/**
 * Middleware to require a minimum user role for access.
 */
export function requireRole(minimumRole: UserRole) {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new AuthorizationError('Authentication session required for authorization'));
    }
    if (!hasMinimumRole(req.user.role, minimumRole)) {
      return next(
        new AuthorizationError(
          `Insufficient permissions: role '${req.user.role}' does not satisfy required minimum role '${minimumRole}'`
        )
      );
    }
    next();
  };
}

/**
 * Convenience middleware to require ADMIN role.
 */
export const requireAdmin = requireRole(USER_ROLES.ADMIN);
