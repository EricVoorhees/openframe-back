# Frontend Integration Guide

This guide shows how to integrate your React + Monaco frontend with the Open Frame Backend API.

## Table of Contents

1. [Setup](#setup)
2. [Authentication](#authentication)
3. [API Client](#api-client)
4. [Creating Agent Tasks](#creating-agent-tasks)
5. [Polling for Results](#polling-for-results)
6. [Applying Patches](#applying-patches)
7. [Project Persistence](#project-persistence)
8. [Error Handling](#error-handling)

---

## Setup

### Install Dependencies

```bash
npm install axios diff-match-patch
```

### Environment Variables

Create `.env` in your frontend:

```env
VITE_API_URL=http://localhost:3001
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-auth-domain
VITE_FIREBASE_PROJECT_ID=your-project-id
```

---

## Authentication

### Firebase Setup

```typescript
// src/config/firebase.ts
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
```

### Get ID Token

```typescript
// src/utils/auth.ts
import { auth } from '../config/firebase';

export async function getIdToken(): Promise<string> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('User not authenticated');
  }
  return await user.getIdToken();
}
```

---

## API Client

### Create API Client

```typescript
// src/services/api.ts
import axios, { AxiosInstance } from 'axios';
import { getIdToken } from '../utils/auth';

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: import.meta.env.VITE_API_URL,
      timeout: 120000,
    });

    // Add auth interceptor
    this.client.interceptors.request.use(async (config) => {
      const token = await getIdToken();
      config.headers.Authorization = `Bearer ${token}`;
      return config;
    });
  }

  // Health check
  async healthCheck() {
    const response = await this.client.get('/health');
    return response.data;
  }

  // Create agent task
  async createTask(data: {
    projectId: string;
    files: Array<{ path: string; content: string }>;
    cursor: { file: string; line: number; col: number };
    prompt: string;
    mode: 'patch' | 'explain' | 'generate_test' | 'lint_fix';
  }) {
    const response = await this.client.post('/api/agent/tasks', data);
    return response.data;
  }

  // Get task status
  async getTask(taskId: string) {
    const response = await this.client.get(`/api/agent/tasks/${taskId}`);
    return response.data;
  }

  // Accept patch
  async acceptPatch(taskId: string) {
    const response = await this.client.post(`/api/agent/tasks/${taskId}/accept`);
    return response.data;
  }

  // Reject patch
  async rejectPatch(taskId: string) {
    const response = await this.client.post(`/api/agent/tasks/${taskId}/reject`);
    return response.data;
  }

  // Get user stats
  async getUserStats() {
    const response = await this.client.get('/api/agent/stats');
    return response.data;
  }

  // Save project
  async saveProject(projectId: string, files: Array<{ path: string; content: string }>) {
    const response = await this.client.post('/api/projects/save', {
      projectId,
      files,
    });
    return response.data;
  }

  // Load project
  async loadProject(projectId: string) {
    const response = await this.client.get(`/api/projects/${projectId}`);
    return response.data;
  }
}

export const apiClient = new ApiClient();
```

---

## Creating Agent Tasks

### React Hook for Agent Tasks

```typescript
// src/hooks/useAgentTask.ts
import { useState } from 'react';
import { apiClient } from '../services/api';

export function useAgentTask() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createTask = async (data: {
    projectId: string;
    files: Array<{ path: string; content: string }>;
    cursor: { file: string; line: number; col: number };
    prompt: string;
    mode: 'patch' | 'explain' | 'generate_test' | 'lint_fix';
  }) => {
    setLoading(true);
    setError(null);

    try {
      const result = await apiClient.createTask(data);
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create task';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { createTask, loading, error };
}
```

### Usage in Component

```typescript
// src/components/AIPanel.tsx
import { useState } from 'react';
import { useAgentTask } from '../hooks/useAgentTask';

export function AIPanel({ 
  projectId, 
  currentFile, 
  files, 
  cursorPosition 
}: AIPanel Props) {
  const [prompt, setPrompt] = useState('');
  const { createTask, loading } = useAgentTask();

  const handleSubmit = async () => {
    const taskResult = await createTask({
      projectId,
      files: files.map(f => ({ path: f.path, content: f.content })),
      cursor: {
        file: currentFile,
        line: cursorPosition.line,
        col: cursorPosition.column,
      },
      prompt,
      mode: 'patch',
    });

    // Start polling for results
    pollForResult(taskResult.taskId);
  };

  return (
    <div className="ai-panel">
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Describe what you want to change..."
      />
      <button onClick={handleSubmit} disabled={loading}>
        {loading ? 'Processing...' : 'Ask AI'}
      </button>
    </div>
  );
}
```

---

## Polling for Results

### Polling Hook

```typescript
// src/hooks/useTaskPolling.ts
import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../services/api';

export function useTaskPolling(taskId: string | null, interval = 2000) {
  const [task, setTask] = useState<any>(null);
  const [polling, setPolling] = useState(false);

  const pollTask = useCallback(async () => {
    if (!taskId) return;

    try {
      const result = await apiClient.getTask(taskId);
      setTask(result);

      // Stop polling if task is done or failed
      if (result.status === 'done' || result.status === 'failed') {
        setPolling(false);
      }
    } catch (error) {
      console.error('Polling error:', error);
      setPolling(false);
    }
  }, [taskId]);

  useEffect(() => {
    if (!taskId || !polling) return;

    const intervalId = setInterval(pollTask, interval);
    pollTask(); // Poll immediately

    return () => clearInterval(intervalId);
  }, [taskId, polling, interval, pollTask]);

  const startPolling = useCallback(() => {
    setPolling(true);
  }, []);

  const stopPolling = useCallback(() => {
    setPolling(false);
  }, []);

  return { task, polling, startPolling, stopPolling };
}
```

### Usage

```typescript
const { task, startPolling } = useTaskPolling(taskId);

// Start polling after creating task
const handleCreateTask = async () => {
  const result = await createTask(/* ... */);
  setTaskId(result.taskId);
  startPolling();
};

// Show result when done
useEffect(() => {
  if (task?.status === 'done') {
    showPatchPreview(task.result);
  }
}, [task]);
```

---

## Applying Patches

### Patch Preview Component

```typescript
// src/components/PatchPreview.tsx
import { useState } from 'react';
import { parsePatch, applyPatch } from 'diff-match-patch';

export function PatchPreview({ 
  task, 
  onAccept, 
  onReject 
}: PatchPreviewProps) {
  if (!task?.result?.filesModified) return null;

  return (
    <div className="patch-preview">
      <h3>AI Suggestions</h3>
      
      {task.result.explanation && (
        <div className="explanation">
          <p>{task.result.explanation}</p>
        </div>
      )}

      {task.result.filesModified.map((file, idx) => (
        <div key={idx} className="file-patch">
          <h4>{file.path}</h4>
          <pre className="patch-diff">
            {file.patch}
          </pre>
        </div>
      ))}

      <div className="actions">
        <button onClick={() => onAccept(task.taskId)}>
          Accept Changes
        </button>
        <button onClick={() => onReject(task.taskId)}>
          Reject
        </button>
      </div>

      {task.metrics && (
        <div className="metrics">
          <small>
            Tokens: {task.metrics.tokens} | 
            Time: {task.metrics.durationMs}ms
          </small>
        </div>
      )}
    </div>
  );
}
```

### Apply Patch to Monaco

```typescript
// src/utils/patchUtils.ts
import * as monaco from 'monaco-editor';

export function applyPatchToMonaco(
  editor: monaco.editor.IStandaloneCodeEditor,
  patch: string
) {
  const model = editor.getModel();
  if (!model) return;

  const currentContent = model.getValue();
  
  // Parse and apply patch
  // You'll need a proper patch parser here
  // This is simplified
  const lines = patch.split('\n');
  const edits: monaco.editor.IIdentifiedSingleEditOperation[] = [];

  // Parse patch and create Monaco edits
  // ... patch parsing logic ...

  // Apply edits
  model.pushEditOperations([], edits, () => null);
}
```

### Accept/Reject Handler

```typescript
const handleAccept = async (taskId: string) => {
  try {
    // Apply patch to Monaco editor
    task.result.filesModified.forEach(file => {
      const editor = getEditorForFile(file.path);
      if (editor) {
        applyPatchToMonaco(editor, file.patch);
      }
    });

    // Notify backend
    await apiClient.acceptPatch(taskId);

    // Optionally save to Backblaze
    await saveProject();

    // Close preview
    closePatchPreview();
  } catch (error) {
    console.error('Failed to accept patch:', error);
  }
};

const handleReject = async (taskId: string) => {
  try {
    await apiClient.rejectPatch(taskId);
    closePatchPreview();
  } catch (error) {
    console.error('Failed to reject patch:', error);
  }
};
```

---

## Project Persistence

### Auto-save Hook

```typescript
// src/hooks/useAutoSave.ts
import { useEffect, useRef } from 'react';
import { apiClient } from '../services/api';

export function useAutoSave(
  projectId: string,
  files: Array<{ path: string; content: string }>,
  interval = 300000 // 5 minutes
) {
  const timeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Set new timeout
    timeoutRef.current = setTimeout(async () => {
      try {
        await apiClient.saveProject(projectId, files);
        console.log('Project auto-saved');
      } catch (error) {
        console.error('Auto-save failed:', error);
      }
    }, interval);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [projectId, files, interval]);
}
```

### Manual Save

```typescript
const handleSave = async () => {
  try {
    await apiClient.saveProject(projectId, getAllFiles());
    showNotification('Project saved successfully');
  } catch (error) {
    showNotification('Failed to save project', 'error');
  }
};
```

---

## Error Handling

### Error Boundary

```typescript
// src/components/ErrorBoundary.tsx
import { Component, ReactNode } from 'react';

export class ErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error: Error | null }
> {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <h2>Something went wrong</h2>
          <p>{this.state.error?.message}</p>
          <button onClick={() => this.setState({ hasError: false, error: null })}>
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
```

### API Error Handler

```typescript
// src/utils/errorHandler.ts
export function handleApiError(error: any) {
  if (error.response) {
    // Server responded with error
    const { status, data } = error.response;
    
    switch (status) {
      case 401:
        return 'Please log in again';
      case 403:
        return 'You don\'t have permission for this action';
      case 429:
        return 'Rate limit exceeded. Please try again later';
      case 500:
        return 'Server error. Please try again';
      default:
        return data.message || 'An error occurred';
    }
  } else if (error.request) {
    // No response received
    return 'Network error. Please check your connection';
  } else {
    // Other errors
    return error.message || 'An unexpected error occurred';
  }
}
```

---

## Complete Example

```typescript
// src/components/AICodeEditor.tsx
import { useState, useEffect } from 'react';
import { Editor } from '@monaco-editor/react';
import { useAgentTask } from '../hooks/useAgentTask';
import { useTaskPolling } from '../hooks/useTaskPolling';
import { useAutoSave } from '../hooks/useAutoSave';
import { PatchPreview } from './PatchPreview';
import { apiClient } from '../services/api';

export function AICodeEditor() {
  const [projectId] = useState('proj_123');
  const [files, setFiles] = useState([]);
  const [currentFile, setCurrentFile] = useState('src/App.tsx');
  const [taskId, setTaskId] = useState<string | null>(null);
  
  const { createTask, loading } = useAgentTask();
  const { task, startPolling } = useTaskPolling(taskId);
  
  // Auto-save every 5 minutes
  useAutoSave(projectId, files, 300000);

  const handleAIRequest = async (prompt: string) => {
    const result = await createTask({
      projectId,
      files,
      cursor: getCursorPosition(),
      prompt,
      mode: 'patch',
    });
    
    setTaskId(result.taskId);
    startPolling();
  };

  const handleAcceptPatch = async (taskId: string) => {
    // Apply patches to editors
    task.result.filesModified.forEach(applyPatchToEditor);
    
    // Notify backend
    await apiClient.acceptPatch(taskId);
    
    // Save project
    await apiClient.saveProject(projectId, files);
    
    setTaskId(null);
  };

  const handleRejectPatch = async (taskId: string) => {
    await apiClient.rejectPatch(taskId);
    setTaskId(null);
  };

  return (
    <div className="ai-code-editor">
      <Editor
        path={currentFile}
        language="typescript"
        value={getCurrentFileContent()}
        onChange={handleEditorChange}
      />
      
      {task?.status === 'done' && (
        <PatchPreview
          task={task}
          onAccept={handleAcceptPatch}
          onReject={handleRejectPatch}
        />
      )}
      
      <AIPanel onSubmit={handleAIRequest} loading={loading} />
    </div>
  );
}
```

---

## Testing

### Test API Connection

```typescript
// Test in browser console
import { apiClient } from './services/api';

// Health check
await apiClient.healthCheck();

// Create test task
const task = await apiClient.createTask({
  projectId: 'test',
  files: [{ path: 'test.js', content: 'console.log("test")' }],
  cursor: { file: 'test.js', line: 1, col: 0 },
  prompt: 'Add a comment',
  mode: 'patch',
});

// Poll for result
const result = await apiClient.getTask(task.taskId);
```

---

## Next Steps

1. Implement diff visualization in Monaco
2. Add keyboard shortcuts for AI commands
3. Implement context-aware file selection
4. Add AI command palette
5. Implement undo/redo for AI changes
6. Add telemetry and analytics
7. Implement collaborative editing

---

## Support

For integration issues, see:
- [API Documentation](./API.md)
- [Troubleshooting](./TROUBLESHOOTING.md)
- [GitHub Issues](https://github.com/yourorg/open-frame/issues)

