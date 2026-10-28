import { Router, Request, Response } from 'express';
import { PlaceService } from './service';
import { createPlaceSchema, updatePlaceSchema, placeQuerySchema, verifyPlaceSchema } from './validation';
import { validateBody, validateQuery } from '../../middleware/validateRequest';
import { authenticate, AuthenticatedRequest } from '../../middleware/authenticate';
import { authenticateApp } from '../../middleware/authenticateApp';
import { requireAdmin, requireRole } from '../../middleware/authorize';
import { USER_ROLES } from '../../shared/constants';

export function createPlacesRouter(placeService: PlaceService = new PlaceService()): Router {
  const router = Router();

  /**
   * GET /places
   * Public: Query places with optional filtering by level, parentId, language, verificationStatus, search.
   */
  router.get('/', validateQuery(placeQuerySchema), async (req: Request, res: Response, next) => {
    try {
      const query = (req as any).validatedQuery || req.query;
      const result = await placeService.listPlaces(query);
      res.json({
        data: result.data,
        pagination: {
          total: result.total,
          page: Number(query.page) || 1,
          limit: Number(query.limit) || 20,
        },
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /places/reviews/collisions
   * Public: list pending collision review tickets.
   */
  router.get('/reviews/collisions', async (_req: Request, res: Response, next) => {
    try {
      const tickets = await placeService.listCollisionTickets();
      res.json({ data: tickets });
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /places/reviews/collisions/:id/resolve
   * Admin-only: resolve a pending collision review ticket.
   */
  router.post('/reviews/collisions/:id/resolve', authenticate, authenticateApp, requireAdmin, async (req: AuthenticatedRequest, res: Response, next) => {
    try {
      const { targetStatus, notes } = req.body;
      const adminId = req.user!.userId;
      const resolved = await placeService.resolveCollisionTicket(req.params.id, targetStatus, adminId, notes);
      res.json({ data: resolved });
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /places/:id
   * Public: Retrieve a specific place by its internal ID or public API code.
   */
  router.get('/:id', async (req: Request, res: Response, next) => {
    try {
      const place = await placeService.getPlaceById(req.params.id);
      res.json({ data: place });
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /places/:id/children
   * Public: Retrieve all immediate children of a place.
   */
  router.get('/:id/children', async (req: Request, res: Response, next) => {
    try {
      const children = await placeService.getChildren(req.params.id);
      res.json({ data: children });
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /places/:id/ancestors
   * Public: Retrieve full hierarchy path from COUNTRY down to this place.
   */
  router.get('/:id/ancestors', async (req: Request, res: Response, next) => {
    try {
      const ancestors = await placeService.getHierarchyAncestors(req.params.id);
      res.json({ data: ancestors });
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /places
   * Admin-only: Manually create a new place in the hierarchy.
   * Enforces server-side validation of hierarchy, parent existence, duplicate scope,
   * and generates independent internal ID and API code. Initial status is PENDING_VERIFICATION.
   */
  router.post(
    '/',
    authenticate,
    authenticateApp,
    requireAdmin,
    validateBody(createPlaceSchema),
    async (req: AuthenticatedRequest, res: Response, next) => {
      try {
        const newPlace = await placeService.createPlace(req.body, req.user);
        res.status(201).json({ data: newPlace });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * PATCH /places/:id
   * Admin-only: Correct permitted fields (canonicalName, localized names, metadata).
   * Validated on server; maintains audit trail.
   */
  router.patch(
    '/:id',
    authenticate,
    authenticateApp,
    requireAdmin,
    validateBody(updatePlaceSchema),
    async (req: AuthenticatedRequest, res: Response, next) => {
      try {
        const updatedPlace = await placeService.updatePlace(req.params.id, req.body, req.user!);
        res.json({ data: updatedPlace });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * POST /places/:id/verify
   * User Verification Workflow:
   * Authenticated users (minimum role CONTRIBUTOR) submit verification decisions with evidence.
   * Enforces self-verification prevention, duplicate vote prevention, and minimum evidence.
   */
  router.post(
    '/:id/verify',
    authenticate,
    authenticateApp,
    requireRole(USER_ROLES.CONTRIBUTOR),
    validateBody(verifyPlaceSchema),
    async (req: AuthenticatedRequest, res: Response, next) => {
      try {
        const verifiedPlace = await placeService.verifyPlace(req.params.id, req.body, req.user!);
        res.json({ data: verifiedPlace });
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}

export default createPlacesRouter();
