import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const configSchema = z.object({
  // Server
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).default('3001'),
  HOST: z.string().default('0.0.0.0'),

  // Firebase
  FIREBASE_PROJECT_ID: z.string(),
  FIREBASE_PRIVATE_KEY: z.string(),
  FIREBASE_CLIENT_EMAIL: z.string(),

  // HumanLayer
  HUMANLAYER_DAEMON_URL: z.string().url().default('http://localhost:7777'),
  HUMANLAYER_SERVICE_KEY: z.string(),

  // Redis
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.string().transform(Number).default('6379'),
  REDIS_PASSWORD: z.string().optional(),

  // Backblaze B2
  B2_APPLICATION_KEY_ID: z.string(),
  B2_APPLICATION_KEY: z.string(),
  B2_BUCKET_NAME: z.string(),
  B2_BUCKET_ID: z.string(),
  B2_REGION: z.string().default('us-west-002'),

  // LLM Provider
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  LLM_PROVIDER: z.enum(['openai', 'anthropic']).default('anthropic'),

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.string().transform(Number).default('900000'),
  RATE_LIMIT_MAX_REQUESTS: z.string().transform(Number).default('100'),

  // Task Queue
  QUEUE_CONCURRENCY: z.string().transform(Number).default('5'),
  QUEUE_MAX_RETRIES: z.string().transform(Number).default('3'),

  // Logging
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),

  // Security
  JWT_SECRET: z.string(),
  SERVICE_API_KEY: z.string(),
});

export type Config = z.infer<typeof configSchema>;

let config: Config;

try {
  config = configSchema.parse(process.env);
} catch (error) {
  if (error instanceof z.ZodError) {
    console.error('❌ Invalid environment configuration:');
    error.errors.forEach((err) => {
      console.error(`  - ${err.path.join('.')}: ${err.message}`);
    });
    process.exit(1);
  }
  throw error;
}

export default config;

