import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

export const PLACEHOLDER_APP_GATE_SECRET = 'replace_with_secure_random_secret_min_32_chars_for_apps';

export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.string().default('4001').transform(Number),
    MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
    JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 chars'),
    APP_GATE_SECRET: z
      .string()
      .min(32, 'APP_GATE_SECRET must be at least 32 chars')
      .default(PLACEHOLDER_APP_GATE_SECRET),
    APP_CACHE_TTL_MS: z.string().default('30000').transform(Number),
    RATE_LIMIT_WINDOW_MS: z.string().default('900000').transform(Number),
    RATE_LIMIT_MAX: z.string().default('100').transform(Number),
    CORS_ORIGINS: z.string().default('http://localhost:3000,http://localhost:3001'),

    // RS256 Configuration (Optional in Phase 2; public key only)
    JWT_PUBLIC_KEY_PATH: z.string().optional(),
    JWT_PUBLIC_KEY: z.string().optional(),
    JWT_ISSUER: z.string().min(1).default('myroot-backend'),
    JWT_AUDIENCE: z.string().min(1).default('myroot-platform'),
    JWT_ALLOW_HS256_FALLBACK: z.enum(['true', 'false']).default('false').transform((v) => v === 'true'),
  })
  .refine(
    (data) => {
      if (data.NODE_ENV === 'production') {
        return (
          data.APP_GATE_SECRET &&
          data.APP_GATE_SECRET.length >= 32 &&
          data.APP_GATE_SECRET !== PLACEHOLDER_APP_GATE_SECRET
        );
      }
      return true;
    },
    {
      message: 'APP_GATE_SECRET must be explicitly configured in production and cannot use the placeholder literal',
      path: ['APP_GATE_SECRET'],
    }
  );

const parseResult = envSchema.safeParse(process.env);

if (!parseResult.success) {
  console.error('❌ Invalid environment configuration:');
  console.error(parseResult.error.format());
  process.exit(1);
}

export const env = parseResult.data;
