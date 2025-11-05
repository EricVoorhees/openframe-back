#!/bin/bash

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Open Frame Backend - Git Setup & Deploy Helper       ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check if repository URL is provided
if [ -z "$1" ]; then
    echo -e "${RED}❌ Error: Repository URL required${NC}"
    echo ""
    echo "Usage:"
    echo "  ./setup-git-and-deploy.sh https://github.com/yourusername/open-frame-backend.git"
    echo ""
    echo "Don't have a repo yet?"
    echo "  1. Go to: https://github.com/new"
    echo "  2. Name: open-frame-backend"
    echo "  3. Keep it PRIVATE (contains sensitive configs)"
    echo "  4. Don't initialize with README"
    echo "  5. Copy the repo URL and run this script again"
    exit 1
fi

REPO_URL="$1"

echo -e "${YELLOW}Repository:${NC} $REPO_URL"
echo ""

# Check if .env exists in backend
if [ ! -f "backend/.env" ]; then
    echo -e "${YELLOW}⚠️  Warning: backend/.env not found${NC}"
    echo "   Creating from example..."
    cp backend/env.example backend/.env
    echo -e "${YELLOW}   ⚠️  IMPORTANT: Edit backend/.env with your credentials before deploying!${NC}"
    echo ""
fi

# Check if git is initialized
if [ ! -d ".git" ]; then
    echo -e "${YELLOW}📦 Initializing git repository...${NC}"
    git init
    echo -e "${GREEN}✓ Git initialized${NC}"
    echo ""
else
    echo -e "${GREEN}✓ Git already initialized${NC}"
    echo ""
fi

# Set default branch to main
echo -e "${YELLOW}🔧 Setting default branch to main...${NC}"
git branch -M main
echo -e "${GREEN}✓ Default branch set${NC}"
echo ""

# Check for sensitive files
echo -e "${YELLOW}🔍 Checking for sensitive files...${NC}"
if [ -f "backend/.env" ]; then
    if git check-ignore backend/.env > /dev/null 2>&1; then
        echo -e "${GREEN}✓ backend/.env is properly ignored${NC}"
    else
        echo -e "${RED}❌ WARNING: backend/.env is NOT in .gitignore!${NC}"
        echo "   Adding it now..."
        echo "backend/.env" >> .gitignore
        echo -e "${GREEN}✓ Fixed${NC}"
    fi
fi
echo ""

# Stage all files
echo -e "${YELLOW}📝 Staging files...${NC}"
git add .
echo -e "${GREEN}✓ Files staged${NC}"
echo ""

# Show what will be committed
echo -e "${YELLOW}📋 Files to commit:${NC}"
git status --short | head -20
if [ $(git status --short | wc -l) -gt 20 ]; then
    echo "   ... and $(( $(git status --short | wc -l) - 20 )) more files"
fi
echo ""

# Check if there are changes to commit
if git diff --cached --quiet; then
    echo -e "${YELLOW}⚠️  No changes to commit (everything already committed)${NC}"
else
    # Create commit
    echo -e "${YELLOW}💾 Creating commit...${NC}"
    git commit -m "Initial commit: Complete backend with tier system

- Express.js backend with TypeScript
- Firebase Authentication & Firestore integration
- 3-tier user management (Free/Pro/Enterprise)
- Real-time usage tracking and quotas
- Multiple concurrent agents support
- HumanLayer integration ready
- Backblaze B2 storage
- Redis + BullMQ task queue
- Rate limiting and security
- Stripe webhook integration
- Admin API
- Complete documentation
- Docker & Render deployment configs"
    
    echo -e "${GREEN}✓ Commit created${NC}"
    echo ""
fi

# Check if remote exists
if git remote get-url origin > /dev/null 2>&1; then
    EXISTING_REMOTE=$(git remote get-url origin)
    if [ "$EXISTING_REMOTE" != "$REPO_URL" ]; then
        echo -e "${YELLOW}⚠️  Remote 'origin' exists but points to different URL${NC}"
        echo "   Current: $EXISTING_REMOTE"
        echo "   Updating to: $REPO_URL"
        git remote set-url origin "$REPO_URL"
        echo -e "${GREEN}✓ Remote updated${NC}"
    else
        echo -e "${GREEN}✓ Remote already configured${NC}"
    fi
else
    echo -e "${YELLOW}🔗 Adding remote origin...${NC}"
    git remote add origin "$REPO_URL"
    echo -e "${GREEN}✓ Remote added${NC}"
fi
echo ""

# Push to remote
echo -e "${YELLOW}🚀 Pushing to GitHub...${NC}"
if git push -u origin main; then
    echo -e "${GREEN}✓ Pushed successfully!${NC}"
    echo ""
else
    echo -e "${YELLOW}⚠️  Push failed (might need force push if repo has README)${NC}"
    echo "   Trying force push..."
    if git push -u origin main --force; then
        echo -e "${GREEN}✓ Force pushed successfully!${NC}"
        echo ""
    else
        echo -e "${RED}❌ Push failed${NC}"
        echo "   You may need to:"
        echo "   1. Check your GitHub credentials"
        echo "   2. Ensure the repository exists"
        echo "   3. Try manually: git push -u origin main"
        exit 1
    fi
fi

echo -e "${GREEN}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  ✅ SUCCESS! Code pushed to GitHub                     ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════╝${NC}"
echo ""

echo -e "${BLUE}📋 Next Steps:${NC}"
echo ""
echo -e "${YELLOW}1. Deploy to Render:${NC}"
echo "   → Go to: https://dashboard.render.com"
echo "   → Click: New → Blueprint"
echo "   → Connect your GitHub repo: $(basename $REPO_URL .git)"
echo "   → Render will auto-detect render.yaml"
echo "   → Click 'Apply'"
echo ""

echo -e "${YELLOW}2. Set Environment Variables in Render:${NC}"
echo "   Required variables (copy from backend/.env):"
echo "   ✓ FIREBASE_PROJECT_ID"
echo "   ✓ FIREBASE_PRIVATE_KEY"
echo "   ✓ FIREBASE_CLIENT_EMAIL"
echo "   ✓ B2_APPLICATION_KEY_ID"
echo "   ✓ B2_APPLICATION_KEY"
echo "   ✓ B2_BUCKET_NAME"
echo "   ✓ B2_BUCKET_ID"
echo "   ✓ ANTHROPIC_API_KEY or OPENAI_API_KEY"
echo "   ✓ HUMANLAYER_SERVICE_KEY"
echo "   ✓ JWT_SECRET"
echo "   ✓ SERVICE_API_KEY"
echo ""

echo -e "${YELLOW}3. Enable Firestore:${NC}"
echo "   → Firebase Console: https://console.firebase.google.com"
echo "   → Select your project"
echo "   → Firestore Database → Create Database"
echo ""

echo -e "${YELLOW}4. Test Deployment:${NC}"
echo "   After Render deploys (5-10 minutes):"
echo "   → curl https://your-app.onrender.com/health"
echo ""

echo -e "${BLUE}📚 Documentation:${NC}"
echo "   • QUICKSTART.md - Quick setup guide"
echo "   • DEPLOYMENT.md - Deployment details"
echo "   • TIER_SYSTEM_GUIDE.md - Tier system docs"
echo "   • INTEGRATION_GUIDE.md - Frontend integration"
echo ""

echo -e "${GREEN}🎉 You're ready to deploy!${NC}"

