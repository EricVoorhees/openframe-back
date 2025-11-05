import { Router, Response } from 'express';
import { z } from 'zod';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import backblazeService from '../services/backblazeService.js';
import logger from '../utils/logger.js';

const router = Router();

const SaveProjectRequestSchema = z.object({
  projectId: z.string(),
  files: z.array(z.object({
    path: z.string(),
    content: z.string(),
  })),
});

/**
 * POST /api/projects/save
 * Save project files to Backblaze
 */
router.post('/save', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.uid;
    if (!userId) {
      throw new AppError('User ID is required', 401);
    }

    const { projectId, files } = SaveProjectRequestSchema.parse(req.body);

    // Upload files to Backblaze
    await backblazeService.uploadProjectFiles(`${userId}/${projectId}`, files);

    logger.info('Project saved', { userId, projectId, fileCount: files.length });

    res.json({
      success: true,
      message: 'Project saved successfully',
      fileCount: files.length,
    });
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    logger.error('Failed to save project', { error });
    throw new AppError('Failed to save project', 500);
  }
});

/**
 * GET /api/projects/:projectId
 * Load project files from Backblaze
 */
router.get('/:projectId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.uid;
    if (!userId) {
      throw new AppError('User ID is required', 401);
    }

    const { projectId } = req.params;

    // Download files from Backblaze
    const files = await backblazeService.downloadProjectFiles(`${userId}/${projectId}`);

    logger.info('Project loaded', { userId, projectId, fileCount: files.length });

    res.json({
      projectId,
      files,
    });
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    logger.error('Failed to load project', { error });
    throw new AppError('Failed to load project', 500);
  }
});

/**
 * GET /api/projects/:projectId/files
 * List project files
 */
router.get('/:projectId/files', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.uid;
    if (!userId) {
      throw new AppError('User ID is required', 401);
    }

    const { projectId } = req.params;

    // List files from Backblaze
    const fileKeys = await backblazeService.listFiles(`${userId}/${projectId}`);

    logger.info('Project files listed', { userId, projectId, fileCount: fileKeys.length });

    res.json({
      projectId,
      files: fileKeys,
    });
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    logger.error('Failed to list project files', { error });
    throw new AppError('Failed to list project files', 500);
  }
});

export default router;

