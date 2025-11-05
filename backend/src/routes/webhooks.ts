import { Router, Request, Response } from 'express';
import { AppError } from '../middleware/errorHandler.js';
import firebaseService, { UserTier } from '../services/firebaseService.js';
import logger from '../utils/logger.js';
import config from '../config/index.js';

const router = Router();

/**
 * POST /api/webhooks/stripe
 * Handle Stripe webhook events (subscription updates)
 * 
 * Setup: Add this URL to Stripe Dashboard -> Webhooks
 * Events to listen for:
 * - customer.subscription.created
 * - customer.subscription.updated
 * - customer.subscription.deleted
 * - invoice.payment_succeeded
 * - invoice.payment_failed
 */
router.post('/stripe', async (req: Request, res: Response) => {
  try {
    // In production, verify Stripe signature
    // const sig = req.headers['stripe-signature'];
    // const event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);

    const event = req.body;

    logger.info('Received Stripe webhook', { type: event.type });

    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        const customerId = subscription.customer;
        const subscriptionId = subscription.id;
        const status = subscription.status;

        // Get user by Stripe customer ID
        // You'll need to query Firestore for user with this stripeCustomerId
        // For now, we'll assume you pass uid in metadata
        const uid = subscription.metadata?.uid;
        
        if (!uid) {
          logger.warn('Subscription webhook missing uid in metadata', { subscriptionId });
          res.json({ received: true });
          return;
        }

        // Determine tier based on price
        const priceId = subscription.items.data[0]?.price?.id;
        let tier: UserTier = UserTier.FREE;
        
        // Map your Stripe price IDs to tiers
        if (priceId === process.env.STRIPE_PRO_PRICE_ID) {
          tier = UserTier.PRO;
        } else if (priceId === process.env.STRIPE_ENTERPRISE_PRICE_ID) {
          tier = UserTier.ENTERPRISE;
        }

        await firebaseService.updateUserTier(
          uid,
          tier,
          status === 'active' || status === 'trialing',
          status as any,
          customerId,
          subscriptionId
        );

        await firebaseService.setUserClaims(uid);

        logger.info('Updated user tier from Stripe webhook', { uid, tier, status });
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const uid = subscription.metadata?.uid;

        if (!uid) {
          logger.warn('Subscription deletion webhook missing uid', { subscription: subscription.id });
          res.json({ received: true });
          return;
        }

        // Downgrade to free tier
        await firebaseService.updateUserTier(
          uid,
          UserTier.FREE,
          false,
          'canceled'
        );

        await firebaseService.setUserClaims(uid);

        logger.info('Downgraded user to free tier', { uid });
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        const customerId = invoice.customer;
        const uid = invoice.subscription_metadata?.uid;

        if (!uid) {
          logger.warn('Payment failed webhook missing uid');
          res.json({ received: true });
          return;
        }

        const userData = await firebaseService.getUserData(uid);
        if (userData) {
          await firebaseService.updateUserTier(
            uid,
            userData.tier,
            false,
            'past_due',
            userData.stripeCustomerId,
            userData.stripeSubscriptionId
          );

          await firebaseService.setUserClaims(uid);

          logger.warn('User payment failed', { uid });
        }
        break;
      }

      default:
        logger.debug('Unhandled webhook event type', { type: event.type });
    }

    res.json({ received: true });
  } catch (error) {
    logger.error('Failed to process Stripe webhook', { error });
    
    // Don't throw - Stripe will retry
    res.status(400).json({ error: 'Webhook processing failed' });
  }
});

/**
 * POST /api/webhooks/payment-success
 * Manual webhook for other payment providers
 */
router.post('/payment-success', async (req: Request, res: Response) => {
  try {
    // Verify request signature/token
    const authHeader = req.headers['x-webhook-secret'];
    if (authHeader !== config.SERVICE_API_KEY) {
      throw new AppError('Invalid webhook secret', 403);
    }

    const { uid, tier, customerId, subscriptionId } = req.body;

    if (!uid || !tier) {
      throw new AppError('Missing required fields', 400);
    }

    await firebaseService.updateUserTier(
      uid,
      tier as UserTier,
      true,
      'active',
      customerId,
      subscriptionId
    );

    await firebaseService.setUserClaims(uid);

    logger.info('Manual payment success webhook processed', { uid, tier });

    res.json({ success: true });
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    logger.error('Failed to process payment webhook', { error });
    throw new AppError('Failed to process payment webhook', 500);
  }
});

export default router;

