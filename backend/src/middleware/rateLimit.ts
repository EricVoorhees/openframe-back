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
  enableReadyCheck: false, // Disable to prevent connection checks
  lazyConnect: true, // Don't connect immediately
  retryStrategy: (times) => {
    if (times > 3) {
      logger.warn('Redis rate limit connection failed after 3 retries');
      return null; // Stop retrying
    }
    return Math.min(times * 50, 2000);
  },
});

redisClient.on('error', (err) => {
  logger.error('Redis rate limit client error', { 
    error: err instanceof Error ? err.message : 'Unknown error',
    errorType: err?.constructor?.name,
  });
  // Don't throw - just log
});

redisClient.on('connect', () => {
  logger.info('Redis rate limit client connected');
});

redisClient.on('ready', () => {
  logger.info('Redis rate limit client ready');
});

redisClient.on('close', () => {
  logger.warn('Redis rate limit client closed');
});

redisClient.on('reconnecting', () => {
  logger.info('Redis rate limit client reconnecting...');
});

// Connect to Redis with better error handling
redisClient.connect().catch((err) => {
  logger.error('Failed to connect Redis rate limit client - rate limiting will use memory store', { 
    error: err instanceof Error ? err.message : 'Unknown error',
  });
  // Don't propagate the error - it's handled
});

/**
 * Rate limiter for general API endpoints
 */
let apiRateLimiterStore;
try {
  apiRateLimiterStore = new RedisStore({
    // @ts-expect-error - RedisStore types are not fully compatible
    client: redisClient,
    prefix: 'rl:api:',
  });
} catch (err) {
  logger.warn('Failed to create Redis store for rate limiter, using memory store', { error: err });
  apiRateLimiterStore = undefined; // Will use default memory store
}

export const apiRateLimiter = rateLimit({
  windowMs: config.RATE_LIMIT_WINDOW_MS,
  max: config.RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  store: apiRateLimiterStore,
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
let agentTaskRateLimiterStore;
try {
  agentTaskRateLimiterStore = new RedisStore({
    // @ts-expect-error - RedisStore types are not fully compatible
    client: redisClient,
    prefix: 'rl:agent:',
  });
} catch (err) {
  logger.warn('Failed to create Redis store for agent task rate limiter', { error: err });
  agentTaskRateLimiterStore = undefined;
}

export const agentTaskRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  store: agentTaskRateLimiterStore,
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
let expensiveOperationRateLimiterStore;
try {
  expensiveOperationRateLimiterStore = new RedisStore({
    // @ts-expect-error - RedisStore types are not fully compatible
    client: redisClient,
    prefix: 'rl:expensive:',
  });
} catch (err) {
  logger.warn('Failed to create Redis store for expensive operation rate limiter', { error: err });
  expensiveOperationRateLimiterStore = undefined;
}

export const expensiveOperationRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50, // 50 requests per hour
  standardHeaders: true,
  legacyHeaders: false,
  store: expensiveOperationRateLimiterStore,
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

