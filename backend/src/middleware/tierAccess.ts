import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth.js';
import firebaseService from '../services/firebaseService.js';
import { AppError } from './errorHandler.js';
import logger from '../utils/logger.js';

/**
 * Middleware to verify user has paid and can access AI features
 */
export const verifyTierAccess = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const uid = req.user?.uid;

    if (!uid) {
      throw new AppError('User ID is required', 401);
    }

    // Verify user access (payment status, quotas, etc.)
    const accessCheck = await firebaseService.verifyUserAccess(uid);

    if (!accessCheck.allowed) {
      // Return specific error with reason
      res.status(403).json({
        error: 'Access Denied',
        message: accessCheck.reason || 'You do not have access to this feature',
        tier: accessCheck.userData.tier,
        paymentStatus: accessCheck.userData.paymentStatus,
        tokensUsed: accessCheck.userData.tokensUsedThisMonth,
        tokenLimit: accessCheck.tierConfig.monthlyTokenLimit,
        upgradeUrl: '/pricing', // Your pricing page
      });
      return;
    }

    // Attach user data to request for later use
    req.userData = accessCheck.userData;
    req.tierConfig = accessCheck.tierConfig;

    logger.debug('User tier access verified', {
      uid,
      tier: accessCheck.userData.tier,
      concurrentAgents: accessCheck.userData.currentConcurrentAgents,
    });

    next();
  } catch (error) {
    logger.error('Tier access verification failed', { error });
    
    if (error instanceof AppError) {
      throw error;
    }
    
    throw new AppError('Failed to verify access', 500);
  }
};

/**
 * Middleware to check specific feature access
 */
export const requireFeature = (feature: string) => {
  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const uid = req.user?.uid;

      if (!uid) {
        throw new AppError('User ID is required', 401);
      }

      const hasAccess = await firebaseService.hasFeatureAccess(uid, feature);

      if (!hasAccess) {
        res.status(403).json({
          error: 'Feature Not Available',
          message: `This feature requires a higher tier subscription`,
          feature,
          upgradeUrl: '/pricing',
        });
        return;
      }

      next();
    } catch (error) {
      logger.error('Feature access check failed', { feature, error });
      throw new AppError('Failed to verify feature access', 500);
    }
  };
};

/**
 * Extend AuthenticatedRequest to include user data
 */
declare module './auth.js' {
  interface AuthenticatedRequest {
    userData?: import('../services/firebaseService.js').UserData;
    tierConfig?: import('../services/firebaseService.js').UserTierConfig;
  }
}

