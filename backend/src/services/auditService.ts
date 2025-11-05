import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger.js';
import { AuditLog, Task, UserQuota } from '../types/index.js';

// In-memory storage for development
// In production, use a proper database (PostgreSQL, MongoDB, etc.)
const auditLogs: Map<string, AuditLog> = new Map();
const userQuotas: Map<string, UserQuota> = new Map();

class AuditService {
  /**
   * Log task creation
   */
  async logTaskCreated(task: Task): Promise<void> {
    const log: AuditLog = {
      id: uuidv4(),
      userId: task.userId,
      projectId: task.projectId,
      taskId: task.id,
      action: 'task_created',
      prompt: task.prompt,
      timestamp: new Date(),
      metadata: {
        mode: task.mode,
        fileCount: task.files.length,
      },
    };

    auditLogs.set(log.id, log);
    logger.info('Task created audit log', { logId: log.id, taskId: task.id });
  }

  /**
   * Log task completion
   */
  async logTaskCompleted(task: Task): Promise<void> {
    const log: AuditLog = {
      id: uuidv4(),
      userId: task.userId,
      projectId: task.projectId,
      taskId: task.id,
      action: 'task_completed',
      llmProvider: task.metrics?.llmProvider,
      tokensUsed: task.metrics?.tokens,
      durationMs: task.metrics?.durationMs,
      timestamp: new Date(),
      metadata: {
        mode: task.mode,
        resultType: task.result?.type,
      },
    };

    auditLogs.set(log.id, log);
    
    // Update user quota
    await this.updateUserQuota(task.userId, task.metrics?.tokens || 0);
    
    logger.info('Task completed audit log', { 
      logId: log.id, 
      taskId: task.id,
      tokens: log.tokensUsed,
    });
  }

  /**
   * Log task failure
   */
  async logTaskFailed(task: Task): Promise<void> {
    const log: AuditLog = {
      id: uuidv4(),
      userId: task.userId,
      projectId: task.projectId,
      taskId: task.id,
      action: 'task_failed',
      timestamp: new Date(),
      metadata: {
        mode: task.mode,
        error: task.error,
      },
    };

    auditLogs.set(log.id, log);
    logger.warn('Task failed audit log', { logId: log.id, taskId: task.id });
  }

  /**
   * Log patch acceptance/rejection
   */
  async logPatchDecision(
    userId: string,
    projectId: string,
    taskId: string,
    accepted: boolean
  ): Promise<void> {
    const log: AuditLog = {
      id: uuidv4(),
      userId,
      projectId,
      taskId,
      action: accepted ? 'patch_accepted' : 'patch_rejected',
      accepted,
      timestamp: new Date(),
    };

    auditLogs.set(log.id, log);
    logger.info('Patch decision audit log', { 
      logId: log.id, 
      taskId, 
      accepted,
    });
  }

  /**
   * Get audit logs for a user
   */
  async getUserAuditLogs(
    userId: string,
    limit: number = 100
  ): Promise<AuditLog[]> {
    const logs = Array.from(auditLogs.values())
      .filter((log) => log.userId === userId)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);

    return logs;
  }

  /**
   * Get audit logs for a project
   */
  async getProjectAuditLogs(
    projectId: string,
    limit: number = 100
  ): Promise<AuditLog[]> {
    const logs = Array.from(auditLogs.values())
      .filter((log) => log.projectId === projectId)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);

    return logs;
  }

  /**
   * Update user quota
   */
  async updateUserQuota(userId: string, tokensUsed: number): Promise<void> {
    let quota = userQuotas.get(userId);

    if (!quota) {
      // Create new quota with default monthly limit
      quota = {
        userId,
        tokensUsed: 0,
        tasksCompleted: 0,
        monthlyLimit: 1000000, // 1M tokens per month
        resetDate: this.getNextMonthDate(),
      };
    }

    // Check if quota needs to be reset
    if (new Date() >= quota.resetDate) {
      quota.tokensUsed = 0;
      quota.tasksCompleted = 0;
      quota.resetDate = this.getNextMonthDate();
    }

    // Update quota
    quota.tokensUsed += tokensUsed;
    quota.tasksCompleted += 1;

    userQuotas.set(userId, quota);
    
    logger.debug('User quota updated', {
      userId,
      tokensUsed: quota.tokensUsed,
      tasksCompleted: quota.tasksCompleted,
      remaining: quota.monthlyLimit - quota.tokensUsed,
    });
  }

  /**
   * Get user quota
   */
  async getUserQuota(userId: string): Promise<UserQuota | null> {
    const quota = userQuotas.get(userId);

    if (!quota) {
      return null;
    }

    // Check if quota needs to be reset
    if (new Date() >= quota.resetDate) {
      quota.tokensUsed = 0;
      quota.tasksCompleted = 0;
      quota.resetDate = this.getNextMonthDate();
      userQuotas.set(userId, quota);
    }

    return quota;
  }

  /**
   * Check if user has exceeded quota
   */
  async checkUserQuota(userId: string): Promise<boolean> {
    const quota = await this.getUserQuota(userId);

    if (!quota) {
      return true; // No quota means unlimited (or create default)
    }

    return quota.tokensUsed < quota.monthlyLimit;
  }

  /**
   * Get usage statistics for a user
   */
  async getUserStats(userId: string): Promise<{
    totalTasks: number;
    totalTokens: number;
    averageTokensPerTask: number;
    tasksByMode: Record<string, number>;
  }> {
    const logs = await this.getUserAuditLogs(userId, 1000);
    
    const completedLogs = logs.filter((log) => log.action === 'task_completed');
    const totalTokens = completedLogs.reduce((sum, log) => sum + (log.tokensUsed || 0), 0);
    const totalTasks = completedLogs.length;

    const tasksByMode: Record<string, number> = {};
    completedLogs.forEach((log) => {
      const mode = log.metadata?.mode as string;
      if (mode) {
        tasksByMode[mode] = (tasksByMode[mode] || 0) + 1;
      }
    });

    return {
      totalTasks,
      totalTokens,
      averageTokensPerTask: totalTasks > 0 ? Math.round(totalTokens / totalTasks) : 0,
      tasksByMode,
    };
  }

  /**
   * Get next month date for quota reset
   */
  private getNextMonthDate(): Date {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 1);
  }

  /**
   * Clear old audit logs (cleanup job)
   */
  async cleanupOldLogs(daysToKeep: number = 90): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    let deletedCount = 0;
    for (const [id, log] of auditLogs.entries()) {
      if (log.timestamp < cutoffDate) {
        auditLogs.delete(id);
        deletedCount++;
      }
    }

    logger.info('Old audit logs cleaned up', { deletedCount, daysToKeep });
    return deletedCount;
  }
}

export default new AuditService();

