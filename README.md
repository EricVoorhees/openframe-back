# Open Frame Backend - AI Website Designer with HumanLayer Integration

A professional backend API for a SaaS-based AI website designer that integrates HumanLayer for secure, effective AI-powered coding assistance.

## 🏗️ Architecture Overview

```
┌─────────────────┐
│  User Browser   │
│  React + Monaco │
│  Firebase Auth  │
└────────┬────────┘
         │ HTTPS (Bearer: Firebase ID Token)
         ▼
┌─────────────────┐
│  API Gateway    │
│  (This Backend) │
│  - Auth         │
│  - Rate Limit   │
│  - Queue Mgmt   │
└────────┬────────┘
         │ Service Auth
         ▼
┌─────────────────┐
│  HumanLayer     │
│  Agent Backend  │
│  - LLM Calls    │
│  - Tool Layer   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Backblaze B2   │
│  Project Storage│
└─────────────────┘
```

## 🚀 Features

- **Firebase Authentication**: Secure server-side token verification
- **HumanLayer Integration**: Professional AI agent orchestration
- **Task Queue System**: Redis + BullMQ for async processing
- **Rate Limiting**: Per-user and per-endpoint rate limits
- **Backblaze B2 Storage**: Persistent project file storage
- **Audit Logging**: Complete tracking of all operations
- **Quota Management**: Per-user token usage tracking
- **Docker Support**: Full containerization for easy deployment
- **Cloud Ready**: Configurations for Render and Railway

## 📋 Prerequisites

- Node.js 18+ and npm
- Go 1.24+ (for HumanLayer daemon)
- Redis 7+
- Docker and Docker Compose (optional)
- Firebase project with Admin SDK
- Backblaze B2 account
- OpenAI or Anthropic API key

## 🛠️ Setup

### 1. Clone and Install

```bash
# Repository is already cloned
cd backend
npm install
```

### 2. Configure Environment

```bash
# Copy example env file
cp env.example .env

# Edit .env with your credentials
nano .env
```

Required environment variables:
- `FIREBASE_PROJECT_ID`, `FIREBASE_PRIVATE_KEY`, `FIREBASE_CLIENT_EMAIL`
- `B2_APPLICATION_KEY_ID`, `B2_APPLICATION_KEY`, `B2_BUCKET_NAME`, `B2_BUCKET_ID`
- `ANTHROPIC_API_KEY` or `OPENAI_API_KEY`
- `HUMANLAYER_SERVICE_KEY`, `JWT_SECRET`, `SERVICE_API_KEY`

### 3. Start Services

#### Option A: Docker Compose (Recommended)

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

#### Option B: Local Development

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

## 📡 API Endpoints

### Health Check
```bash
GET /health
GET /health/detailed
```

### Agent Tasks
```bash
# Create task
POST /api/agent/tasks
Authorization: Bearer <firebase-token>
Content-Type: application/json

{
  "projectId": "proj_123",
  "files": [
    {"path": "src/App.jsx", "content": "..."}
  ],
  "cursor": {"file": "src/App.jsx", "line": 45, "col": 12},
  "prompt": "Refactor this function to use async/await",
  "mode": "patch"
}

# Get task status
GET /api/agent/tasks/:taskId
Authorization: Bearer <firebase-token>

# Accept patch
POST /api/agent/tasks/:taskId/accept
Authorization: Bearer <firebase-token>

# Reject patch
POST /api/agent/tasks/:taskId/reject
Authorization: Bearer <firebase-token>

# Get user stats
GET /api/agent/stats
Authorization: Bearer <firebase-token>
```

### Projects
```bash
# Save project
POST /api/projects/save
Authorization: Bearer <firebase-token>

# Load project
GET /api/projects/:projectId
Authorization: Bearer <firebase-token>

# List project files
GET /api/projects/:projectId/files
Authorization: Bearer <firebase-token>
```

## 🔒 Security

- **Server-side Auth**: Firebase tokens verified server-side only
- **Rate Limiting**: Multiple layers (API, agent tasks, expensive ops)
- **Service Keys**: Internal service-to-service authentication
- **Audit Logs**: Complete tracking of all operations
- **Quota Management**: Per-user token usage limits
- **CORS**: Configurable allowed origins
- **Helmet**: Security headers enabled

## 📊 Monitoring

### Queue Metrics
```bash
curl http://localhost:3001/health/detailed
```

### Logs
```bash
# View backend logs
tail -f backend/logs/combined.log

# View error logs
tail -f backend/logs/error.log

# Docker logs
docker-compose logs -f backend
```

## 🚢 Deployment

### Render

1. Push code to GitHub
2. Import repository in Render
3. Render will auto-detect `render.yaml`
4. Set environment secrets in Render dashboard
5. Deploy

### Railway

1. Install Railway CLI: `npm i -g @railway/cli`
2. Login: `railway login`
3. Create project: `railway init`
4. Deploy backend: `cd backend && railway up`
5. Deploy HumanLayer: `cd humanlayer/hld && railway up`
6. Add Redis: `railway add redis`
7. Set environment variables in Railway dashboard

### Docker (Self-hosted)

```bash
# Build and deploy
docker-compose up -d --build

# Scale workers
docker-compose up -d --scale backend=3
```

## 🧪 Testing

```bash
# Run tests
npm test

# Run linter
npm run lint

# Format code
npm run format
```

## 📝 Development Workflow

1. **Create Task**: Frontend sends files + prompt to `/api/agent/tasks`
2. **Queue Processing**: Task added to Redis queue
3. **HumanLayer Execution**: Worker calls HumanLayer daemon
4. **Result Generation**: LLM generates patch/explanation
5. **Return Result**: Frontend polls `/api/agent/tasks/:taskId`
6. **User Review**: User accepts/rejects in Monaco editor
7. **Apply Changes**: Frontend applies patch to Monaco buffers
8. **Save**: Optionally persist to Backblaze

## 🔧 Troubleshooting

### HumanLayer Connection Issues
```bash
# Check daemon health
curl http://localhost:7777/api/v1/health

# View daemon logs
docker-compose logs humanlayer
```

### Redis Connection Issues
```bash
# Check Redis
redis-cli ping

# View Redis logs
docker-compose logs redis
```

### Queue Not Processing
```bash
# Check queue metrics
curl http://localhost:3001/health/detailed

# Restart worker
docker-compose restart backend
```

## 📚 Next Steps

1. **Frontend Integration**: Connect your React app to these endpoints
2. **LLM Optimization**: Tune prompts for better results
3. **Caching**: Add result caching for identical requests
4. **Monitoring**: Set up Prometheus + Grafana
5. **Load Testing**: Test with thousands of concurrent users
6. **Key Pooling**: Rotate multiple LLM API keys
7. **Database**: Replace in-memory storage with PostgreSQL

## 🤝 Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## 📄 License

Apache 2.0 - See [LICENSE](LICENSE) for details.

## 🆘 Support

- Documentation: [docs/](docs/)
- Issues: GitHub Issues
- Email: support@yourcompany.com

