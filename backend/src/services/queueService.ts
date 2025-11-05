import { Queue, Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import config from '../config/index.js';
import logger from '../utils/logger.js';
import { Task, TaskResult } from '../types/index.js';
import humanlayerClient from './humanlayerClient.js';
import auditService from './auditService.js';

// Create Redis connection for BullMQ
const connection = new Redis({
  host: config.REDIS_HOST,
  port: config.REDIS_PORT,
  password: config.REDIS_PASSWORD,
  maxRetriesPerRequest: null, // Required for BullMQ
  enableReadyCheck: false,
  retryStrategy: (times) => {
    if (times > 3) {
      logger.error('Redis connection failed after 3 retries, giving up');
      return null; // Stop retrying
    }
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
});

connection.on('error', (err) => {
  logger.error('Redis queue connection error', { error: err });
});

connection.on('connect', () => {
  logger.info('Redis queue connection established');
});

connection.on('ready', () => {
  logger.info('Redis queue ready');
});

// Task queue for agent operations
export const agentTaskQueue = new Queue<Task>('agent-tasks', {
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
export const agentTaskWorker = new Worker<Task>(
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

// Event listeners for the worker
agentTaskWorker.on('completed', (job) => {
  logger.info('Job completed', { jobId: job.id });
});

agentTaskWorker.on('failed', (job, err) => {
  logger.error('Job failed', { jobId: job?.id, error: err });
});

agentTaskWorker.on('error', (err) => {
  logger.error('Worker error', { error: err });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, closing worker...');
  await agentTaskWorker.close();
  await connection.quit();
});

export class QueueService {
  /**
   * Add a task to the queue
   */
  async enqueueTask(task: Task): Promise<string> {
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

