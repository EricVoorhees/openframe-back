import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import config from './config/index.js';
import logger from './utils/logger.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { verifyFirebaseToken, verifyAuth } from './middleware/auth.js';
import { apiRateLimiter, agentTaskRateLimiter } from './middleware/rateLimit.js';

// Import routes
import healthRoutes from './routes/health.js';
import agentRoutes from './routes/agent.js';
import projectRoutes from './routes/projects.js';
import adminRoutes from './routes/admin.js';
import webhookRoutes from './routes/webhooks.js';
import logsRoutes from './routes/logs.js';

const app: Express = express();

// ============================================================================
// Trust Proxy (Required for Render/production deployments)
// ============================================================================
// Enable trust proxy so Express can read X-Forwarded-* headers from Render
app.set('trust proxy', 1);

// ============================================================================
// Middleware
// ============================================================================

// Security
app.use(helmet());

// CORS
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  credentials: true,
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use((req, res, next) => {
  logger.info('Incoming request', {
    method: req.method,
    path: req.path,
    ip: req.ip,
  });
  next();
});

// ============================================================================
// Routes
// ============================================================================

// Health check (no auth required)
app.use('/health', healthRoutes);
app.use('/api/health', healthRoutes);

// Webhooks (no auth on Stripe webhook, they verify signature)
app.use('/api/webhooks', webhookRoutes);

// API routes (with auth and rate limiting)
app.use('/api/agent', apiRateLimiter, agentTaskRateLimiter, verifyFirebaseToken, agentRoutes);
app.use('/api/projects', apiRateLimiter, verifyFirebaseToken, projectRoutes);
// Logs endpoint supports both Firebase token AND service key (for desktop apps)
app.use('/api/logs', apiRateLimiter, verifyAuth, logsRoutes);

// Admin routes (service key auth only, no Firebase token needed)
app.use('/api/admin', adminRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'Open Frame Backend API',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: '/health',
      agent: '/api/agent',
      projects: '/api/projects',
      logs: '/api/logs',
    },
  });
});

// ============================================================================
// Error Handling
// ============================================================================

// 404 handler
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

// ============================================================================
// Server Startup
// ============================================================================

const PORT = config.PORT;
const HOST = config.HOST;

const server = app.listen(PORT, HOST, () => {
  logger.info(`🚀 Server started`, {
    host: HOST,
    port: PORT,
    env: config.NODE_ENV,
  });
  logger.info(`📍 API available at http://${HOST}:${PORT}`);
  logger.info(`💚 Health check at http://${HOST}:${PORT}/health`);
});

// ============================================================================
// Graceful Shutdown
// ============================================================================

const gracefulShutdown = (signal: string) => {
  logger.info(`${signal} received, starting graceful shutdown...`);
  
  server.close(() => {
    logger.info('HTTP server closed');
    
    // Close other connections (Redis, etc.)
    process.exit(0);
  });

  // Force shutdown after 30 seconds
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 30000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', { error });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection', { 
    reason: reason instanceof Error ? { message: reason.message, stack: reason.stack } : reason,
    promiseString: promise?.toString(),
  });
  // Don't exit immediately - log and continue for now to identify the issue
  logger.warn('Continuing despite unhandled rejection...');
});

export default app;

