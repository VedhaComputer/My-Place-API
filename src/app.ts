import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { env } from './config/env';
import { errorHandler } from './middleware/errorHandler';
import healthRouter from './modules/health/routes';
import placesRouter from './modules/places/routes';
import census2011Router from './modules/census2011/routes';

export function createApp(): express.Application {
  const app = express();

  // Security headers
  app.use(helmet());

  // CORS
  app.use(
    cors({
      origin: env.CORS_ORIGINS.split(',').map((o) => o.trim()),
      credentials: true,
    })
  );

  // Rate limiting
  app.use(
    rateLimit({
      windowMs: env.RATE_LIMIT_WINDOW_MS,
      max: env.RATE_LIMIT_MAX,
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: { code: 'RATE_LIMITED', message: 'Too many requests to India Place API' } },
    })
  );

  // Request logging
  if (env.NODE_ENV !== 'test') {
    app.use(morgan('combined'));
  }

  // Body parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Routes
  app.use('/health', healthRouter);
  app.use('/places', placesRouter);
  app.use('/census2011', census2011Router);

  // 404 handler
  app.use((_req, res) => {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } });
  });

  // Global error handler
  app.use(errorHandler);

  return app;
}
