/**
 * Secure API Client for HumanLayer Backend
 * Connects React Web UI to the HLD daemon REST API
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:7777';
const API_TOKEN = import.meta.env.VITE_API_TOKEN || '';

interface ApiRequestOptions extends RequestInit {
  requiresAuth?: boolean;
}

/**
 * Make a secure API request with automatic authentication
 */
async function apiRequest<T>(
  endpoint: string,
  options: ApiRequestOptions = {}
): Promise<T> {
  const { requiresAuth = true, ...fetchOptions } = options;

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...fetchOptions.headers,
  };

  // Add authentication token if configured
  if (requiresAuth && API_TOKEN) {
    headers['Authorization'] = `Bearer ${API_TOKEN}`;
  }

  const url = `${API_BASE_URL}/api/v1${endpoint}`;

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      headers,
      // Include credentials for cross-origin requests
      credentials: 'include',
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({
        message: response.statusText,
      }));
      throw new Error(error.message || `API Error: ${response.status}`);
    }

    return response.json();
  } catch (error) {
    console.error('API Request failed:', error);
    throw error;
  }
}

/**
 * API Client for HumanLayer Backend
 */
export const apiClient = {
  // Health & System
  health: () => apiRequest<{ status: string; version: string }>('/health', {
    requiresAuth: false,
  }),

  debugInfo: () => apiRequest<any>('/debug-info'),

  // Sessions
  listSessions: () =>
    apiRequest<any[]>('/sessions', {
      method: 'GET',
    }),

  getSession: (sessionId: string) => apiRequest<any>(`/sessions/${sessionId}`),

  createSession: (data: any) =>
    apiRequest<any>('/sessions', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  deleteSession: (sessionId: string) =>
    apiRequest<void>(`/sessions/${sessionId}`, {
      method: 'DELETE',
    }),

  getConversation: (sessionId: string) =>
    apiRequest<any>(`/sessions/${sessionId}/conversation`),

  // Approvals
  listApprovals: () => apiRequest<any[]>('/approvals'),

  getApproval: (approvalId: string) =>
    apiRequest<any>(`/approvals/${approvalId}`),

  approveAction: (approvalId: string) =>
    apiRequest<any>(`/approvals/${approvalId}/approve`, {
      method: 'POST',
    }),

  denyAction: (approvalId: string, reason?: string) =>
    apiRequest<any>(`/approvals/${approvalId}/deny`, {
      method: 'POST',
      body: reason ? JSON.stringify({ reason }) : undefined,
    }),

  // Files
  fuzzySearchFiles: (query: string, directories: string[]) =>
    apiRequest<any>('/fuzzy-search/files', {
      method: 'POST',
      body: JSON.stringify({ query, directories }),
    }),

  validateDirectory: (path: string) =>
    apiRequest<any>('/validate-directory', {
      method: 'POST',
      body: JSON.stringify({ path }),
    }),

  // SSE (Server-Sent Events) for real-time updates
  subscribeToEvents: (onEvent: (event: MessageEvent) => void) => {
    const url = `${API_BASE_URL}/api/v1/events`;
    const eventSource = new EventSource(url);

    eventSource.onmessage = onEvent;
    eventSource.onerror = (error) => {
      console.error('SSE Error:', error);
      eventSource.close();
    };

    return () => eventSource.close();
  },
};

/**
 * React Hook for API health check
 */
export function useApiHealth() {
  const [isHealthy, setIsHealthy] = React.useState<boolean | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    apiClient
      .health()
      .then(() => setIsHealthy(true))
      .catch(() => setIsHealthy(false))
      .finally(() => setLoading(false));
  }, []);

  return { isHealthy, loading };
}

// Export for use in components
export { API_BASE_URL };

