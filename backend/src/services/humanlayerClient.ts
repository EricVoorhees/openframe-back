import axios, { AxiosInstance } from 'axios';
import config from '../config/index.js';
import logger from '../utils/logger.js';
import { AppError } from '../middleware/errorHandler.js';
import { HumanLayerExecuteRequest, HumanLayerExecuteResponse } from '../types/index.js';

class HumanLayerClient {
  private client: AxiosInstance;
  private daemonUrl: string;

  constructor() {
    this.daemonUrl = config.HUMANLAYER_DAEMON_URL;
    
    this.client = axios.create({
      baseURL: `${this.daemonUrl}/api/v1`,
      timeout: 120000, // 2 minutes for long-running operations
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.HUMANLAYER_SERVICE_KEY}`,
      },
    });

    // Add request interceptor for logging
    this.client.interceptors.request.use(
      (config) => {
        logger.debug('HumanLayer request', {
          method: config.method,
          url: config.url,
        });
        return config;
      },
      (error) => {
        logger.error('HumanLayer request error', { error });
        return Promise.reject(error);
      }
    );

    // Add response interceptor for logging
    this.client.interceptors.response.use(
      (response) => {
        logger.debug('HumanLayer response', {
          status: response.status,
          url: response.config.url,
        });
        return response;
      },
      (error) => {
        logger.error('HumanLayer response error', {
          status: error.response?.status,
          message: error.message,
          url: error.config?.url,
        });
        return Promise.reject(error);
      }
    );

    logger.info('HumanLayer client initialized', { daemonUrl: this.daemonUrl });
  }

  /**
   * Check if the HumanLayer daemon is healthy
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.get('/health');
      return response.status === 200;
    } catch (error) {
      logger.error('HumanLayer health check failed', { error });
      return false;
    }
  }

  /**
   * Execute an agent task through HumanLayer
   * This is a simplified version - you'll need to adapt based on actual HumanLayer API
   */
  async executeAgentTask(
    request: HumanLayerExecuteRequest
  ): Promise<HumanLayerExecuteResponse> {
    try {
      const startTime = Date.now();

      // Build the prompt for the agent
      const systemPrompt = this.buildSystemPrompt(request.mode);
      const userPrompt = this.buildUserPrompt(request);

      // For now, we'll create a mock response structure
      // In production, you'd integrate with the actual HumanLayer daemon API
      // which might involve creating sessions, sending commands, etc.
      
      logger.info('Executing agent task', {
        projectId: request.projectId,
        mode: request.mode,
        fileCount: request.files.length,
      });

      // TODO: Integrate with actual HumanLayer daemon API
      // This is a placeholder that shows the expected structure
      const response = await this.mockAgentExecution(request, systemPrompt, userPrompt);

      const durationMs = Date.now() - startTime;

      logger.info('Agent task completed', {
        projectId: request.projectId,
        success: response.success,
        durationMs,
      });

      return {
        ...response,
        metrics: {
          ...response.metrics,
          durationMs,
        },
      };
    } catch (error) {
      logger.error('Failed to execute agent task', { error });
      throw new AppError('Failed to execute agent task', 500);
    }
  }

  /**
   * Build system prompt based on task mode
   */
  private buildSystemPrompt(mode: string): string {
    const prompts: Record<string, string> = {
      patch: `You are a coding assistant. Given the files and a user request, output only a unified diff in standard format. 
If the change is unsafe or unclear, output a descriptive explanation instead of a patch.
Always ensure the patch is valid and can be applied cleanly.`,
      
      explain: `You are a code explanation assistant. Analyze the provided code and explain what it does, 
how it works, and any potential issues or improvements. Be clear and concise.`,
      
      generate_test: `You are a test generation assistant. Generate comprehensive unit tests for the provided code.
Use appropriate testing frameworks and follow best practices. Include edge cases and error scenarios.`,
      
      lint_fix: `You are a code quality assistant. Analyze the code for linting issues, style problems, 
and potential bugs. Provide a patch that fixes these issues while maintaining functionality.`,
    };

    return prompts[mode] || prompts.patch;
  }

  /**
   * Build user prompt with context
   */
  private buildUserPrompt(request: HumanLayerExecuteRequest): string {
    let prompt = `Project: ${request.projectId}\n\n`;
    
    prompt += `Files:\n`;
    request.files.forEach((file) => {
      prompt += `\n--- ${file.path} ---\n`;
      prompt += file.content;
      prompt += `\n`;
    });

    prompt += `\nCursor position: ${request.cursor.file}:${request.cursor.line}:${request.cursor.col}\n\n`;
    prompt += `Task: ${request.prompt}\n`;

    return prompt;
  }

  /**
   * Mock agent execution for development
   * Replace this with actual HumanLayer integration
   */
  private async mockAgentExecution(
    request: HumanLayerExecuteRequest,
    systemPrompt: string,
    userPrompt: string
  ): Promise<HumanLayerExecuteResponse> {
    // This is a mock implementation
    // In production, you would:
    // 1. Create a session with HumanLayer daemon
    // 2. Send the files and prompt
    // 3. Wait for the agent to process
    // 4. Retrieve the results (patches, explanations, etc.)
    
    logger.warn('Using mock agent execution - replace with actual HumanLayer integration');

    return {
      success: true,
      result: {
        type: request.mode,
        explanation: 'This is a mock response. Integrate with actual HumanLayer daemon API.',
        filesModified: request.mode === 'patch' ? [
          {
            path: request.cursor.file,
            patch: `@@ -${request.cursor.line},3 +${request.cursor.line},4 @@\n // Mock patch\n+ // TODO: Implement actual change\n`,
          },
        ] : undefined,
      },
      metrics: {
        tokens: 500,
        durationMs: 0, // Will be set by caller
      },
    };
  }

  /**
   * Get debug information from daemon
   */
  async getDebugInfo(): Promise<any> {
    try {
      const response = await this.client.get('/debug-info');
      return response.data;
    } catch (error) {
      logger.error('Failed to get debug info', { error });
      throw new AppError('Failed to get debug info from daemon', 500);
    }
  }

  /**
   * Validate directory with daemon
   */
  async validateDirectory(path: string): Promise<{ exists: boolean; canCreate: boolean }> {
    try {
      const response = await this.client.post('/validate-directory', { path });
      return response.data;
    } catch (error) {
      logger.error('Failed to validate directory', { error });
      throw new AppError('Failed to validate directory', 500);
    }
  }
}

export default new HumanLayerClient();

