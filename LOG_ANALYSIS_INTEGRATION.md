# Log Analysis Integration Guide

## Overview

This integration adds AI-powered log analysis capabilities to your Open Frame backend, allowing your frontend to send condensed log summaries and receive intelligent insights, recommendations, and narratives about development sessions.

## Architecture

```
Frontend App
     │
     │ POST /api/logs/analyze
     │ (Log Summary Data)
     ▼
Backend API
     │
     │ RPC call to HumanLayer
     ▼
HumanLayer Daemon
     │
     │ AI Analysis
     ▼
AI Agent Response
     │
     │ Structured insights
     ▼
Frontend App
```

## What Was Added

### 1. HumanLayer Contracts Extension
**File:** `humanlayer/packages/contracts/src/daemon/index.ts`

Added new schemas and contracts:
- `UniqueErrorSchema` - Error patterns with frequency data
- `CriticalLogSchema` - Important log entries
- `NetworkSummarySchema` - Network request statistics
- `PerformanceAlertSchema` - Performance issue alerts
- `LogSummarySchema` - Complete log analysis input
- `analyzeLogsContract` - RPC contract for log analysis

### 2. HumanLayer Logs Router
**File:** `humanlayer/apps/daemon/src/router/logs.ts` (NEW)

Implements the log analysis logic:
- Receives condensed log data
- Builds AI prompts from log summaries
- Calls AI agent (placeholder for now)
- Returns structured analysis

### 3. Backend Log Analysis Route
**File:** `backend/src/routes/logs.ts` (NEW)

Provides REST API endpoints:
- `POST /api/logs/analyze` - Analyze log summaries
- `GET /api/logs/health` - Check service health

### 4. Enhanced Backend Services
**Files:** 
- `backend/src/services/humanlayerClient.ts` - Added `analyzeLogs()` method
- `backend/src/services/auditService.ts` - Added `logAction()` method
- `backend/src/types/index.ts` - Added log analysis types

## API Usage

### Endpoint
```
POST /api/logs/analyze
Authorization: Bearer <firebase-token>
Content-Type: application/json
```

### Request Body
```typescript
{
  summary_id: string,
  session_id: string,
  total_logs: number,
  error_count: number,
  warn_count: number,
  unique_errors: Array<{
    error_type: string,
    message: string,
    count: number,
    frequency_pattern: string
  }>,
  critical_logs: Array<{
    timestamp: string,
    level: string,
    message: string,
    frame_name: string
  }>,
  network_summary: {
    total_requests: number,
    success_rate: number,
    failed_requests: number
  },
  performance_alerts: Array<{
    severity: string,
    message: string,
    duration_ms: number
  }>
}
```

### Response
```typescript
{
  narrative: string,           // 2-3 sentence summary
  key_insights: string[],      // Top issues identified
  recommendations: string[]    // Actionable next steps
}
```

## Frontend Integration

### 1. Log Collection
Your frontend should collect and condense logs before sending:

```typescript
// Example log processing
function processLogsForAnalysis(logs: LogEntry[]): LogSummary {
  const errors = logs.filter(log => log.level === 'ERROR');
  const warnings = logs.filter(log => log.level === 'WARN');
  
  // Group similar errors
  const uniqueErrors = groupErrorsByType(errors);
  
  // Extract critical logs (errors + important warnings)
  const criticalLogs = logs
    .filter(log => log.level === 'ERROR' || isImportantWarning(log))
    .slice(-20); // Last 20 critical logs
  
  // Calculate network stats
  const networkLogs = logs.filter(log => log.type === 'network');
  const networkSummary = calculateNetworkStats(networkLogs);
  
  // Detect performance issues
  const performanceAlerts = detectPerformanceIssues(logs);
  
  return {
    summary_id: generateId(),
    session_id: getCurrentSessionId(),
    total_logs: logs.length,
    error_count: errors.length,
    warn_count: warnings.length,
    unique_errors: uniqueErrors,
    critical_logs: criticalLogs,
    network_summary: networkSummary,
    performance_alerts: performanceAlerts
  };
}
```

### 2. API Call
```typescript
async function analyzeSessionLogs(logSummary: LogSummary): Promise<LogAnalysisResponse> {
  const response = await fetch('/api/logs/analyze', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${firebaseToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(logSummary)
  });
  
  if (!response.ok) {
    throw new Error(`Analysis failed: ${response.statusText}`);
  }
  
  return response.json();
}
```

### 3. Display Results
```typescript
function displayAnalysis(analysis: LogAnalysisResponse) {
  // Show narrative
  document.getElementById('session-narrative').textContent = analysis.narrative;
  
  // Show insights
  const insightsList = document.getElementById('insights-list');
  analysis.key_insights.forEach(insight => {
    const li = document.createElement('li');
    li.textContent = insight;
    insightsList.appendChild(li);
  });
  
  // Show recommendations
  const recsList = document.getElementById('recommendations-list');
  analysis.recommendations.forEach(rec => {
    const li = document.createElement('li');
    li.textContent = rec;
    recsList.appendChild(li);
  });
}
```

## Testing

### 1. Start Services
```bash
# Terminal 1: Start Redis
redis-server

# Terminal 2: Start HumanLayer daemon
cd humanlayer/hld
go run ./cmd/hld start

# Terminal 3: Start Backend
cd backend
npm run dev
```

### 2. Run Test Script
```bash
# Update FIREBASE_TOKEN in test-log-analysis.js first
node test-log-analysis.js
```

### 3. Manual Testing
```bash
# Health check
curl http://localhost:3001/health

# Log analysis (replace TOKEN)
curl -X POST http://localhost:3001/api/logs/analyze \
  -H "Authorization: Bearer YOUR_FIREBASE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "summary_id": "test-001",
    "session_id": "session-001",
    "total_logs": 100,
    "error_count": 5,
    "warn_count": 2,
    "unique_errors": [
      {
        "error_type": "TypeError",
        "message": "Cannot read property of undefined",
        "count": 3,
        "frequency_pattern": "increasing"
      }
    ],
    "critical_logs": [
      {
        "timestamp": "2024-01-15T10:30:00Z",
        "level": "ERROR",
        "message": "Database connection failed",
        "frame_name": "UserService"
      }
    ],
    "network_summary": {
      "total_requests": 50,
      "success_rate": 90.0,
      "failed_requests": 5
    },
    "performance_alerts": [
      {
        "severity": "HIGH",
        "message": "Slow render detected",
        "duration_ms": 500
      }
    ]
  }'
```

## Customization

### 1. AI Agent Integration
Replace the placeholder in `humanlayer/apps/daemon/src/router/logs.ts`:

```typescript
// TODO: Replace this section
const response = await generatePlaceholderResponse(input)

// With your actual AI agent call:
const response = await yourAIAgent.chat({
  message: prompt,
  context: 'log-analysis',
  temperature: 0.3
});
```

### 2. Prompt Customization
Modify the `buildPrompt()` function to adjust the AI prompt:

```typescript
function buildPrompt(input: any): string {
  return `You are a senior developer analyzing a coding session.
  
  ${/* your custom prompt template */}
  
  Focus on: ${/* your specific focus areas */}`;
}
```

### 3. Response Processing
Customize the response structure in the AI agent call:

```typescript
// Parse AI response and structure it
return {
  narrative: extractNarrative(aiResponse),
  key_insights: extractInsights(aiResponse),
  recommendations: extractRecommendations(aiResponse)
};
```

## Security Considerations

1. **Authentication**: All requests require valid Firebase tokens
2. **Rate Limiting**: Inherits existing API rate limits
3. **Audit Logging**: All analysis requests are logged
4. **Data Privacy**: Log data is processed but not permanently stored
5. **Input Validation**: All inputs are validated with Zod schemas

## Performance Notes

1. **Log Condensation**: Frontend should pre-process logs to reduce payload size
2. **Async Processing**: Consider making analysis async for large log sets
3. **Caching**: Consider caching results for identical log summaries
4. **Rate Limits**: Respect existing rate limits for AI agent calls

## Troubleshooting

### Common Issues

1. **"Service unavailable"**
   - Check HumanLayer daemon is running
   - Verify daemon URL in backend config

2. **"Invalid token"**
   - Ensure Firebase token is valid and not expired
   - Check Firebase configuration

3. **"Analysis failed"**
   - Check HumanLayer daemon logs
   - Verify AI agent configuration

### Debug Steps

1. Check service health:
   ```bash
   curl http://localhost:3001/api/logs/health \
     -H "Authorization: Bearer YOUR_TOKEN"
   ```

2. Check HumanLayer daemon:
   ```bash
   curl http://localhost:7777/api/v1/health
   ```

3. Check backend logs:
   ```bash
   tail -f backend/logs/combined.log
   ```

## Next Steps

1. **Integrate Real AI Agent**: Replace placeholder with actual HumanLayer AI calls
2. **Add Caching**: Cache analysis results for performance
3. **Enhance Prompts**: Customize prompts for your specific use cases
4. **Add Metrics**: Track analysis quality and usage
5. **Frontend UI**: Build rich UI components for displaying results

## Example Integration

See `test-log-analysis.js` for a complete working example of how to call the API.

The integration is now ready to use with your frontend application!