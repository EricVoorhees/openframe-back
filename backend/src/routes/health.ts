import { Router, Request, Response } from 'express';
import humanlayerClient from '../services/humanlayerClient.js';
import queueService from '../services/queueService.js';
import logger from '../utils/logger.js';

const router = Router();

/**
 * GET /health
 * Basic health check
 */
router.get('/', async (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

/**
 * GET /health/detailed
 * Detailed health check with service status
 */
router.get('/detailed', async (req: Request, res: Response) => {
  try {
    const [humanlayerHealthy, queueMetrics] = await Promise.all([
      humanlayerClient.healthCheck(),
      queueService.getQueueMetrics(),
    ]);

    const health = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      services: {
        humanlayer: humanlayerHealthy ? 'healthy' : 'unhealthy',
        queue: queueMetrics ? 'healthy' : 'unhealthy',
      },
      queue: queueMetrics,
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        unit: 'MB',
      },
    };

    const allHealthy = humanlayerHealthy && queueMetrics !== null;
    const statusCode = allHealthy ? 200 : 503;

    res.status(statusCode).json(health);
  } catch (error) {
    logger.error('Health check failed', { error });
    res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: 'Health check failed',
    });
  }
});

export default router;

