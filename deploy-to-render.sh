#!/bin/bash
# Automated Render Deployment Script
# This script helps you deploy HumanLayer to Render

set -e

echo "🚀 HumanLayer - Render Deployment Helper"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if we're in the right directory
if [ ! -f "Dockerfile" ] || [ ! -f "render.yaml" ]; then
    echo -e "${RED}❌ Error: Please run this script from the humanlayer directory${NC}"
    exit 1
fi

echo -e "${GREEN}✓${NC} Found deployment files"
echo ""

# Step 1: Check Git status
echo "📦 Step 1: Checking deployment files..."
echo "---------------------------------------"

FILES_TO_ADD=(
    "Dockerfile"
    "render.yaml"
    "docker-compose.prod.yml"
    ".dockerignore"
    "scripts/start-production.sh"
    "apps/react/Dockerfile"
    "apps/react/render.yaml"
    "apps/react/env.example"
    "apps/react/src/lib/api-client.ts"
    "DEPLOYMENT.md"
    "DEPLOYMENT-SUMMARY.md"
    "QUICKSTART-RENDER.md"
    "WEB-UI-DEPLOYMENT.md"
    "WEB-UI-QUICKSTART.md"
    "RENDER-SETUP.md"
    "RENDER-DEPLOYMENT-FIX.md"
    "UI-OPTIONS.md"
    "env.example"
)

echo "Files ready to deploy:"
for file in "${FILES_TO_ADD[@]}"; do
    if [ -f "$file" ] || [ -d "$file" ]; then
        echo -e "  ${GREEN}✓${NC} $file"
    else
        echo -e "  ${YELLOW}⚠${NC} $file (optional, not found)"
    fi
done
echo ""

# Step 2: Git setup
echo "🔧 Step 2: Git Setup"
echo "--------------------"
echo ""
echo "Do you want to:"
echo "  1) Push to your own fork (recommended)"
echo "  2) Create a new repository"
echo "  3) Skip and do it manually"
echo ""
read -p "Choose (1/2/3): " GIT_CHOICE

case $GIT_CHOICE in
    1)
        echo ""
        echo "To push to your fork:"
        echo "1. Fork https://github.com/humanlayer/humanlayer on GitHub"
        echo "2. Enter your fork URL below"
        echo ""
        read -p "Enter your fork URL (e.g., https://github.com/YOUR-USERNAME/humanlayer): " FORK_URL
        
        if [ -n "$FORK_URL" ]; then
            echo ""
            echo "Adding your fork as remote..."
            git remote add myfork "$FORK_URL" 2>/dev/null || git remote set-url myfork "$FORK_URL"
            
            echo "Adding deployment files..."
            git add "${FILES_TO_ADD[@]}" 2>/dev/null || true
            
            echo ""
            read -p "Commit message (or press Enter for default): " COMMIT_MSG
            if [ -z "$COMMIT_MSG" ]; then
                COMMIT_MSG="Add complete Render deployment configuration"
            fi
            
            git commit -m "$COMMIT_MSG" || echo "No changes to commit"
            
            echo ""
            echo "Pushing to your fork..."
            git push myfork main
            
            echo -e "${GREEN}✓${NC} Pushed to your fork!"
            echo ""
            REPO_URL="$FORK_URL"
        fi
        ;;
    2)
        echo ""
        echo "To create a new repo:"
        echo "1. Go to https://github.com/new"
        echo "2. Create a repo (e.g., humanlayer-backend)"
        echo "3. Copy the repo URL and enter it below"
        echo ""
        read -p "Enter new repo URL: " NEW_REPO_URL
        
        if [ -n "$NEW_REPO_URL" ]; then
            echo ""
            echo "Initializing Git..."
            git init 2>/dev/null || true
            git add "${FILES_TO_ADD[@]}" 2>/dev/null || true
            git commit -m "Initial commit - Render deployment" || echo "Using existing commits"
            
            git remote add origin "$NEW_REPO_URL" 2>/dev/null || git remote set-url origin "$NEW_REPO_URL"
            git branch -M main
            
            echo ""
            echo "Pushing to new repo..."
            git push -u origin main
            
            echo -e "${GREEN}✓${NC} Pushed to new repo!"
            echo ""
            REPO_URL="$NEW_REPO_URL"
        fi
        ;;
    3)
        echo ""
        echo -e "${YELLOW}⚠${NC} Skipping Git push. You'll need to do this manually."
        echo ""
        echo "Manual commands:"
        echo "  git add ${FILES_TO_ADD[0]} ${FILES_TO_ADD[1]} ..."
        echo "  git commit -m 'Add deployment config'"
        echo "  git push"
        ;;
    *)
        echo -e "${RED}Invalid choice${NC}"
        exit 1
        ;;
esac

# Step 3: Render Configuration
echo ""
echo "🔧 Step 3: Update Render Services"
echo "----------------------------------"
echo ""
echo "Now you need to update your Render services:"
echo ""
echo -e "${YELLOW}Backend Service:${NC}"
echo "  1. Go to: https://dashboard.render.com/web/srv-d45ci1e3jp1c73de8mug/settings"
echo "  2. Update Repository to: $REPO_URL"
echo "  3. Set Dockerfile Path: ./Dockerfile"
echo "  4. Set Docker Context: ."
echo "  5. Click 'Save Changes'"
echo ""
echo -e "${YELLOW}Web UI Service:${NC}"
echo "  1. Go to: https://dashboard.render.com/web/srv-d45ci4buibrs73f279c0/settings"
echo "  2. Update Repository to: $REPO_URL"
echo "  3. Set Dockerfile Path: ./apps/react/Dockerfile"
echo "  4. Set Docker Context: ../.."
echo "  5. Click 'Save Changes'"
echo ""
echo -e "${YELLOW}Add Persistent Disk (Backend):${NC}"
echo "  1. Go to: https://dashboard.render.com/web/srv-d45ci1e3jp1c73de8mug"
echo "  2. Click 'Disks' in sidebar"
echo "  3. Click 'Add Disk'"
echo "  4. Name: humanlayer-data"
echo "  5. Mount Path: /app/data"
echo "  6. Size: 10 GB"
echo "  7. Click 'Save'"
echo ""

read -p "Press Enter when you've updated the services..."

echo ""
echo "🎉 Deployment Initiated!"
echo "======================="
echo ""
echo "Your services are now building:"
echo ""
echo -e "${GREEN}Backend:${NC}"
echo "  • URL: https://humanlayer-backend.onrender.com"
echo "  • Dashboard: https://dashboard.render.com/web/srv-d45ci1e3jp1c73de8mug"
echo "  • Logs: https://dashboard.render.com/web/srv-d45ci1e3jp1c73de8mug/logs"
echo ""
echo -e "${GREEN}Web UI:${NC}"
echo "  • URL: https://humanlayer-web-ui.onrender.com"
echo "  • Dashboard: https://dashboard.render.com/web/srv-d45ci4buibrs73f279c0"
echo "  • Logs: https://dashboard.render.com/web/srv-d45ci4buibrs73f279c0/logs"
echo ""
echo "⏱️  Build time: ~8-10 minutes"
echo ""
echo "✅ Next steps:"
echo "  1. Watch the logs for build progress"
echo "  2. Wait for 'Live' status"
echo "  3. Test: curl https://humanlayer-backend.onrender.com/api/v1/health"
echo "  4. Open: https://humanlayer-web-ui.onrender.com"
echo ""
echo "📚 Need help? See RENDER-DEPLOYMENT-FIX.md"
echo ""

