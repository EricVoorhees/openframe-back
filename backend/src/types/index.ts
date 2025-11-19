import { z } from 'zod';

// ============================================================================
// Request/Response Types
// ============================================================================

export const FileSchema = z.object({
  path: z.string(),
  content: z.string(),
});

export const CursorSchema = z.object({
  file: z.string(),
  line: z.number(),
  col: z.number(),
});

export const CreateTaskRequestSchema = z.object({
  userId: z.string().optional(),
  projectId: z.string(),
  files: z.array(FileSchema),
  cursor: CursorSchema,
  prompt: z.string(),
  mode: z.enum(['patch', 'explain', 'generate_test', 'lint_fix']).default('patch'),
});

export type CreateTaskRequest = z.infer<typeof CreateTaskRequestSchema>;

export const CreateTaskResponseSchema = z.object({
  taskId: z.string(),
  status: z.enum(['queued', 'processing', 'done', 'failed']),
});

export type CreateTaskResponse = z.infer<typeof CreateTaskResponseSchema>;

export const PatchFileSchema = z.object({
  path: z.string(),
  patch: z.string(),
});

export const TaskResultSchema = z.object({
  type: z.enum(['patch', 'explanation', 'test', 'lint_fix']),
  filesModified: z.array(PatchFileSchema).optional(),
  explanation: z.string().optional(),
  error: z.string().optional(),
});

export const TaskMetricsSchema = z.object({
  tokens: z.number(),
  llmProvider: z.string(),
  durationMs: z.number(),
});

export const GetTaskResponseSchema = z.object({
  taskId: z.string(),
  status: z.enum(['queued', 'processing', 'done', 'failed']),
  result: TaskResultSchema.optional(),
  metrics: TaskMetricsSchema.optional(),
  error: z.string().optional(),
});

export type GetTaskResponse = z.infer<typeof GetTaskResponseSchema>;

// ============================================================================
// Internal Types
// ============================================================================

export interface Task {
  id: string;
  userId: string;
  projectId: string;
  files: Array<{ path: string; content: string }>;
  cursor: { file: string; line: number; col: number };
  prompt: string;
  mode: 'patch' | 'explain' | 'generate_test' | 'lint_fix';
  status: 'queued' | 'processing' | 'done' | 'failed';
  result?: TaskResult;
  metrics?: TaskMetrics;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TaskResult {
  type: 'patch' | 'explanation' | 'test' | 'lint_fix';
  filesModified?: Array<{ path: string; patch: string }>;
  explanation?: string;
  error?: string;
}

export interface TaskMetrics {
  tokens: number;
  llmProvider: string;
  durationMs: number;
}

// ============================================================================
// HumanLayer Types
// ============================================================================

export interface HumanLayerExecuteRequest {
  projectId: string;
  files: Array<{ path: string; content: string }>;
  cursor: { file: string; line: number; col: number };
  prompt: string;
  mode: string;
  userId: string;
  llmProvider: string;
  llmApiKey: string;
}

export interface HumanLayerExecuteResponse {
  success: boolean;
  result?: {
    type: string;
    filesModified?: Array<{ path: string; patch: string }>;
    explanation?: string;
  };
  metrics?: {
    tokens: number;
    durationMs: number;
  };
  error?: string;
}

// ============================================================================
// Backblaze Types
// ============================================================================

export interface B2AuthResponse {
  authorizationToken: string;
  apiUrl: string;
  downloadUrl: string;
}

export interface B2UploadUrlResponse {
  bucketId: string;
  uploadUrl: string;
  authorizationToken: string;
}

export interface B2FileInfo {
  fileId: string;
  fileName: string;
  contentLength: number;
  contentType: string;
  uploadTimestamp: number;
}

// ============================================================================
// Audit Types
// ============================================================================

export interface AuditLog {
  id: string;
  userId: string;
  projectId: string;
  taskId: string;
  action: 'task_created' | 'task_completed' | 'task_failed' | 'patch_accepted' | 'patch_rejected';
  prompt?: string;
  llmProvider?: string;
  tokensUsed?: number;
  durationMs?: number;
  accepted?: boolean;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// User Quota Types
// ============================================================================

export interface UserQuota {
  userId: string;
  tokensUsed: number;
  tasksCompleted: number;
  monthlyLimit: number;
  resetDate: Date;
}

// ============================================================================
// Log Analysis Types
// ============================================================================

export const UniqueErrorSchema = z.object({
  error_type: z.string(),
  message: z.string(),
  count: z.number(),
  frequency_pattern: z.string(),
});

export const CriticalLogSchema = z.object({
  timestamp: z.string(),
  level: z.string(),
  message: z.string(),
  frame_name: z.string(),
});

export const NetworkSummarySchema = z.object({
  total_requests: z.number(),
  success_rate: z.number(),
  failed_requests: z.number(),
});

export const PerformanceAlertSchema = z.object({
  severity: z.string(),
  message: z.string(),
  duration_ms: z.number(),
});

export const LogSummarySchema = z.object({
  summary_id: z.string(),
  session_id: z.string(),
  total_logs: z.number(),
  error_count: z.number(),
  warn_count: z.number(),
  unique_errors: z.array(UniqueErrorSchema),
  critical_logs: z.array(CriticalLogSchema),
  network_summary: NetworkSummarySchema,
  performance_alerts: z.array(PerformanceAlertSchema),
});

export const LogAnalysisResponseSchema = z.object({
  narrative: z.string(),
  key_insights: z.array(z.string()),
  recommendations: z.array(z.string()),
});

export type LogSummary = z.infer<typeof LogSummarySchema>;
export type LogAnalysisResponse = z.infer<typeof LogAnalysisResponseSchema>;

