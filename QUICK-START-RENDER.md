# Quick Start: Deploy to Render in 5 Minutes

## Step 1: Push to GitHub (2 minutes)

```bash
# Navigate to your project
cd x:\openFRAME--BACKEND

# Add all changes
git add .

# Commit with a clear message
git commit -m "feat: Prepare backend for Render deployment

- Add go.work file for Go workspace
- Fix Dockerfile to handle go.work
- Configure PORT for Render compatibility
- Update render.yaml with optimized settings
- Add .env for local development"

# Push to GitHub
git push origin main
```

**Don't have a GitHub repo yet?**
```bash
# Create new repo on GitHub first, then:
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPO-NAME.git
git branch -M main
git push -u origin main
```

---

## Step 2: Create Render Service (2 minutes)

1. **Go to Render Dashboard**
   - Visit: https://dashboard.render.com/
   - Sign in or create account

2. **Create New Web Service**
   - Click "New +" button (top right)
   - Select "Web Service"

3. **Connect Repository**
   - Click "Connect account" if needed
   - Select your GitHub repository
   - Click "Connect"

4. **Configure Service**
   - **Name**: `humanlayer-backend` (or your choice)
   - **Region**: `Oregon` (or closest to you)
   - **Branch**: `main`
   - **Runtime**: `Docker`
   - **Dockerfile Path**: `./Dockerfile`
   - **Docker Context**: `.`
   - **Instance Type**: `Starter` (free) or `Standard` (paid)

5. **Click "Create Web Service"**

---

## Step 3: Add Persistent Disk (1 minute)

**IMPORTANT**: Do this immediately after service creation!

1. In your service dashboard, click **"Disks"** in left sidebar
2. Click **"Add Disk"**
3. Configure:
   - **Name**: `humanlayer-data`
   - **Mount Path**: `/app/data`
   - **Size**: `10 GB`
4. Click **"Save"**

The service will automatically redeploy with the disk attached.

---

## Step 4: Wait for Build (5-10 minutes)

Watch the logs in the Render dashboard. You'll see:

```
Building Docker image...
[+] Building 8.5s (15/15) FINISHED
Successfully built image
Starting service...
daemon started socket=/app/data/daemon.sock http_enabled=true
Starting HTTP server configured_port=10000 actual_address=0.0.0.0:10000
```

When you see **"Live"** status → You're deployed! 🎉

---

## Step 5: Test Your API (30 seconds)

### Get Your URL
Your app is live at: `https://YOUR-SERVICE-NAME.onrender.com`

### Test Health Endpoint
```bash
curl https://YOUR-SERVICE-NAME.onrender.com/api/v1/health
```

**Expected Response:**
```json
{
  "status": "ok",
  "version": "dev"
}
```

### Test from Browser
Open: `https://YOUR-SERVICE-NAME.onrender.com/api/v1/health`

---

## Optional: Add API Key (For AI Features)

If you want to use Anthropic/Claude features:

1. Go to service **"Environment"** tab
2. Click **"Add Environment Variable"**
3. Add:
   - **Key**: `ANTHROPIC_API_KEY`
   - **Value**: `sk-ant-your-key-here`
4. Click **"Save Changes"**

Service will auto-redeploy with the new variable.

---

## Update Your Frontend

In your frontend code, update the API URL:

```javascript
// Before
const API_URL = 'http://localhost:7777'

// After
const API_URL = 'https://YOUR-SERVICE-NAME.onrender.com'
```

---

## Troubleshooting

### Build Fails
- Check logs for specific error
- Ensure `go.work` file is committed
- Verify Dockerfile path is `./Dockerfile`

### Service Won't Start
- Check if disk is mounted at `/app/data`
- Verify PORT environment variable is set (auto by Render)
- Review logs for startup errors

### Can't Connect from Frontend
- Check CORS settings (already configured for `*`)
- Verify service is "Live" status
- Test health endpoint first

### Database Errors
- Ensure persistent disk is added
- Check mount path is `/app/data`
- Verify disk has enough space

---

## What's Next?

### Production Checklist
- [ ] Add custom domain
- [ ] Set up monitoring
- [ ] Configure CORS for specific origins
- [ ] Add API authentication
- [ ] Set up automated backups

### Scaling
- Upgrade to Standard plan for better performance
- Consider PostgreSQL for high concurrency
- Add Redis for caching (see `render.yaml`)

---

## Quick Commands Reference

### View Logs
```bash
# In Render dashboard
Service → Logs tab
```

### Redeploy
```bash
# Push to GitHub
git push origin main

# Or in Render dashboard
Service → Manual Deploy → Deploy latest commit
```

### Environment Variables
```bash
# In Render dashboard
Service → Environment tab → Add Environment Variable
```

### Shell Access
```bash
# In Render dashboard
Service → Shell tab
```

---

## Your Service URLs

After deployment, save these URLs:

- **API Base**: `https://YOUR-SERVICE-NAME.onrender.com`
- **Health Check**: `https://YOUR-SERVICE-NAME.onrender.com/api/v1/health`
- **Dashboard**: `https://dashboard.render.com/web/YOUR-SERVICE-ID`
- **Logs**: `https://dashboard.render.com/web/YOUR-SERVICE-ID/logs`

---

## Cost Estimate

### Free Tier (Starter)
- **Cost**: $0/month
- **Limitations**: Spins down after 15 min inactivity
- **Good for**: Development, testing, demos

### Standard Plan
- **Cost**: $7/month
- **Features**: Always on, better performance
- **Good for**: Production apps

### Disk Storage
- **Cost**: $0.25/GB/month
- **10 GB**: ~$2.50/month

**Total for Production**: ~$10/month

---

**That's it! You're deployed! 🚀**

Questions? Check `RENDER-DEPLOYMENT-READY.md` for detailed documentation.
