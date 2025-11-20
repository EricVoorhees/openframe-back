import { Queue, Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import config from '../config/index.js';
import logger from '../utils/logger.js';
import { Task, TaskResult } from '../types/index.js';
import humanlayerClient from './humanlayerClient.js';
import auditService from './auditService.js';

// Create Redis connection for BullMQ with graceful error handling
let connection: Redis;
let isRedisConnected = false;

try {
  connection = new Redis({
    host: config.REDIS_HOST,
    port: config.REDIS_PORT,
    password: config.REDIS_PASSWORD,
    maxRetriesPerRequest: null, // Required for BullMQ
    enableReadyCheck: false,
    lazyConnect: true, // Don't connect immediately
    retryStrategy: (times) => {
      if (times > 3) {
        logger.warn('Redis connection failed after 3 retries, queue features will be unavailable');
        return null; // Stop retrying
      }
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
  });

  connection.on('error', (err) => {
    logger.error('Redis queue connection error', { 
      error: err.message || 'Unknown error',
      errorType: err.constructor.name,
      host: config.REDIS_HOST,
      port: config.REDIS_PORT
    });
    isRedisConnected = false;
  });

  connection.on('connect', () => {
    logger.info('Redis queue connection established');
    isRedisConnected = true;
  });

  connection.on('ready', () => {
    logger.info('Redis queue ready');
    isRedisConnected = true;
  });

  connection.on('close', () => {
    logger.warn('Redis connection closed');
    isRedisConnected = false;
  });

  connection.on('reconnecting', () => {
    logger.info('Redis reconnecting...');
  });

  connection.on('end', () => {
    logger.warn('Redis connection ended');
    isRedisConnected = false;
  });

  // DON'T attempt to connect yet - completely lazy
  // connection.connect().catch((err) => {
  //   logger.error('Failed to connect to Redis on startup', { 
  //     error: err.message || 'Unknown error',
  //     host: config.REDIS_HOST,
  //     port: config.REDIS_PORT
  //   });
  // });

} catch (error) {
  logger.error('Failed to initialize Redis connection', { error });
  // Create a dummy connection that won't be used
  connection = new Redis({ lazyConnect: true, maxRetriesPerRequest: null });
}

// Task queue for agent operations
let agentTaskQueue: Queue<Task> | null = null;
let agentTaskWorker: Worker<Task> | null = null;

try {
  agentTaskQueue = new Queue<Task>('agent-tasks', {
    connection,
    defaultJobOptions: {
      attempts: config.QUEUE_MAX_RETRIES,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
      removeOnComplete: {
        age: 3600 * 24, // Keep completed jobs for 24 hours
        count: 1000,
      },
      removeOnFail: {
        age: 3600 * 24 * 7, // Keep failed jobs for 7 days
      },
    },
  });

  // Worker to process agent tasks
  agentTaskWorker = new Worker<Task>(
    'agent-tasks',
    async (job: Job<Task>) => {
    const task = job.data;
    
    logger.info('Processing agent task', {
      taskId: task.id,
      userId: task.userId,
      projectId: task.projectId,
      mode: task.mode,
    });

    // Import firebaseService dynamically to avoid circular dependencies
    const { default: firebaseService } = await import('./firebaseService.js');

    try {
      // Increment concurrent agent count
      await firebaseService.incrementConcurrentAgents(task.userId);

      // Update task status to processing
      task.status = 'processing';
      await job.updateProgress(25);

      // Get LLM API key based on provider
      const llmApiKey = config.LLM_PROVIDER === 'openai' 
        ? config.OPENAI_API_KEY || ''
        : config.ANTHROPIC_API_KEY || '';

      if (!llmApiKey) {
        throw new Error(`No API key configured for provider: ${config.LLM_PROVIDER}`);
      }

      // Execute the agent task through HumanLayer
      const result = await humanlayerClient.executeAgentTask({
        projectId: task.projectId,
        files: task.files,
        cursor: task.cursor,
        prompt: task.prompt,
        mode: task.mode,
        userId: task.userId,
        llmProvider: config.LLM_PROVIDER,
        llmApiKey,
      });

      await job.updateProgress(75);

      // Update task with results
      task.status = 'done';
      task.result = result.result as TaskResult;
      task.metrics = {
        tokens: result.metrics?.tokens || 0,
        llmProvider: config.LLM_PROVIDER,
        durationMs: result.metrics?.durationMs || 0,
      };

      await job.updateProgress(90);

      // Track token usage in Firebase
      await firebaseService.trackTokenUsage(task.userId, task.metrics.tokens);

      // Log audit event
      await auditService.logTaskCompleted(task);

      await job.updateProgress(100);

      logger.info('Agent task completed successfully', {
        taskId: task.id,
        tokens: task.metrics.tokens,
        durationMs: task.metrics.durationMs,
      });

      return task;
    } catch (error) {
      logger.error('Agent task failed', {
        taskId: task.id,
        error,
      });

      // Update task status to failed
      task.status = 'failed';
      task.error = error instanceof Error ? error.message : 'Unknown error';

      // Log audit event
      await auditService.logTaskFailed(task);

      throw error;
    } finally {
      // Always decrement concurrent agent count
      await firebaseService.decrementConcurrentAgents(task.userId);
    }
  },
  {
    connection,
    concurrency: config.QUEUE_CONCURRENCY,
    limiter: {
      max: 10,
      duration: 1000, // 10 jobs per second max
    },
  }
  );

  // Event listeners for the worker - wrap in try-catch to prevent unhandled rejections
  agentTaskWorker.on('completed', (job) => {
    try {
      logger.info('Job completed', { jobId: job.id });
    } catch (err) {
      logger.error('Error in completed handler', { error: err });
    }
  });

  agentTaskWorker.on('failed', (job, err) => {
    try {
      logger.error('Job failed', { jobId: job?.id, error: err });
    } catch (handlerErr) {
      logger.error('Error in failed handler', { error: handlerErr });
    }
  });

  agentTaskWorker.on('error', (err) => {
    try {
      logger.error('Worker error', { 
        error: err instanceof Error ? err.message : 'Unknown error',
        errorType: err?.constructor?.name,
      });
    } catch (handlerErr) {
      logger.error('Error in error handler', { error: handlerErr });
    }
  });

  // Additional worker event handlers to catch all possible errors
  agentTaskWorker.on('active', (job) => {
    try {
      logger.debug('Job active', { jobId: job.id });
    } catch (err) {
      logger.error('Error in active handler', { error: err });
    }
  });

  agentTaskWorker.on('stalled', (jobId) => {
    try {
      logger.warn('Job stalled', { jobId });
    } catch (err) {
      logger.error('Error in stalled handler', { error: err });
    }
  });

  logger.info('BullMQ queue and worker initialized successfully');
} catch (error) {
  logger.warn('BullMQ queue/worker initialization failed - queue features will be unavailable', { 
    error: error instanceof Error ? error.message : 'Unknown error' 
  });
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, closing worker...');
  if (agentTaskWorker) {
    await agentTaskWorker.close();
  }
  await connection.quit();
});

export class QueueService {
  /**
   * Add a task to the queue
   */
  async enqueueTask(task: Task): Promise<string> {
    if (!agentTaskQueue) {
      throw new Error('Queue service not available - Redis connection failed');
    }
    
    try {
      const job = await agentTaskQueue.add(`task-${task.id}`, task, {
        jobId: task.id,
      });

      logger.info('Task enqueued', { taskId: task.id, jobId: job.id });
      return job.id || task.id;
    } catch (error) {
      logger.error('Failed to enqueue task', { taskId: task.id, error });
      throw error;
    }
  }

  /**
   * Get task status from queue
   */
  async getTaskStatus(taskId: string): Promise<Task | null> {
    if (!agentTaskQueue) {
      logger.warn('Queue not available, cannot get task status', { taskId });
      return null;
    }
    
    try {
      const job = await agentTaskQueue.getJob(taskId);
      
      if (!job) {
        return null;
      }

      const state = await job.getState();
      const task = job.data;

      // Update status based on job state
      if (state === 'completed') {
        task.status = 'done';
      } else if (state === 'failed') {
        task.status = 'failed';
      } else if (state === 'active') {
        task.status = 'processing';
      } else {
        task.status = 'queued';
      }

      return task;
    } catch (error) {
      logger.error('Failed to get task status', { taskId, error });
      return null;
    }
  }

  /**
   * Cancel a task
   */
  async cancelTask(taskId: string): Promise<boolean> {
    if (!agentTaskQueue) {
      logger.warn('Queue not available, cannot cancel task', { taskId });
      return false;
    }
    
    try {
      const job = await agentTaskQueue.getJob(taskId);
      
      if (!job) {
        return false;
      }

      await job.remove();
      logger.info('Task cancelled', { taskId });
      return true;
    } catch (error) {
      logger.error('Failed to cancel task', { taskId, error });
      return false;
    }
  }

  /**
   * Get queue metrics
   */
  async getQueueMetrics() {
    if (!agentTaskQueue) {
      return {
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
        available: false,
      };
    }
    
    try {
      const [waiting, active, completed, failed] = await Promise.all([
        agentTaskQueue.getWaitingCount(),
        agentTaskQueue.getActiveCount(),
        agentTaskQueue.getCompletedCount(),
        agentTaskQueue.getFailedCount(),
      ]);

      return {
        waiting,
        active,
        completed,
        failed,
        total: waiting + active + completed + failed,
      };
    } catch (error) {
      logger.error('Failed to get queue metrics', { error });
      return null;
    }
  }
}

export default new QueueService();
export { agentTaskQueue, agentTaskWorker };

