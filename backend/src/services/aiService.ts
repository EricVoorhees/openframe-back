import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import config from '../config/index.js';
import logger from '../utils/logger.js';
import { LogSummary, LogAnalysisResponse } from '../types/index.js';

class AIService {
  private anthropic?: Anthropic;
  private openai?: OpenAI;
  private provider: 'openai' | 'anthropic';
  private initialized: boolean = false;

  constructor() {
    this.provider = config.LLM_PROVIDER;

    try {
      if (this.provider === 'anthropic' && config.ANTHROPIC_API_KEY) {
        this.anthropic = new Anthropic({
          apiKey: config.ANTHROPIC_API_KEY,
        });
        this.initialized = true;
        logger.info('AI Service initialized', { provider: this.provider });
      } else if (this.provider === 'openai' && config.OPENAI_API_KEY) {
        this.openai = new OpenAI({
          apiKey: config.OPENAI_API_KEY,
        });
        this.initialized = true;
        logger.info('AI Service initialized', { provider: this.provider });
      } else {
        logger.warn('AI Service not configured - missing API key', { 
          provider: this.provider,
          hasAnthropicKey: !!config.ANTHROPIC_API_KEY,
          hasOpenAIKey: !!config.OPENAI_API_KEY,
        });
      }
    } catch (error) {
      logger.error('Failed to initialize AI Service', { error, provider: this.provider });
    }
  }

  /**
   * Analyze logs using AI
   */
  async analyzeLogs(logSummary: LogSummary): Promise<LogAnalysisResponse> {
    // Check if AI service is initialized
    if (!this.initialized) {
      logger.warn('AI Service not initialized, using fallback response', {
        provider: this.provider,
        summary_id: logSummary.summary_id,
      });
      return this.generateFallbackResponse(logSummary);
    }

    logger.info('Analyzing logs with AI', {
      provider: this.provider,
      summary_id: logSummary.summary_id,
      total_logs: logSummary.total_logs,
      errors: logSummary.error_count,
    });

    const prompt = this.buildPrompt(logSummary);

    try {
      const response = await this.callAI(prompt);
      const parsed = this.parseResponse(response);

      logger.info('Log analysis completed', {
        summary_id: logSummary.summary_id,
        narrative_length: parsed.narrative.length,
        insights_count: parsed.key_insights.length,
      });

      return parsed;
    } catch (error) {
      logger.error('AI analysis failed', { error });
      // Return fallback response
      return this.generateFallbackResponse(logSummary);
    }
  }

  /**
   * Build AI prompt from log summary
   */
  private buildPrompt(input: LogSummary): string {
    return `Analyze this development session and provide concise insights.

## Session Overview
- Total Logs: ${input.total_logs}
- Errors: ${input.error_count}, Warnings: ${input.warn_count}
- Session ID: ${input.session_id}

## Unique Errors (Top 5)
${input.unique_errors.slice(0, 5).map((e) => 
  `- **${e.error_type}** (${e.count}x): ${e.message}
    Pattern: ${e.frequency_pattern}`
).join('\n')}

## Critical Log Entries (Top 20)
${input.critical_logs.slice(0, 20).map((log) => 
  `[${log.timestamp}] ${log.level.toUpperCase()} in ${log.frame_name}:
   ${log.message}`
).join('\n')}

## Network Activity
- Total Requests: ${input.network_summary.total_requests}
- Success Rate: ${input.network_summary.success_rate.toFixed(1)}%
- Failed Requests: ${input.network_summary.failed_requests}

${input.performance_alerts.length > 0 ? `
## Performance Alerts
${input.performance_alerts.slice(0, 3).map((a) => 
  `- ${a.severity.toUpperCase()}: ${a.message} (${a.duration_ms.toFixed(0)}ms)`
).join('\n')}
` : ''}

**Task:** Provide a structured analysis with:
1. **narrative** (2-3 sentences): What happened in this session?
2. **key_insights** (array of strings): Top 3 issues detected
3. **recommendations** (array of strings): Actionable fixes

Return ONLY valid JSON in this exact format:
{
  "narrative": "...",
  "key_insights": ["...", "...", "..."],
  "recommendations": ["...", "...", "..."]
}

Focus on error patterns, root causes, and actionable advice. Be concise and technical.`;
  }

  /**
   * Timeout wrapper for AI calls
   */
  private async callWithTimeout<T>(promise: Promise<T>, timeoutMs: number = 30000): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) => 
        setTimeout(() => reject(new Error(`AI call timeout after ${timeoutMs}ms`)), timeoutMs)
      ),
    ]);
  }

  /**
   * Call AI provider
   */
  private async callAI(prompt: string): Promise<string> {
    logger.info('Calling AI provider', { provider: this.provider });
    if (this.provider === 'anthropic' && this.anthropic) {
      logger.debug('Sending request to Anthropic');
      const message = await this.callWithTimeout(
        this.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1024,
        temperature: 0.3,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      })
      );
      logger.debug('Received response from Anthropic');

      const content = message.content[0];
      if (content.type === 'text') {
        return content.text;
      }
      throw new Error('Unexpected response format from Anthropic');
    } else if (this.provider === 'openai' && this.openai) {
      logger.debug('Sending request to OpenAI');
      const completion = await this.callWithTimeout(
        this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are a code analysis assistant. Return only valid JSON.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3,
        max_tokens: 1024,
        response_format: { type: 'json_object' },
      })
      );
      logger.debug('Received response from OpenAI');

      return completion.choices[0]?.message?.content || '';
    }

    throw new Error('No AI provider configured');
  }

  /**
   * Parse AI response into structured format
   */
  private parseResponse(response: string): LogAnalysisResponse {
    try {
      // Try to parse as JSON first
      const parsed = JSON.parse(response);
      
      return {
        narrative: parsed.narrative || '',
        key_insights: Array.isArray(parsed.key_insights) ? parsed.key_insights : [],
        recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
      };
    } catch (error) {
      // Fallback: extract from text
      logger.warn('Failed to parse JSON response, using text extraction', { error });
      
      return {
        narrative: this.extractNarrative(response),
        key_insights: this.extractList(response, 'key_insights'),
        recommendations: this.extractList(response, 'recommendations'),
      };
    }
  }

  private extractNarrative(text: string): string {
    const match = text.match(/"narrative"\s*:\s*"([^"]+)"/);
    return match ? match[1] : text.substring(0, 200);
  }

  private extractList(text: string, key: string): string[] {
    const match = text.match(new RegExp(`"${key}"\\s*:\\s*\\[([^\\]]+)\\]`));
    if (match) {
      return match[1]
        .split(',')
        .map(item => item.trim().replace(/^"|"$/g, ''))
        .filter(Boolean);
    }
    return [];
  }

  /**
   * Generate fallback response when AI fails
   */
  private generateFallbackResponse(input: LogSummary): LogAnalysisResponse {
    const hasErrors = input.error_count > 0;
    const hasPerformanceIssues = input.performance_alerts.length > 0;
    const hasNetworkIssues = input.network_summary.success_rate < 95;

    let narrative = '';
    const insights: string[] = [];
    const recommendations: string[] = [];

    if (hasErrors) {
      const topError = input.unique_errors[0];
      narrative = `Development session with ${input.error_count} errors detected. Primary issue: ${topError?.error_type} occurring ${topError?.count} times. `;
      if (topError) {
        insights.push(`Recurring ${topError.error_type}: "${topError.message}" (${topError.count} occurrences)`);
        recommendations.push(`Investigate ${topError.error_type} in error logs, pattern: ${topError.frequency_pattern}`);
      }
    } else {
      narrative = `Clean development session with ${input.total_logs} logs processed. No errors detected. `;
    }

    if (hasPerformanceIssues) {
      const worstAlert = input.performance_alerts[0];
      narrative += `Performance concerns: ${worstAlert?.message}.`;
      if (worstAlert) {
        insights.push(`Performance bottleneck: ${worstAlert.message} (${worstAlert.duration_ms.toFixed(0)}ms)`);
        recommendations.push(`Optimize slow operations: ${worstAlert.message}`);
      }
    }

    if (hasNetworkIssues) {
      narrative += ` Network stability issues: ${input.network_summary.failed_requests} failed requests.`;
      insights.push(`Network failures: ${input.network_summary.failed_requests}/${input.network_summary.total_requests} requests failed`);
      recommendations.push('Review API endpoints and add retry logic');
    }

    if (!hasErrors && !hasPerformanceIssues && !hasNetworkIssues) {
      narrative = `Healthy development session with ${input.total_logs} logs. No critical issues detected.`;
      insights.push('Session completed successfully');
    }

    return {
      narrative: narrative.trim(),
      key_insights: insights,
      recommendations: recommendations,
    };
  }
}

export default new AIService();
