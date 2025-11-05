# System Architecture

## High-Level Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                          USER BROWSER                               │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  React Application                                           │  │
│  │  ├─ Monaco Editor (Code editing)                             │  │
│  │  ├─ Sandpack (Live preview)                                  │  │
│  │  ├─ Firebase Auth (ID tokens)                                │  │
│  │  └─ AI Panel (User prompts)                                  │  │
│  └──────────────────────────────────────────────────────────────┘  │
└────────────────────────┬────────────────────────────────────────────┘
                         │
                         │ HTTPS
                         │ Authorization: Bearer <firebase-token>
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      BACKEND API (Node.js)                          │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Middleware Stack                                            │  │
│  │  ├─ CORS & Security (helmet)                                 │  │
│  │  ├─ Rate Limiting (Redis-backed)                             │  │
│  │  ├─ Firebase Token Verification                              │  │
│  │  └─ Request Validation (Zod)                                 │  │
│  └──────────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  API Routes                                                  │  │
│  │  ├─ POST /api/agent/tasks          (Create AI task)         │  │
│  │  ├─ GET  /api/agent/tasks/:id      (Get task status)        │  │
│  │  ├─ POST /api/agent/tasks/:id/accept                        │  │
│  │  ├─ POST /api/projects/save        (Save to Backblaze)      │  │
│  │  └─ GET  /health                   (Health check)           │  │
│  └──────────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Services Layer                                              │  │
│  │  ├─ HumanLayer Client (Agent orchestration)                 │  │
│  │  ├─ Backblaze Service (File storage)                        │  │
│  │  ├─ Queue Service (Task management)                         │  │
│  │  └─ Audit Service (Logging & quotas)                        │  │
│  └──────────────────────────────────────────────────────────────┘  │
└────────┬──────────────────┬──────────────────┬─────────────────────┘
         │                  │                  │
         │                  │                  │
         ▼                  ▼                  ▼
┌────────────────┐  ┌────────────────┐  ┌────────────────┐
│  HUMANLAYER    │  │     REDIS      │  │  BACKBLAZE B2  │
│    DAEMON      │  │  (Queue + RL)  │  │  (Storage)     │
│                │  │                │  │                │
│  ├─ Sessions   │  │  ├─ BullMQ     │  │  ├─ Projects   │
│  ├─ Tools      │  │  ├─ Rate Limit │  │  ├─ Files      │
│  └─ MCP        │  │  └─ Cache      │  │  └─ Snapshots  │
└────────┬───────┘  └────────────────┘  └────────────────┘
         │
         │
         ▼
┌────────────────┐
│   LLM APIs     │
│                │
│  ├─ OpenAI     │
│  └─ Anthropic  │
└────────────────┘
```

## Request Flow

### 1. Agent Task Creation

```
User types prompt in AI Panel
         │
         ▼
Frontend collects:
  - Current file(s)
  - Cursor position
  - User prompt
  - Task mode
         │
         ▼
POST /api/agent/tasks
  Headers: Authorization: Bearer <token>
  Body: { projectId, files, cursor, prompt, mode }
         │
         ▼
Backend validates:
  ├─ Verify Firebase token
  ├─ Check rate limits
  ├─ Validate request schema
  └─ Check user quota
         │
         ▼
Create Task object:
  - Generate unique ID
  - Set status: 'queued'
  - Log audit event
         │
         ▼
Upload files to Backblaze
  (for persistence)
         │
         ▼
Enqueue task in Redis
  (BullMQ)
         │
         ▼
Return to frontend:
  { taskId, status: 'queued' }
```

### 2. Task Processing

```
BullMQ Worker picks up task
         │
         ▼
Update status: 'processing'
         │
         ▼
Call HumanLayer Client
  ├─ Build system prompt
  ├─ Build user prompt with context
  └─ Execute agent task
         │
         ▼
HumanLayer Daemon
  ├─ Create session
  ├─ Load context
  ├─ Call LLM API
  ├─ Execute tools
  └─ Generate result
         │
         ▼
Process LLM response
  ├─ Extract patches/diffs
  ├─ Parse explanation
  └─ Collect metrics
         │
         ▼
Update task:
  ├─ status: 'done'
  ├─ result: { type, filesModified, explanation }
  └─ metrics: { tokens, duration }
         │
         ▼
Log audit event
Update user quota
         │
         ▼
Task ready for retrieval
```

### 3. Result Retrieval & Application

```
Frontend polls:
  GET /api/agent/tasks/:taskId
         │
         ▼
Backend returns task with result
         │
         ▼
Frontend displays patch preview:
  ├─ Show diff
  ├─ Show explanation
  └─ Show Accept/Reject buttons
         │
         ▼
User clicks Accept
         │
         ▼
POST /api/agent/tasks/:taskId/accept
         │
         ▼
Frontend applies patch:
  ├─ Parse unified diff
  ├─ Apply to Monaco editor
  └─ Update file buffers
         │
         ▼
Trigger Sandpack rebuild
  (Live preview updates)
         │
         ▼
Optionally save to Backblaze:
  POST /api/projects/save
```

## Component Responsibilities

### Frontend (React + Monaco)
**Responsibilities:**
- User interface and interaction
- Code editing (Monaco)
- Live preview (Sandpack)
- Authentication (Firebase)
- Patch visualization
- Applying diffs to editor

**Does NOT:**
- Store LLM API keys
- Directly call LLM APIs
- Manage task queue
- Verify auth tokens

### Backend API (Node.js/Express)
**Responsibilities:**
- Server-side auth verification
- Rate limiting and quotas
- Request validation
- Task orchestration
- Audit logging
- API gateway

**Does NOT:**
- Execute LLM calls directly
- Store user code permanently
- Render UI
- Manage sessions directly

### HumanLayer Daemon (Go)
**Responsibilities:**
- Agent session management
- Tool execution
- LLM API calls
- Context management
- MCP protocol

**Does NOT:**
- Handle user authentication
- Manage rate limits
- Store project files
- Expose public API

### Redis
**Responsibilities:**
- Task queue (BullMQ)
- Rate limiting state
- Cache (optional)
- Session data

### Backblaze B2
**Responsibilities:**
- Project file storage
- Version history
- Backup storage
- Large file handling

## Data Flow

### Task Data Structure

```typescript
Task {
  id: string                    // UUID
  userId: string                // Firebase UID
  projectId: string             // Project identifier
  files: Array<{
    path: string
    content: string
  }>
  cursor: {
    file: string
    line: number
    col: number
  }
  prompt: string                // User's request
  mode: 'patch' | 'explain' | 'generate_test' | 'lint_fix'
  status: 'queued' | 'processing' | 'done' | 'failed'
  result?: {
    type: string
    filesModified?: Array<{
      path: string
      patch: string             // Unified diff format
    }>
    explanation?: string
  }
  metrics?: {
    tokens: number
    llmProvider: string
    durationMs: number
  }
  error?: string
  createdAt: Date
  updatedAt: Date
}
```

### Audit Log Structure

```typescript
AuditLog {
  id: string
  userId: string
  projectId: string
  taskId: string
  action: 'task_created' | 'task_completed' | 'task_failed' | 
          'patch_accepted' | 'patch_rejected'
  prompt?: string
  llmProvider?: string
  tokensUsed?: number
  durationMs?: number
  accepted?: boolean
  timestamp: Date
  metadata?: Record<string, unknown>
}
```

## Security Layers

### Layer 1: Network
- HTTPS only in production
- CORS configured
- Helmet security headers

### Layer 2: Authentication
- Firebase ID token verification
- Server-side validation
- Token expiry checks

### Layer 3: Authorization
- User owns resource checks
- Service-to-service keys
- API key rotation

### Layer 4: Rate Limiting
- Per-IP limits (general API)
- Per-user limits (agent tasks)
- Per-user quotas (monthly tokens)

### Layer 5: Validation
- Request schema validation (Zod)
- Input sanitization
- Output validation

### Layer 6: Audit
- All actions logged
- User tracking
- Token usage monitoring

## Scaling Strategy

### Horizontal Scaling

**Backend API:**
```
Load Balancer
    │
    ├─── Backend Instance 1
    ├─── Backend Instance 2
    ├─── Backend Instance 3
    └─── Backend Instance N
           │
           └─── Shared Redis
```

**Workers:**
```
Redis Queue
    │
    ├─── Worker 1 (Concurrency: 5)
    ├─── Worker 2 (Concurrency: 5)
    ├─── Worker 3 (Concurrency: 5)
    └─── Worker N (Concurrency: 5)
```

### Vertical Scaling

**Increase per instance:**
- Memory (for larger contexts)
- CPU (for faster processing)
- Network bandwidth

### Optimization Points

1. **Caching**
   - Result caching (identical prompts)
   - Context caching (LLM providers)
   - File caching (Backblaze)

2. **Queue Management**
   - Priority queues
   - Separate queues per mode
   - Batch processing

3. **LLM Optimization**
   - Prompt optimization
   - Context window management
   - Key pooling

4. **Database**
   - Move audit logs to PostgreSQL
   - Add read replicas
   - Implement sharding

## Monitoring Points

### Health Checks
- `/health` - Basic liveness
- `/health/detailed` - Service status
- Queue metrics
- Redis connectivity
- HumanLayer daemon status

### Metrics to Track
- Request rate (req/s)
- Error rate (%)
- Response time (p50, p95, p99)
- Queue depth
- Task completion rate
- Token usage per user
- Cost per task
- Cache hit rate

### Alerts
- High error rate (> 5%)
- Slow response time (> 5s)
- Queue backup (> 100 tasks)
- High Redis memory (> 80%)
- Quota exceeded (per user)
- Service down

## Failure Modes & Recovery

### Backend API Down
- **Impact:** No new tasks
- **Recovery:** Auto-restart, load balancer failover
- **Mitigation:** Multiple instances

### HumanLayer Daemon Down
- **Impact:** Tasks fail
- **Recovery:** Auto-restart, retry queue
- **Mitigation:** Health checks, circuit breaker

### Redis Down
- **Impact:** No queue, no rate limiting
- **Recovery:** Redis persistence, backup
- **Mitigation:** Redis cluster, sentinel

### LLM API Down
- **Impact:** Tasks fail
- **Recovery:** Retry with backoff, fallback provider
- **Mitigation:** Multiple providers, circuit breaker

### Backblaze Down
- **Impact:** Can't save/load projects
- **Recovery:** Retry with backoff
- **Mitigation:** Local caching, alternative storage

## Cost Optimization

### Strategies

1. **Prompt Engineering**
   - Reduce token usage
   - Optimize context window
   - Use cheaper models when possible

2. **Caching**
   - Cache identical requests
   - Cache common patterns
   - Context caching

3. **Key Pooling**
   - Rotate multiple keys
   - Distribute load
   - Avoid rate limits

4. **Queue Management**
   - Batch similar tasks
   - Debounce rapid requests
   - Smart prioritization

5. **Storage**
   - Compress files
   - Delete old versions
   - Use lifecycle policies

## Future Enhancements

### Short-term
- [ ] Implement result caching
- [ ] Add WebSocket for real-time updates
- [ ] Implement context-aware file selection
- [ ] Add diff visualization library

### Medium-term
- [ ] Multi-model support
- [ ] Collaborative editing
- [ ] Version control integration
- [ ] Advanced analytics dashboard

### Long-term
- [ ] Multi-region deployment
- [ ] Edge computing
- [ ] Custom model fine-tuning
- [ ] Enterprise features (SSO, RBAC)

