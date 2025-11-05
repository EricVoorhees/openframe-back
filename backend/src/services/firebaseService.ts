import admin from 'firebase-admin';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import config from '../config/index.js';
import logger from '../utils/logger.js';
import { AppError } from '../middleware/errorHandler.js';

// Initialize Firebase Admin (if not already initialized)
let firebaseApp: admin.app.App;
let db: FirebaseFirestore.Firestore;

try {
  firebaseApp = admin.app();
  logger.info('Firebase app already initialized');
} catch (error) {
  firebaseApp = admin.initializeApp({
    credential: admin.credential.cert({
      projectId: config.FIREBASE_PROJECT_ID,
      privateKey: config.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      clientEmail: config.FIREBASE_CLIENT_EMAIL,
    }),
  });
  logger.info('Firebase Admin initialized');
}

db = getFirestore(firebaseApp);

// ============================================================================
// User Tier Types
// ============================================================================

export enum UserTier {
  FREE = 'free',
  PRO = 'pro',
  ENTERPRISE = 'enterprise',
}

export interface UserTierConfig {
  tier: UserTier;
  monthlyTokenLimit: number;
  maxConcurrentAgents: number;
  tasksPerMinute: number;
  features: string[];
  price: number; // in cents
}

export const TIER_CONFIGS: Record<UserTier, UserTierConfig> = {
  [UserTier.FREE]: {
    tier: UserTier.FREE,
    monthlyTokenLimit: 50000, // 50K tokens/month
    maxConcurrentAgents: 1,
    tasksPerMinute: 5,
    features: ['basic_ai', 'patch', 'explain'],
    price: 0,
  },
  [UserTier.PRO]: {
    tier: UserTier.PRO,
    monthlyTokenLimit: 1000000, // 1M tokens/month
    maxConcurrentAgents: 3,
    tasksPerMinute: 20,
    features: ['basic_ai', 'patch', 'explain', 'generate_test', 'lint_fix', 'priority_queue'],
    price: 2900, // $29/month
  },
  [UserTier.ENTERPRISE]: {
    tier: UserTier.ENTERPRISE,
    monthlyTokenLimit: 10000000, // 10M tokens/month
    maxConcurrentAgents: 10,
    tasksPerMinute: 100,
    features: ['all', 'dedicated_support', 'custom_models', 'sla'],
    price: 29900, // $299/month
  },
};

// ============================================================================
// User Data Structure in Firestore
// ============================================================================

export interface UserData {
  uid: string;
  email: string;
  tier: UserTier;
  isPaid: boolean;
  paymentStatus: 'active' | 'past_due' | 'canceled' | 'trialing' | 'none';
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  
  // Usage tracking
  tokensUsedThisMonth: number;
  tasksCompletedThisMonth: number;
  currentConcurrentAgents: number;
  
  // Metadata
  createdAt: Timestamp;
  updatedAt: Timestamp;
  billingCycleStart: Timestamp;
  billingCycleEnd: Timestamp;
  
  // Features
  enabledFeatures: string[];
}

// ============================================================================
// Firebase Service Class
// ============================================================================

class FirebaseService {
  private db: FirebaseFirestore.Firestore;

  constructor() {
    this.db = db;
  }

  /**
   * Get user data from Firestore
   */
  async getUserData(uid: string): Promise<UserData | null> {
    try {
      const userDoc = await this.db.collection('users').doc(uid).get();
      
      if (!userDoc.exists) {
        return null;
      }

      return userDoc.data() as UserData;
    } catch (error) {
      logger.error('Failed to get user data', { uid, error });
      throw new AppError('Failed to get user data', 500);
    }
  }

  /**
   * Create or update user data
   */
  async upsertUserData(uid: string, email: string): Promise<UserData> {
    try {
      const userRef = this.db.collection('users').doc(uid);
      const userDoc = await userRef.get();

      const now = Timestamp.now();
      const billingCycleEnd = Timestamp.fromDate(
        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
      );

      if (!userDoc.exists) {
        // Create new user with FREE tier
        const userData: UserData = {
          uid,
          email,
          tier: UserTier.FREE,
          isPaid: false,
          paymentStatus: 'none',
          tokensUsedThisMonth: 0,
          tasksCompletedThisMonth: 0,
          currentConcurrentAgents: 0,
          createdAt: now,
          updatedAt: now,
          billingCycleStart: now,
          billingCycleEnd,
          enabledFeatures: TIER_CONFIGS[UserTier.FREE].features,
        };

        await userRef.set(userData);
        logger.info('Created new user', { uid, tier: UserTier.FREE });
        return userData;
      }

      // Update existing user
      const userData = userDoc.data() as UserData;
      userData.updatedAt = now;
      
      await userRef.update({ updatedAt: now });
      return userData;
    } catch (error) {
      logger.error('Failed to upsert user data', { uid, error });
      throw new AppError('Failed to create/update user data', 500);
    }
  }

  /**
   * Verify user has valid subscription and can use AI features
   */
  async verifyUserAccess(uid: string): Promise<{
    allowed: boolean;
    reason?: string;
    userData: UserData;
    tierConfig: UserTierConfig;
  }> {
    try {
      let userData = await this.getUserData(uid);

      // Create user if doesn't exist
      if (!userData) {
        const user = await admin.auth().getUser(uid);
        userData = await this.upsertUserData(uid, user.email || 'unknown');
      }

      const tierConfig = TIER_CONFIGS[userData.tier];

      // Check if billing cycle needs reset
      const now = new Date();
      if (now > userData.billingCycleEnd.toDate()) {
        await this.resetBillingCycle(uid, userData);
        userData = await this.getUserData(uid);
        if (!userData) throw new Error('User data not found after reset');
      }

      // Check payment status for paid tiers
      if (userData.tier !== UserTier.FREE && !userData.isPaid) {
        return {
          allowed: false,
          reason: 'Payment required. Please upgrade your subscription.',
          userData,
          tierConfig,
        };
      }

      if (userData.tier !== UserTier.FREE && userData.paymentStatus !== 'active' && userData.paymentStatus !== 'trialing') {
        return {
          allowed: false,
          reason: `Subscription is ${userData.paymentStatus}. Please update your payment method.`,
          userData,
          tierConfig,
        };
      }

      // Check token quota
      if (userData.tokensUsedThisMonth >= tierConfig.monthlyTokenLimit) {
        return {
          allowed: false,
          reason: `Monthly token limit exceeded (${tierConfig.monthlyTokenLimit}). Upgrade your plan or wait for next billing cycle.`,
          userData,
          tierConfig,
        };
      }

      // Check concurrent agents limit
      if (userData.currentConcurrentAgents >= tierConfig.maxConcurrentAgents) {
        return {
          allowed: false,
          reason: `Maximum concurrent agents reached (${tierConfig.maxConcurrentAgents}). Please wait for current tasks to complete.`,
          userData,
          tierConfig,
        };
      }

      return {
        allowed: true,
        userData,
        tierConfig,
      };
    } catch (error) {
      logger.error('Failed to verify user access', { uid, error });
      throw new AppError('Failed to verify user access', 500);
    }
  }

  /**
   * Increment concurrent agent count
   */
  async incrementConcurrentAgents(uid: string): Promise<void> {
    try {
      const userRef = this.db.collection('users').doc(uid);
      await userRef.update({
        currentConcurrentAgents: admin.firestore.FieldValue.increment(1),
        updatedAt: Timestamp.now(),
      });
      
      logger.debug('Incremented concurrent agents', { uid });
    } catch (error) {
      logger.error('Failed to increment concurrent agents', { uid, error });
      throw new AppError('Failed to update concurrent agents', 500);
    }
  }

  /**
   * Decrement concurrent agent count
   */
  async decrementConcurrentAgents(uid: string): Promise<void> {
    try {
      const userRef = this.db.collection('users').doc(uid);
      const userData = await this.getUserData(uid);
      
      if (userData && userData.currentConcurrentAgents > 0) {
        await userRef.update({
          currentConcurrentAgents: admin.firestore.FieldValue.increment(-1),
          updatedAt: Timestamp.now(),
        });
        
        logger.debug('Decremented concurrent agents', { uid });
      }
    } catch (error) {
      logger.error('Failed to decrement concurrent agents', { uid, error });
      // Don't throw - this is cleanup
    }
  }

  /**
   * Track token usage
   */
  async trackTokenUsage(uid: string, tokensUsed: number): Promise<void> {
    try {
      const userRef = this.db.collection('users').doc(uid);
      
      await userRef.update({
        tokensUsedThisMonth: admin.firestore.FieldValue.increment(tokensUsed),
        tasksCompletedThisMonth: admin.firestore.FieldValue.increment(1),
        updatedAt: Timestamp.now(),
      });

      logger.info('Tracked token usage', { uid, tokensUsed });

      // Also update in audit collection for historical tracking
      await this.db.collection('usage_logs').add({
        uid,
        tokensUsed,
        timestamp: Timestamp.now(),
        type: 'task_completion',
      });
    } catch (error) {
      logger.error('Failed to track token usage', { uid, tokensUsed, error });
      throw new AppError('Failed to track token usage', 500);
    }
  }

  /**
   * Reset billing cycle
   */
  async resetBillingCycle(uid: string, userData: UserData): Promise<void> {
    try {
      const userRef = this.db.collection('users').doc(uid);
      const now = Timestamp.now();
      const billingCycleEnd = Timestamp.fromDate(
        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      );

      await userRef.update({
        tokensUsedThisMonth: 0,
        tasksCompletedThisMonth: 0,
        billingCycleStart: now,
        billingCycleEnd,
        updatedAt: now,
      });

      logger.info('Reset billing cycle', { uid, previousTokens: userData.tokensUsedThisMonth });
    } catch (error) {
      logger.error('Failed to reset billing cycle', { uid, error });
      throw new AppError('Failed to reset billing cycle', 500);
    }
  }

  /**
   * Update user tier (when they subscribe/upgrade)
   */
  async updateUserTier(
    uid: string,
    tier: UserTier,
    isPaid: boolean,
    paymentStatus: 'active' | 'past_due' | 'canceled' | 'trialing' | 'none',
    stripeCustomerId?: string,
    stripeSubscriptionId?: string
  ): Promise<void> {
    try {
      const userRef = this.db.collection('users').doc(uid);
      const tierConfig = TIER_CONFIGS[tier];

      await userRef.update({
        tier,
        isPaid,
        paymentStatus,
        stripeCustomerId,
        stripeSubscriptionId,
        enabledFeatures: tierConfig.features,
        updatedAt: Timestamp.now(),
      });

      logger.info('Updated user tier', { uid, tier, isPaid, paymentStatus });
    } catch (error) {
      logger.error('Failed to update user tier', { uid, tier, error });
      throw new AppError('Failed to update user tier', 500);
    }
  }

  /**
   * Get user statistics
   */
  async getUserStats(uid: string): Promise<{
    tier: UserTier;
    tokensUsed: number;
    tokensRemaining: number;
    tasksCompleted: number;
    concurrentAgents: number;
    maxConcurrentAgents: number;
    billingCycleEnd: Date;
    paymentStatus: string;
  }> {
    try {
      const userData = await this.getUserData(uid);
      if (!userData) {
        throw new AppError('User not found', 404);
      }

      const tierConfig = TIER_CONFIGS[userData.tier];

      return {
        tier: userData.tier,
        tokensUsed: userData.tokensUsedThisMonth,
        tokensRemaining: Math.max(0, tierConfig.monthlyTokenLimit - userData.tokensUsedThisMonth),
        tasksCompleted: userData.tasksCompletedThisMonth,
        concurrentAgents: userData.currentConcurrentAgents,
        maxConcurrentAgents: tierConfig.maxConcurrentAgents,
        billingCycleEnd: userData.billingCycleEnd.toDate(),
        paymentStatus: userData.paymentStatus,
      };
    } catch (error) {
      logger.error('Failed to get user stats', { uid, error });
      throw new AppError('Failed to get user stats', 500);
    }
  }

  /**
   * Check if user has feature access
   */
  async hasFeatureAccess(uid: string, feature: string): Promise<boolean> {
    try {
      const userData = await this.getUserData(uid);
      if (!userData) return false;

      return (
        userData.enabledFeatures.includes(feature) ||
        userData.enabledFeatures.includes('all')
      );
    } catch (error) {
      logger.error('Failed to check feature access', { uid, feature, error });
      return false;
    }
  }

  /**
   * Set custom claims on Firebase Auth token (for client-side checks)
   */
  async setUserClaims(uid: string): Promise<void> {
    try {
      const userData = await this.getUserData(uid);
      if (!userData) return;

      await admin.auth().setCustomUserClaims(uid, {
        tier: userData.tier,
        isPaid: userData.isPaid,
        paymentStatus: userData.paymentStatus,
      });

      logger.info('Set custom user claims', { uid, tier: userData.tier });
    } catch (error) {
      logger.error('Failed to set custom claims', { uid, error });
      // Don't throw - this is optional enhancement
    }
  }
}

export default new FirebaseService();

