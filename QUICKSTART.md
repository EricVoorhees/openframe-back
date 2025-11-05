# Quick Start Guide

Get the Open Frame Backend up and running in 5 minutes.

## Prerequisites

- Node.js 18+
- Redis (or Docker)
- Firebase project
- Backblaze B2 account
- Anthropic or OpenAI API key

## Step 1: Setup

```bash
# Run setup script
./scripts/setup.sh
```

This will:
- Install backend dependencies
- Create `.env` file
- Build HumanLayer daemon (if Go is available)

## Step 2: Configure Environment

Edit `backend/.env` with your credentials:

```bash
# Minimum required configuration
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@your-project.iam.gserviceaccount.com

B2_APPLICATION_KEY_ID=your-key-id
B2_APPLICATION_KEY=your-key
B2_BUCKET_NAME=your-bucket
B2_BUCKET_ID=your-bucket-id

ANTHROPIC_API_KEY=sk-ant-...

HUMANLAYER_SERVICE_KEY=generate-random-key
JWT_SECRET=generate-random-key
SERVICE_API_KEY=generate-random-key
```

## Step 3: Start Services

### Option A: Docker Compose (Easiest)

```bash
docker-compose up
```

That's it! All services start automatically.

### Option B: Local Development

```bash
# Terminal 1: Redis
redis-server

# Terminal 2: HumanLayer Daemon
cd humanlayer/hld
./hld start

# Terminal 3: Backend API
cd backend
npm run dev
```

## Step 4: Verify

```bash
# Check backend health
curl http://localhost:3001/health

# Check HumanLayer daemon
curl http://localhost:7777/api/v1/health

# View detailed health
curl http://localhost:3001/health/detailed
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2025-11-04T...",
  "uptime": 123.45,
  "services": {
    "humanlayer": "healthy",
    "queue": "healthy"
  }
}
```

## Step 5: Test API

### Get Firebase Token

In your frontend app or Firebase console, get an ID token.

### Create Test Task

```bash
curl -X POST http://localhost:3001/api/agent/tasks \
  -H "Authorization: Bearer YOUR_FIREBASE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "test-project",
    "files": [
      {
        "path": "test.js",
        "content": "function hello() {\n  console.log(\"hello\");\n}"
      }
    ],
    "cursor": {
      "file": "test.js",
      "line": 2,
      "col": 2
    },
    "prompt": "Add JSDoc comment to this function",
    "mode": "patch"
  }'
```

### Check Task Status

```bash
# Replace TASK_ID with the ID from previous response
curl http://localhost:3001/api/agent/tasks/TASK_ID \
  -H "Authorization: Bearer YOUR_FIREBASE_TOKEN"
```

## Step 6: Integrate Frontend

See [INTEGRATION_GUIDE.md](./INTEGRATION_GUIDE.md) for detailed frontend integration.

Quick example:

```typescript
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:3001',
});

// Add auth header
api.interceptors.request.use(async (config) => {
  const token = await firebase.auth().currentUser?.getIdToken();
  config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Create task
const response = await api.post('/api/agent/tasks', {
  projectId: 'my-project',
  files: [...],
  cursor: { file: 'App.tsx', line: 10, col: 5 },
  prompt: 'Refactor this component',
  mode: 'patch',
});

// Poll for result
const taskId = response.data.taskId;
const result = await api.get(`/api/agent/tasks/${taskId}`);
```

## Common Issues

### "Firebase token verification failed"
- Check Firebase credentials in `.env`
- Ensure private key has `\n` for newlines
- Verify token is from correct Firebase project

### "HumanLayer connection failed"
- Check HumanLayer daemon is running
- Verify `HUMANLAYER_DAEMON_URL` in `.env`
- Check firewall/network settings

### "Redis connection failed"
- Ensure Redis is running: `redis-cli ping`
- Check Redis host/port in `.env`
- Try restarting Redis

### "Queue not processing tasks"
- Check worker logs: `docker-compose logs backend`
- Verify LLM API key is set
- Check queue metrics: `curl localhost:3001/health/detailed`

## Next Steps

1. ✅ Backend is running
2. 📱 Integrate with your React frontend
3. 🚀 Deploy to production (see [DEPLOYMENT.md](./DEPLOYMENT.md))
4. 📊 Set up monitoring
5. 🔒 Configure production security

## Resources

- [Full Documentation](./README.md)
- [Integration Guide](./INTEGRATION_GUIDE.md)
- [Deployment Guide](./DEPLOYMENT.md)
- [API Reference](./API.md)
- [Troubleshooting](./TROUBLESHOOTING.md)

## Support

Need help? 
- Check the docs above
- Open an issue on GitHub
- Join our Discord community

