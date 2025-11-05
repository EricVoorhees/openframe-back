# Deploy to Render - Complete Guide

## 🎯 Quick Deploy (3 Steps)

### **Step 1: Push to GitHub** (2 minutes)

```bash
# Give your repo URL to the setup script:
./setup-git-and-deploy.sh https://github.com/yourusername/open-frame-backend.git

# Script will:
# ✅ Initialize git
# ✅ Commit all files
# ✅ Push to your repo
```

### **Step 2: Deploy to Render** (5 minutes)

#### **Option A: Blueprint Deploy (Automated)** ⭐ Recommended

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click **"New"** → **"Blueprint"**
3. Connect your GitHub repository
4. Render auto-detects `render.yaml`
5. Set environment variables (see below)
6. Click **"Apply"**

Done! Render creates 3 services automatically:
- ✅ Backend API (Node.js)
- ✅ HumanLayer Daemon (Go)
- ✅ Redis (Managed)

#### **Option B: Manual Deploy**

1. **Create Backend Service**
   - New → Web Service
   - Connect GitHub repo
   - Name: `open-frame-backend`
   - Branch: `main`
   - Root Directory: `backend`
   - Build: `npm install && npm run build`
   - Start: `npm start`
   - Instance Type: Starter ($7/mo)

2. **Create HumanLayer Service**
   - New → Web Service
   - Same repo
   - Name: `humanlayer-daemon`
   - Root Directory: `humanlayer/hld`
   - Build: `go build -o hld ./cmd/hld`
   - Start: `./hld start`
   - Instance Type: Starter ($7/mo)

3. **Create Redis**
   - New → Redis
   - Name: `open-frame-redis`
   - Plan: Starter ($10/mo)

### **Step 3: Configure Environment** (3 minutes)

In each service settings → Environment:

#### **Backend Service Variables**

```bash
# Server
NODE_ENV=production
PORT=3001
HOST=0.0.0.0

# Firebase
FIREBASE_PROJECT_ID=your-firebase-project
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@...iam.gserviceaccount.com

# HumanLayer (Render auto-fills if using Blueprint)
HUMANLAYER_DAEMON_URL=https://humanlayer-daemon-xxxx.onrender.com
HUMANLAYER_SERVICE_KEY=<generate with: openssl rand -base64 32>

# Redis (Render auto-fills these)
REDIS_HOST=<from Redis service>
REDIS_PORT=<from Redis service>
REDIS_PASSWORD=<from Redis service>

# Backblaze B2
B2_APPLICATION_KEY_ID=your-key-id
B2_APPLICATION_KEY=your-key
B2_BUCKET_NAME=your-bucket
B2_BUCKET_ID=your-bucket-id
B2_REGION=us-west-002

# LLM
ANTHROPIC_API_KEY=sk-ant-...
# OR
OPENAI_API_KEY=sk-...
LLM_PROVIDER=anthropic

# Security (Generate fresh keys!)
JWT_SECRET=<generate with: openssl rand -base64 32>
SERVICE_API_KEY=<generate with: openssl rand -base64 32>

# Optional (defaults are fine)
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
QUEUE_CONCURRENCY=5
QUEUE_MAX_RETRIES=3
LOG_LEVEL=info
```

#### **HumanLayer Service Variables**

```bash
HUMANLAYER_DAEMON_HTTP_PORT=7777
HUMANLAYER_DAEMON_HTTP_HOST=0.0.0.0
```

---

## ✅ Verify Deployment

### **1. Check Health**
```bash
# Basic health
curl https://your-app.onrender.com/health

# Expected:
{
  "status": "ok",
  "timestamp": "2025-11-04T...",
  "uptime": 123.45
}
```

### **2. Check Detailed Health**
```bash
curl https://your-app.onrender.com/health/detailed

# Expected:
{
  "status": "ok",
  "services": {
    "humanlayer": "healthy",
    "queue": "healthy"
  },
  "queue": {
    "waiting": 0,
    "active": 0,
    "completed": 5,
    "failed": 0
  }
}
```

### **3. Test with Firebase Token**
```bash
curl https://your-app.onrender.com/api/agent/stats \
  -H "Authorization: Bearer YOUR_FIREBASE_TOKEN"

# Expected:
{
  "tier": "free",
  "isPaid": false,
  "usage": {
    "tokensUsed": 0,
    "tokensRemaining": 50000
  }
}
```

---

## 🔧 Configuration Checklist

- [ ] **GitHub repo created and code pushed**
- [ ] **Firestore enabled in Firebase Console**
- [ ] **Backblaze B2 bucket created**
- [ ] **Environment variables set in Render**
- [ ] **All 3 services deployed (Backend, HumanLayer, Redis)**
- [ ] **Health checks passing**
- [ ] **Firebase token test successful**

---

## 📊 Render Service URLs

After deployment, you'll have:

```
Backend API:
https://open-frame-backend-xxxx.onrender.com

HumanLayer Daemon:
https://humanlayer-daemon-xxxx.onrender.com

Redis:
redis://red-xxxxx:6379 (internal only)
```

---

## 🔗 Connect Frontend

Update your frontend API URL:

```typescript
// In your frontend .env
VITE_API_URL=https://open-frame-backend-xxxx.onrender.com
```

---

## 💰 Cost Breakdown

| Service | Plan | Cost/Month |
|---------|------|------------|
| Backend API | Starter | $7 |
| HumanLayer Daemon | Starter | $7 |
| Redis | Starter | $10 |
| **Total** | | **$24/mo** |

Plus variable costs:
- Backblaze B2: ~$5-20/mo
- LLM tokens: Variable (paid by users via quotas)
- Firestore: ~$5-10/mo for 1000 users

---

## 🔄 Update Deployment

When you make changes:

```bash
# 1. Commit and push
git add .
git commit -m "Your changes"
git push

# 2. Render auto-deploys!
# (Or click "Manual Deploy" in Render Dashboard)
```

---

## 🐛 Troubleshooting

### **Build Failed**
```bash
# Check Render logs
# Common issues:
# - Missing environment variables
# - Wrong Node version (need 18+)
# - Missing dependencies

# Fix: Ensure backend/package.json is correct
```

### **Health Check Fails**
```bash
# Check:
# 1. PORT=3001 set in environment
# 2. Health endpoint accessible
# 3. No startup errors in logs
```

### **Redis Connection Failed**
```bash
# Ensure Redis service is linked
# Render should auto-fill:
# - REDIS_HOST
# - REDIS_PORT  
# - REDIS_PASSWORD
```

### **HumanLayer Not Reachable**
```bash
# Check HUMANLAYER_DAEMON_URL points to correct service
# Should be: https://humanlayer-daemon-xxxx.onrender.com
```

---

## 📈 Scaling

### **Horizontal Scaling**
```
Render Dashboard → Service → Instance Count
Increase from 1 to 2+ instances
```

### **Vertical Scaling**
```
Render Dashboard → Service → Instance Type
Upgrade from Starter to Standard/Pro
```

---

## 🔐 Security Checklist

- [ ] **All secrets in environment variables (not in code)**
- [ ] **Different keys for dev/staging/prod**
- [ ] **GitHub repo is Private**
- [ ] **Firebase security rules set**
- [ ] **Rate limiting enabled**
- [ ] **CORS configured with specific origins (in production)**

---

## 📚 Additional Resources

- [Render Documentation](https://render.com/docs)
- [Node.js on Render](https://render.com/docs/deploy-node-express-app)
- [Environment Variables](https://render.com/docs/environment-variables)
- [Blueprints](https://render.com/docs/blueprint-spec)

---

## 🎉 Success!

If all health checks pass, you're live!

**Your backend is now:**
- ✅ Running on Render
- ✅ Connected to Firebase Firestore
- ✅ Tracking user tiers and quotas
- ✅ Ready for your frontend to connect
- ✅ Scalable to thousands of users

**Next:** See [INTEGRATION_GUIDE.md](./INTEGRATION_GUIDE.md) to connect your React frontend!

