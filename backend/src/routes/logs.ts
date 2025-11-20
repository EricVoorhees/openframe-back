import { Router, Response, Request } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.js';

interface AuthenticatedLogRequest extends AuthenticatedRequest {
  body: any;
}
import { LogSummarySchema, LogAnalysisResponseSchema } from '../types/index.js';
import { AppError } from '../middleware/errorHandler.js';
import humanlayerClient from '../services/humanlayerClient.js';
import auditService from '../services/auditService.js';
import logger from '../utils/logger.js';

const router = Router();

/**
 * POST /api/logs/analyze
 * Analyze development session logs using HumanLayer AI
 */
router.post('/analyze', async (req: AuthenticatedLogRequest, res: Response) => {
  const startTime = Date.now();
  logger.info('[LOGS] Analyze endpoint hit', {
    hasAuth: !!req.user,
    userId: req.user?.uid,
    bodySize: JSON.stringify(req.body).length,
    headers: {
      serviceKey: !!req.headers['x-service-key'],
      auth: !!req.headers.authorization,
    }
  });

  try {
    // Validate request body
    logger.debug('[LOGS] Validating request body');
    const logSummary = LogSummarySchema.parse(req.body);
    
    const userId = req.user?.uid;
    if (!userId) {
      logger.error('[LOGS] No user ID found');
      throw new AppError('User ID is required', 401);
    }

    logger.info('[LOGS] Log analysis requested', {
      userId,
      summary_id: logSummary.summary_id,
      session_id: logSummary.session_id,
      total_logs: logSummary.total_logs,
      error_count: logSummary.error_count,
    });

    // Call HumanLayer for AI analysis
    const analysisResult = await humanlayerClient.analyzeLogs(logSummary);

    // Validate response structure
    const validatedResponse = LogAnalysisResponseSchema.parse(analysisResult);

    // Log the analysis for audit purposes
    await auditService.logAction(
      userId,
      logSummary.session_id,
      'log_analysis',
      {
        summary_id: logSummary.summary_id,
        total_logs: logSummary.total_logs,
        error_count: logSummary.error_count,
        insights_generated: validatedResponse.key_insights.length,
        recommendations_generated: validatedResponse.recommendations.length,
      }
    );

    logger.info('Log analysis completed successfully', {
      userId,
      summary_id: logSummary.summary_id,
      narrative_length: validatedResponse.narrative.length,
      insights_count: validatedResponse.key_insights.length,
      recommendations_count: validatedResponse.recommendations.length,
    });

    res.json(validatedResponse);
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    logger.error('Failed to analyze logs', { error });
    throw new AppError('Failed to analyze logs', 500);
  }
});

/**
 * GET /api/logs/health
 * Check if log analysis service is available
 */
router.get('/health', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const isHealthy = await humanlayerClient.healthCheck();
    
    res.json({
      status: isHealthy ? 'healthy' : 'unhealthy',
      service: 'log-analysis',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Log analysis health check failed', { error });
    res.status(503).json({
      status: 'unhealthy',
      service: 'log-analysis',
      error: 'Service unavailable',
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;