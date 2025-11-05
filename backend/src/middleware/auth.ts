import { Request, Response, NextFunction } from 'express';
import admin from 'firebase-admin';
import config from '../config/index.js';
import logger from '../utils/logger.js';

// Initialize Firebase Admin
let firebaseApp: admin.app.App;

try {
  firebaseApp = admin.initializeApp({
    credential: admin.credential.cert({
      projectId: config.FIREBASE_PROJECT_ID,
      privateKey: config.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      clientEmail: config.FIREBASE_CLIENT_EMAIL,
    }),
  });
  logger.info('Firebase Admin initialized successfully');
} catch (error) {
  logger.error('Failed to initialize Firebase Admin', { error });
  throw error;
}

export interface AuthenticatedRequest extends Request {
  user?: {
    uid: string;
    email?: string;
    emailVerified?: boolean;
  };
}

/**
 * Middleware to verify Firebase ID tokens
 */
export const verifyFirebaseToken = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Missing or invalid authorization header',
      });
      return;
    }

    const idToken = authHeader.split('Bearer ')[1];

    if (!idToken) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'No token provided',
      });
      return;
    }

    // Verify the ID token
    const decodedToken = await admin.auth().verifyIdToken(idToken);

    // Attach user info to request
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      emailVerified: decodedToken.email_verified,
    };

    logger.debug('User authenticated', { userId: req.user.uid });
    next();
  } catch (error) {
    logger.error('Token verification failed', { error });
    
    if (error instanceof Error) {
      if (error.message.includes('expired')) {
        res.status(401).json({
          error: 'Unauthorized',
          message: 'Token has expired',
        });
        return;
      }
    }

    res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid token',
    });
  }
};

/**
 * Middleware to verify service-to-service API keys
 */
export const verifyServiceKey = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    const apiKey = req.headers['x-api-key'];

    if (!apiKey || apiKey !== config.SERVICE_API_KEY) {
      res.status(403).json({
        error: 'Forbidden',
        message: 'Invalid service API key',
      });
      return;
    }

    next();
  } catch (error) {
    logger.error('Service key verification failed', { error });
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to verify service key',
    });
  }
};

export default { verifyFirebaseToken, verifyServiceKey };

