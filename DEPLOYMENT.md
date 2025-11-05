# Deployment Guide

This guide covers deploying the Open Frame Backend to various platforms.

## Table of Contents

1. [Docker Compose (Local/Self-hosted)](#docker-compose)
2. [Render](#render)
3. [Railway](#railway)
4. [AWS/GCP/Azure](#cloud-providers)

---

## Docker Compose

### Prerequisites
- Docker and Docker Compose installed
- Environment variables configured

### Steps

1. **Configure Environment**
```bash
cp backend/env.example backend/.env
# Edit backend/.env with your credentials
```

2. **Build and Start**
```bash
docker-compose up -d --build
```

3. **Verify Services**
```bash
# Check status
docker-compose ps

# View logs
docker-compose logs -f

# Test health
curl http://localhost:3001/health
curl http://localhost:7777/api/v1/health
```

4. **Scale Workers** (optional)
```bash
docker-compose up -d --scale backend=3
```

5. **Stop Services**
```bash
docker-compose down
```

---

## Render

### Prerequisites
- GitHub account
- Render account
- Code pushed to GitHub

### Steps

1. **Prepare Repository**
```bash
git add .
git commit -m "Prepare for Render deployment"
git push origin main
```

2. **Create Services in Render**
   - Go to [Render Dashboard](https://dashboard.render.com)
   - Click "New" → "Blueprint"
   - Connect your GitHub repository
   - Render will auto-detect `render.yaml`

3. **Configure Environment Variables**

   Set these secrets in Render dashboard for the backend service:
   - `FIREBASE_PROJECT_ID`
   - `FIREBASE_PRIVATE_KEY` (use quotes, keep \n as literal)
   - `FIREBASE_CLIENT_EMAIL`
   - `B2_APPLICATION_KEY_ID`
   - `B2_APPLICATION_KEY`
   - `B2_BUCKET_NAME`
   - `B2_BUCKET_ID`
   - `ANTHROPIC_API_KEY` or `OPENAI_API_KEY`

4. **Deploy**
   - Click "Apply" to create all services
   - Monitor deployment logs
   - Services will auto-deploy on future pushes

5. **Verify Deployment**
```bash
# Replace with your Render URL
curl https://your-app.onrender.com/health
```

### Render Configuration

The `render.yaml` file defines:
- **Backend API** (Node.js web service)
- **HumanLayer Daemon** (Go web service)
- **Redis** (managed Redis instance)

All services are automatically linked via environment variables.

---

## Railway

### Prerequisites
- Railway account
- Railway CLI installed

### Steps

1. **Install Railway CLI**
```bash
npm install -g @railway/cli
```

2. **Login**
```bash
railway login
```

3. **Initialize Project**
```bash
railway init
```

4. **Deploy Backend**
```bash
cd backend
railway up
cd ..
```

5. **Deploy HumanLayer Daemon**
```bash
cd humanlayer/hld
railway up
cd ../..
```

6. **Add Redis**
```bash
railway add redis
```

7. **Configure Environment Variables**

   In Railway dashboard, set variables for backend service:
   - `FIREBASE_PROJECT_ID`
   - `FIREBASE_PRIVATE_KEY`
   - `FIREBASE_CLIENT_EMAIL`
   - `B2_APPLICATION_KEY_ID`
   - `B2_APPLICATION_KEY`
   - `B2_BUCKET_NAME`
   - `B2_BUCKET_ID`
   - `ANTHROPIC_API_KEY` or `OPENAI_API_KEY`
   - `HUMANLAYER_SERVICE_KEY`
   - `JWT_SECRET`
   - `SERVICE_API_KEY`

8. **Link Services**
   - Set `HUMANLAYER_DAEMON_URL` to HumanLayer service URL
   - Set `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD` from Redis service

9. **Verify Deployment**
```bash
railway status
railway logs
```

---

## Cloud Providers

### AWS (ECS + RDS + ElastiCache)

1. **Build Docker Images**
```bash
docker build -t open-frame-backend:latest ./backend
docker build -t humanlayer-daemon:latest ./humanlayer/hld
```

2. **Push to ECR**
```bash
aws ecr get-login-password --region us-west-2 | docker login --username AWS --password-stdin <account-id>.dkr.ecr.us-west-2.amazonaws.com

docker tag open-frame-backend:latest <account-id>.dkr.ecr.us-west-2.amazonaws.com/open-frame-backend:latest
docker push <account-id>.dkr.ecr.us-west-2.amazonaws.com/open-frame-backend:latest
```

3. **Create ECS Task Definitions**
   - Use `docker-compose.yml` as reference
   - Configure environment variables
   - Set up load balancer

4. **Create ElastiCache Redis Cluster**
   - Use Redis 7.x
   - Configure security groups
   - Note connection details

5. **Deploy ECS Services**
   - Create backend service
   - Create HumanLayer service
   - Configure auto-scaling

### GCP (Cloud Run + Memorystore)

1. **Build and Push Images**
```bash
gcloud builds submit --tag gcr.io/<project-id>/open-frame-backend ./backend
gcloud builds submit --tag gcr.io/<project-id>/humanlayer-daemon ./humanlayer/hld
```

2. **Create Memorystore Redis Instance**
```bash
gcloud redis instances create open-frame-redis \
  --size=1 \
  --region=us-central1 \
  --redis-version=redis_7_0
```

3. **Deploy to Cloud Run**
```bash
gcloud run deploy open-frame-backend \
  --image gcr.io/<project-id>/open-frame-backend \
  --platform managed \
  --region us-central1 \
  --set-env-vars "$(cat backend/.env | xargs)"
```

### Azure (Container Instances + Redis Cache)

1. **Create Resource Group**
```bash
az group create --name open-frame-rg --location eastus
```

2. **Create Azure Container Registry**
```bash
az acr create --resource-group open-frame-rg --name openframeacr --sku Basic
```

3. **Build and Push Images**
```bash
az acr build --registry openframeacr --image open-frame-backend:latest ./backend
az acr build --registry openframeacr --image humanlayer-daemon:latest ./humanlayer/hld
```

4. **Create Redis Cache**
```bash
az redis create --resource-group open-frame-rg --name open-frame-redis --location eastus --sku Basic --vm-size c0
```

5. **Deploy Container Instances**
```bash
az container create \
  --resource-group open-frame-rg \
  --name open-frame-backend \
  --image openframeacr.azurecr.io/open-frame-backend:latest \
  --dns-name-label open-frame-backend \
  --ports 3001 \
  --environment-variables $(cat backend/.env)
```

---

## Post-Deployment Checklist

- [ ] Health checks passing
- [ ] Environment variables set correctly
- [ ] Firebase authentication working
- [ ] HumanLayer daemon accessible
- [ ] Redis connection successful
- [ ] Backblaze B2 storage accessible
- [ ] LLM API keys valid
- [ ] Rate limiting configured
- [ ] Logging working
- [ ] Monitoring set up
- [ ] SSL/TLS certificates configured
- [ ] CORS origins configured
- [ ] Backup strategy in place

---

## Monitoring

### Health Checks
```bash
# Basic health
curl https://your-domain.com/health

# Detailed health
curl https://your-domain.com/health/detailed
```

### Logs
```bash
# Docker Compose
docker-compose logs -f backend

# Render
# View in Render dashboard

# Railway
railway logs

# AWS CloudWatch
aws logs tail /ecs/open-frame-backend --follow
```

### Metrics

Set up monitoring for:
- Request rate
- Error rate
- Response time
- Queue depth
- Redis memory usage
- Token usage
- Cost per user

---

## Troubleshooting

### Service Won't Start
1. Check environment variables
2. Verify Redis connection
3. Check HumanLayer daemon health
4. Review logs for errors

### High Latency
1. Check queue depth
2. Scale workers
3. Optimize LLM prompts
4. Add caching layer

### Rate Limit Issues
1. Adjust rate limits in config
2. Implement key pooling
3. Upgrade LLM provider plan

### Out of Memory
1. Increase container memory
2. Check for memory leaks
3. Optimize data structures
4. Scale horizontally

---

## Rollback

### Docker Compose
```bash
docker-compose down
git checkout <previous-commit>
docker-compose up -d --build
```

### Render
- Revert to previous deployment in dashboard

### Railway
```bash
railway rollback
```

---

## Support

For deployment issues:
1. Check logs first
2. Review this guide
3. Check GitHub issues
4. Contact support

