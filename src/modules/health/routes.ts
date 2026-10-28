import { Router, Request, Response } from 'express';
import { getDatabaseStatus } from '../../config/database';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'india-place-api',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version ?? '1.0.0',
    hierarchy: [
      'COUNTRY',
      'STATE_UT',
      'DISTRICT',
      'TEHSIL',
      'CITY_TOWN_OR_VILLAGE',
    ],
    services: {
      database: getDatabaseStatus(),
    },
  });
});

export default router;
