#!/bin/bash

set -e

echo "🚀 Deploying to Render..."

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Check if render.yaml exists
if [ ! -f render.yaml ]; then
    echo -e "${RED}❌ render.yaml not found${NC}"
    exit 1
fi

echo -e "${YELLOW}Deployment checklist:${NC}"
echo "1. Ensure your code is pushed to GitHub"
echo "2. Create a new Web Service in Render dashboard"
echo "3. Connect your GitHub repository"
echo "4. Render will auto-detect render.yaml"
echo "5. Set the following environment secrets in Render:"
echo "   - FIREBASE_PROJECT_ID"
echo "   - FIREBASE_PRIVATE_KEY"
echo "   - FIREBASE_CLIENT_EMAIL"
echo "   - B2_APPLICATION_KEY_ID"
echo "   - B2_APPLICATION_KEY"
echo "   - B2_BUCKET_NAME"
echo "   - B2_BUCKET_ID"
echo "   - ANTHROPIC_API_KEY or OPENAI_API_KEY"
echo "6. Click 'Create Web Service'"

echo -e "\n${GREEN}✓ Deployment configuration ready${NC}"
echo -e "${YELLOW}Visit https://dashboard.render.com to complete deployment${NC}"

