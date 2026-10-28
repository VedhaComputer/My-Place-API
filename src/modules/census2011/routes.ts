import { Router, Request, Response, NextFunction } from 'express';
import { Census2011Service } from './service';
import { census2011QuerySchema } from './validation';
import { validateQuery } from '../../middleware/validateRequest';

export function createCensus2011Router(service: Census2011Service = new Census2011Service()): Router {
  const router = Router();

  // Reject all non-GET mutation methods explicitly
  router.use((req: Request, res: Response, next: NextFunction) => {
    if (req.method !== 'GET') {
      return res.status(405).json({
        error: {
          code: 'METHOD_NOT_ALLOWED',
          message: 'Census 2011 API is strictly read-only. Mutation operations are not permitted.',
        },
      });
    }
    next();
  });

  /**
   * Helper handler for querying places list with pagination.
   */
  const listHandler = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = (req as any).validatedQuery || req.query;
      const result = await service.listPlaces(query);
      res.json({
        data: result.data,
        pagination: {
          total: result.total,
          page: result.page,
          limit: result.limit,
          totalPages: result.totalPages,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Helper handler for getting a single place by ID.
   */
  const getByIdHandler = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (req.params.id === 'places') {
        return next();
      }
      const place = await service.getPlaceById(req.params.id);
      res.json({ data: place });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Helper handler for getting children of a place by ID.
   */
  const getChildrenHandler = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = (req as any).validatedQuery || req.query;
      const result = await service.getChildren(req.params.id, query);
      res.json({
        data: result.data,
        pagination: {
          total: result.total,
          page: result.page,
          limit: result.limit,
          totalPages: result.totalPages,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Helper handler for getting hierarchy ancestors of a place by ID.
   */
  const getAncestorsHandler = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ancestors = await service.getHierarchyAncestors(req.params.id);
      res.json({ data: ancestors });
    } catch (error) {
      next(error);
    }
  };

  // 1. List queries (both / and /places)
  router.get('/', validateQuery(census2011QuerySchema), listHandler);
  router.get('/places', validateQuery(census2011QuerySchema), listHandler);

  // 2. Hierarchical children and ancestors routes (defined before /:id)
  router.get('/places/:id/children', validateQuery(census2011QuerySchema), getChildrenHandler);
  router.get('/:id/children', validateQuery(census2011QuerySchema), getChildrenHandler);

  router.get('/places/:id/ancestors', getAncestorsHandler);
  router.get('/:id/ancestors', getAncestorsHandler);

  // 3. Single entity retrieval
  router.get('/places/:id', getByIdHandler);
  router.get('/:id', getByIdHandler);

  return router;
}

export default createCensus2011Router();
