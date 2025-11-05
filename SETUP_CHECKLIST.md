# Setup Checklist

Use this checklist to ensure everything is properly configured.

## ✅ Prerequisites

- [ ] Node.js 18+ installed (`node --version`)
- [ ] npm installed (`npm --version`)
- [ ] Go 1.24+ installed (optional, for HumanLayer) (`go version`)
- [ ] Redis installed or Docker available (`redis-cli ping` or `docker --version`)
- [ ] Git installed (`git --version`)

## ✅ Accounts & Credentials

### Firebase
- [ ] Firebase project created
- [ ] Firebase Admin SDK credentials downloaded
- [ ] Project ID noted
- [ ] Private key extracted
- [ ] Client email noted

### Backblaze B2
- [ ] Backblaze account created
- [ ] B2 bucket created
- [ ] Application key created
- [ ] Key ID noted
- [ ] Bucket name noted
- [ ] Bucket ID noted

### LLM Provider
- [ ] Anthropic OR OpenAI account created
- [ ] API key generated
- [ ] Billing configured
- [ ] Rate limits understood

## ✅ Repository Setup

- [ ] Repository cloned
- [ ] HumanLayer submodule present (`humanlayer/` directory exists)
- [ ] Scripts are executable (`ls -la scripts/`)

## ✅ Backend Configuration

- [ ] Navigate to `backend/` directory
- [ ] Run `npm install`
- [ ] Copy `env.example` to `.env`
- [ ] Fill in all environment variables:

### Server Config
- [ ] `NODE_ENV` set
- [ ] `PORT` set (default: 3001)
- [ ] `HOST` set (default: 0.0.0.0)

### Firebase Config
- [ ] `FIREBASE_PROJECT_ID` set
- [ ] `FIREBASE_PRIVATE_KEY` set (with \n for newlines)
- [ ] `FIREBASE_CLIENT_EMAIL` set

### HumanLayer Config
- [ ] `HUMANLAYER_DAEMON_URL` set
- [ ] `HUMANLAYER_SERVICE_KEY` generated and set

### Redis Config
- [ ] `REDIS_HOST` set
- [ ] `REDIS_PORT` set
- [ ] `REDIS_PASSWORD` set (if required)

### Backblaze Config
- [ ] `B2_APPLICATION_KEY_ID` set
- [ ] `B2_APPLICATION_KEY` set
- [ ] `B2_BUCKET_NAME` set
- [ ] `B2_BUCKET_ID` set
- [ ] `B2_REGION` set

### LLM Config
- [ ] `ANTHROPIC_API_KEY` OR `OPENAI_API_KEY` set
- [ ] `LLM_PROVIDER` set (anthropic or openai)

### Security Config
- [ ] `JWT_SECRET` generated (use: `openssl rand -base64 32`)
- [ ] `SERVICE_API_KEY` generated (use: `openssl rand -base64 32`)

## ✅ HumanLayer Setup

- [ ] Navigate to `humanlayer/hld/`
- [ ] Run `go mod download`
- [ ] Run `go build -o hld ./cmd/hld`
- [ ] Binary `hld` created successfully

## ✅ Service Startup

### Option A: Docker Compose
- [ ] Docker and Docker Compose installed
- [ ] Run `docker-compose up -d`
- [ ] Check services: `docker-compose ps`
- [ ] All services show "Up"

### Option B: Local Development
- [ ] Terminal 1: Start Redis (`redis-server`)
- [ ] Terminal 2: Start HumanLayer (`cd humanlayer/hld && ./hld start`)
- [ ] Terminal 3: Start Backend (`cd backend && npm run dev`)

## ✅ Verification

### Health Checks
- [ ] Backend health: `curl http://localhost:3001/health`
  - Expected: `{"status":"ok",...}`
- [ ] HumanLayer health: `curl http://localhost:7777/api/v1/health`
  - Expected: HTTP 200
- [ ] Detailed health: `curl http://localhost:3001/health/detailed`
  - Expected: All services "healthy"

### Redis Check
- [ ] Redis ping: `redis-cli ping`
  - Expected: `PONG`
- [ ] Or Docker: `docker-compose exec redis redis-cli ping`
  - Expected: `PONG`

### Service Logs
- [ ] Backend logs show no errors
- [ ] HumanLayer logs show no errors
- [ ] Redis logs show no errors

## ✅ API Testing

### Get Firebase Token
- [ ] Log in to your frontend app
- [ ] Get ID token from Firebase Auth
- [ ] Token starts with `eyJ...`

### Test Create Task
```bash
curl -X POST http://localhost:3001/api/agent/tasks \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "test",
    "files": [{"path": "test.js", "content": "console.log(\"test\");"}],
    "cursor": {"file": "test.js", "line": 1, "col": 0},
    "prompt": "Add a comment",
    "mode": "patch"
  }'
```

- [ ] Response received
- [ ] Response contains `taskId`
- [ ] Response status is 201

### Test Get Task
```bash
curl http://localhost:3001/api/agent/tasks/TASK_ID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

- [ ] Response received
- [ ] Task status visible
- [ ] Eventually status becomes "done" or "failed"

## ✅ Frontend Integration

- [ ] Frontend can call backend API
- [ ] Firebase token is sent correctly
- [ ] CORS is configured (if needed)
- [ ] Tasks can be created
- [ ] Results can be retrieved
- [ ] Patches can be applied

## ✅ Production Readiness

### Security
- [ ] All secrets in environment variables
- [ ] No credentials in code
- [ ] `.gitignore` configured
- [ ] HTTPS configured (in production)
- [ ] CORS origins restricted (in production)

### Monitoring
- [ ] Health checks working
- [ ] Logs being written
- [ ] Error tracking configured
- [ ] Metrics collection planned

### Backup
- [ ] Backblaze backup strategy
- [ ] Redis persistence enabled
- [ ] Audit logs retention policy

### Documentation
- [ ] Team knows how to deploy
- [ ] Environment variables documented
- [ ] Troubleshooting guide available
- [ ] API documentation available

## ✅ Deployment

### Choose Platform
- [ ] Docker Compose (self-hosted)
- [ ] Render (managed PaaS)
- [ ] Railway (managed PaaS)
- [ ] AWS/GCP/Azure (cloud provider)

### Deployment Steps
- [ ] Code pushed to repository
- [ ] Environment variables configured
- [ ] Services deployed
- [ ] Health checks passing
- [ ] DNS configured (if applicable)
- [ ] SSL certificates configured

### Post-Deployment
- [ ] Production health check
- [ ] Test API endpoints
- [ ] Monitor logs
- [ ] Check metrics
- [ ] Verify costs

## 🎉 Success Criteria

- [ ] ✅ All services running
- [ ] ✅ Health checks passing
- [ ] ✅ API endpoints responding
- [ ] ✅ Tasks can be created and completed
- [ ] ✅ Frontend can integrate
- [ ] ✅ No errors in logs
- [ ] ✅ Documentation complete

## 🆘 Troubleshooting

If any check fails, see:
- `README.md` - Main documentation
- `QUICKSTART.md` - Quick setup guide
- `DEPLOYMENT.md` - Deployment guide
- `INTEGRATION_GUIDE.md` - Frontend integration
- GitHub Issues - Community support

## 📝 Notes

Use this space for your own notes:

```
Date: _______________
Environment: _______________
Issues encountered:


Solutions:


```

---

**Once all items are checked, you're ready to go! 🚀**

