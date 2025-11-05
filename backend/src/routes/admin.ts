import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { verifyServiceKey } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import firebaseService, { UserTier, TIER_CONFIGS } from '../services/firebaseService.js';
import logger from '../utils/logger.js';

const router = Router();

// All admin routes require service API key
router.use(verifyServiceKey);

const UpdateUserTierSchema = z.object({
  uid: z.string(),
  tier: z.enum(['free', 'pro', 'enterprise']),
  isPaid: z.boolean(),
  paymentStatus: z.enum(['active', 'past_due', 'canceled', 'trialing', 'none']),
  stripeCustomerId: z.string().optional(),
  stripeSubscriptionId: z.string().optional(),
});

/**
 * POST /api/admin/users/:uid/tier
 * Update user tier (for Stripe webhooks or admin panel)
 */
router.post('/users/:uid/tier', async (req: Request, res: Response) => {
  try {
    const { uid } = req.params;
    const data = UpdateUserTierSchema.parse(req.body);

    await firebaseService.updateUserTier(
      uid,
      data.tier as UserTier,
      data.isPaid,
      data.paymentStatus,
      data.stripeCustomerId,
      data.stripeSubscriptionId
    );

    // Update custom claims for client-side access
    await firebaseService.setUserClaims(uid);

    logger.info('Admin updated user tier', { uid, tier: data.tier });

    res.json({
      success: true,
      message: 'User tier updated successfully',
    });
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    logger.error('Failed to update user tier', { error });
    throw new AppError('Failed to update user tier', 500);
  }
});

/**
 * GET /api/admin/users/:uid
 * Get user data (for admin panel)
 */
router.get('/users/:uid', async (req: Request, res: Response) => {
  try {
    const { uid } = req.params;

    const [userData, stats] = await Promise.all([
      firebaseService.getUserData(uid),
      firebaseService.getUserStats(uid),
    ]);

    if (!userData) {
      throw new AppError('User not found', 404);
    }

    res.json({
      user: userData,
      stats,
    });
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    logger.error('Failed to get user data', { error });
    throw new AppError('Failed to get user data', 500);
  }
});

/**
 * GET /api/admin/tiers
 * Get all tier configurations
 */
router.get('/tiers', (req: Request, res: Response) => {
  res.json({
    tiers: TIER_CONFIGS,
  });
});

/**
 * POST /api/admin/users/:uid/reset-billing
 * Manually reset user billing cycle (for support)
 */
router.post('/users/:uid/reset-billing', async (req: Request, res: Response) => {
  try {
    const { uid } = req.params;

    const userData = await firebaseService.getUserData(uid);
    if (!userData) {
      throw new AppError('User not found', 404);
    }

    await firebaseService.resetBillingCycle(uid, userData);

    logger.info('Admin reset billing cycle', { uid });

    res.json({
      success: true,
      message: 'Billing cycle reset successfully',
    });
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    logger.error('Failed to reset billing cycle', { error });
    throw new AppError('Failed to reset billing cycle', 500);
  }
});

/**
 * POST /api/admin/users/:uid/grant-tokens
 * Grant bonus tokens to user (for promotions/support)
 */
router.post('/users/:uid/grant-tokens', async (req: Request, res: Response) => {
  try {
    const { uid } = req.params;
    const { tokens } = z.object({ tokens: z.number().positive() }).parse(req.body);

    // Track negative token usage (credit)
    await firebaseService.trackTokenUsage(uid, -tokens);

    logger.info('Admin granted tokens', { uid, tokens });

    res.json({
      success: true,
      message: `Granted ${tokens} tokens to user`,
    });
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    logger.error('Failed to grant tokens', { error });
    throw new AppError('Failed to grant tokens', 500);
  }
});

export default router;

