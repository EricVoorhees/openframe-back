import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import Redis from 'ioredis';
import config from '../config/index.js';
import logger from '../utils/logger.js';

// Create Redis client for rate limiting
const redisClient = new Redis({
  host: config.REDIS_HOST,
  port: config.REDIS_PORT,
  password: config.REDIS_PASSWORD,
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: true,
});

redisClient.on('error', (err) => {
  logger.error('Redis rate limit client error', { error: err });
});

redisClient.on('connect', () => {
  logger.info('Redis rate limit client connected');
});

// Connect to Redis
redisClient.connect().catch((err) => {
  logger.error('Failed to connect Redis rate limit client', { error: err });
});

/**
 * Rate limiter for general API endpoints
 */
export const apiRateLimiter = rateLimit({
  windowMs: config.RATE_LIMIT_WINDOW_MS,
  max: config.RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore({
    // @ts-expect-error - RedisStore types are not fully compatible
    client: redisClient,
    prefix: 'rl:api:',
  }),
  message: {
    error: 'Too Many Requests',
    message: 'Too many requests from this IP, please try again later.',
  },
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.path === '/health' || req.path === '/api/health';
  },
});

/**
 * Stricter rate limiter for agent task creation
 */
export const agentTaskRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore({
    // @ts-expect-error - RedisStore types are not fully compatible
    client: redisClient,
    prefix: 'rl:agent:',
  }),
  message: {
    error: 'Too Many Requests',
    message: 'Too many agent task requests, please slow down.',
  },
  keyGenerator: (req) => {
    // Rate limit per user if authenticated
    const user = (req as any).user;
    return user?.uid || req.ip || 'anonymous';
  },
});

/**
 * Very strict rate limiter for expensive operations
 */
export const expensiveOperationRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50, // 50 requests per hour
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore({
    // @ts-expect-error - RedisStore types are not fully compatible
    client: redisClient,
    prefix: 'rl:expensive:',
  }),
  message: {
    error: 'Rate Limit Exceeded',
    message: 'You have exceeded your hourly quota for this operation.',
  },
  keyGenerator: (req) => {
    const user = (req as any).user;
    return user?.uid || req.ip || 'anonymous';
  },
});

export { redisClient };
export default { apiRateLimiter, agentTaskRateLimiter, expensiveOperationRateLimiter };

