#!/bin/bash

set -e

echo "🚀 Deploying to Railway..."

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Check if Railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo -e "${YELLOW}Installing Railway CLI...${NC}"
    npm install -g @railway/cli
fi

echo -e "${GREEN}✓ Railway CLI installed${NC}"

# Login to Railway
echo -e "\n${YELLOW}Logging in to Railway...${NC}"
railway login

# Initialize project
echo -e "\n${YELLOW}Initializing Railway project...${NC}"
railway init

# Deploy backend
echo -e "\n${YELLOW}Deploying backend...${NC}"
cd backend
railway up
cd ..

# Deploy HumanLayer daemon
echo -e "\n${YELLOW}Deploying HumanLayer daemon...${NC}"
cd humanlayer/hld
railway up
cd ../..

# Add Redis
echo -e "\n${YELLOW}Adding Redis...${NC}"
railway add redis

echo -e "\n${GREEN}✅ Deployment initiated!${NC}"
echo -e "\n${YELLOW}Next steps:${NC}"
echo "1. Go to Railway dashboard: https://railway.app/dashboard"
echo "2. Set environment variables for each service"
echo "3. Link services together"
echo "4. Monitor deployment logs"

echo -e "\n${YELLOW}Required environment variables:${NC}"
echo "Backend:"
echo "  - FIREBASE_PROJECT_ID"
echo "  - FIREBASE_PRIVATE_KEY"
echo "  - FIREBASE_CLIENT_EMAIL"
echo "  - B2_APPLICATION_KEY_ID"
echo "  - B2_APPLICATION_KEY"
echo "  - B2_BUCKET_NAME"
echo "  - B2_BUCKET_ID"
echo "  - ANTHROPIC_API_KEY or OPENAI_API_KEY"
echo "  - HUMANLAYER_SERVICE_KEY"
echo "  - JWT_SECRET"
echo "  - SERVICE_API_KEY"

