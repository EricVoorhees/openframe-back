import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { verifyTierAccess, requireFeature } from '../middleware/tierAccess.js';
import { CreateTaskRequestSchema, GetTaskResponse } from '../types/index.js';
import { AppError } from '../middleware/errorHandler.js';
import queueService from '../services/queueService.js';
import auditService from '../services/auditService.js';
import backblazeService from '../services/backblazeService.js';
import firebaseService from '../services/firebaseService.js';
import logger from '../utils/logger.js';
import { Task } from '../types/index.js';

const router = Router();

/**
 * POST /api/agent/tasks
 * Create a new agent task
 * Requires tier access verification
 */
router.post('/tasks', verifyTierAccess, async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Validate request body
    const validatedData = CreateTaskRequestSchema.parse(req.body);

    // Get user ID from authenticated request
    const userId = req.user?.uid || validatedData.userId;
    if (!userId) {
      throw new AppError('User ID is required', 400);
    }

    // User data and tier config already verified by verifyTierAccess middleware
    const userData = req.userData!;
    const tierConfig = req.tierConfig!;

    logger.info('Creating task for user', {
      userId,
      tier: userData.tier,
      concurrentAgents: userData.currentConcurrentAgents,
      tokensUsed: userData.tokensUsedThisMonth,
    });

    // Create task
    const task: Task = {
      id: uuidv4(),
      userId,
      projectId: validatedData.projectId,
      files: validatedData.files,
      cursor: validatedData.cursor,
      prompt: validatedData.prompt,
      mode: validatedData.mode,
      status: 'queued',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Log task creation
    await auditService.logTaskCreated(task);

    // Optionally upload files to Backblaze for persistence
    try {
      await backblazeService.uploadProjectFiles(
        `${task.projectId}/tasks/${task.id}`,
        task.files
      );
    } catch (error) {
      logger.warn('Failed to upload task files to Backblaze', { error });
      // Continue even if upload fails
    }

    // Enqueue task
    await queueService.enqueueTask(task);

    logger.info('Agent task created', {
      taskId: task.id,
      userId,
      projectId: task.projectId,
    });

    res.status(201).json({
      taskId: task.id,
      status: task.status,
    });
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    logger.error('Failed to create agent task', { error });
    throw new AppError('Failed to create agent task', 500);
  }
});

/**
 * GET /api/agent/tasks/:taskId
 * Get task status and results
 */
router.get('/tasks/:taskId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { taskId } = req.params;
    const userId = req.user?.uid;

    if (!userId) {
      throw new AppError('User ID is required', 401);
    }

    // Get task from queue
    const task = await queueService.getTaskStatus(taskId);

    if (!task) {
      throw new AppError('Task not found', 404);
    }

    // Verify user owns this task
    if (task.userId !== userId) {
      throw new AppError('Unauthorized access to task', 403);
    }

    const response: GetTaskResponse = {
      taskId: task.id,
      status: task.status,
      result: task.result,
      metrics: task.metrics,
      error: task.error,
    };

    res.json(response);
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    logger.error('Failed to get task status', { error });
    throw new AppError('Failed to get task status', 500);
  }
});

/**
 * DELETE /api/agent/tasks/:taskId
 * Cancel a task
 */
router.delete('/tasks/:taskId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { taskId } = req.params;
    const userId = req.user?.uid;

    if (!userId) {
      throw new AppError('User ID is required', 401);
    }

    // Get task to verify ownership
    const task = await queueService.getTaskStatus(taskId);

    if (!task) {
      throw new AppError('Task not found', 404);
    }

    if (task.userId !== userId) {
      throw new AppError('Unauthorized access to task', 403);
    }

    // Cancel task
    const cancelled = await queueService.cancelTask(taskId);

    if (!cancelled) {
      throw new AppError('Failed to cancel task', 500);
    }

    logger.info('Task cancelled', { taskId, userId });

    res.json({
      success: true,
      message: 'Task cancelled successfully',
    });
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    logger.error('Failed to cancel task', { error });
    throw new AppError('Failed to cancel task', 500);
  }
});

/**
 * POST /api/agent/tasks/:taskId/accept
 * Accept a patch and optionally save to Backblaze
 */
router.post('/tasks/:taskId/accept', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { taskId } = req.params;
    const userId = req.user?.uid;

    if (!userId) {
      throw new AppError('User ID is required', 401);
    }

    const task = await queueService.getTaskStatus(taskId);

    if (!task) {
      throw new AppError('Task not found', 404);
    }

    if (task.userId !== userId) {
      throw new AppError('Unauthorized access to task', 403);
    }

    // Log acceptance
    await auditService.logPatchDecision(userId, task.projectId, taskId, true);

    logger.info('Patch accepted', { taskId, userId });

    res.json({
      success: true,
      message: 'Patch accepted',
    });
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    logger.error('Failed to accept patch', { error });
    throw new AppError('Failed to accept patch', 500);
  }
});

/**
 * POST /api/agent/tasks/:taskId/reject
 * Reject a patch
 */
router.post('/tasks/:taskId/reject', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { taskId } = req.params;
    const userId = req.user?.uid;

    if (!userId) {
      throw new AppError('User ID is required', 401);
    }

    const task = await queueService.getTaskStatus(taskId);

    if (!task) {
      throw new AppError('Task not found', 404);
    }

    if (task.userId !== userId) {
      throw new AppError('Unauthorized access to task', 403);
    }

    // Log rejection
    await auditService.logPatchDecision(userId, task.projectId, taskId, false);

    logger.info('Patch rejected', { taskId, userId });

    res.json({
      success: true,
      message: 'Patch rejected',
    });
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    logger.error('Failed to reject patch', { error });
    throw new AppError('Failed to reject patch', 500);
  }
});

/**
 * GET /api/agent/stats
 * Get user statistics from Firebase
 */
router.get('/stats', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.uid;

    if (!userId) {
      throw new AppError('User ID is required', 401);
    }

    // Get stats from Firebase
    const stats = await firebaseService.getUserStats(userId);
    const userData = await firebaseService.getUserData(userId);

    res.json({
      tier: stats.tier,
      isPaid: userData?.isPaid || false,
      paymentStatus: stats.paymentStatus,
      usage: {
        tokensUsed: stats.tokensUsed,
        tokensRemaining: stats.tokensRemaining,
        tasksCompleted: stats.tasksCompleted,
      },
      limits: {
        maxConcurrentAgents: stats.maxConcurrentAgents,
        currentConcurrentAgents: stats.concurrentAgents,
      },
      billingCycle: {
        endsAt: stats.billingCycleEnd,
      },
    });
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    logger.error('Failed to get user stats', { error });
    throw new AppError('Failed to get user stats', 500);
  }
});

export default router;

