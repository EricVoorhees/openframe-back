#!/bin/bash

set -e

echo "🚀 Setting up Open Frame Backend..."

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check prerequisites
echo -e "\n${YELLOW}Checking prerequisites...${NC}"

# Check Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Node.js $(node --version)${NC}"

# Check npm
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm is not installed${NC}"
    exit 1
fi
echo -e "${GREEN}✓ npm $(npm --version)${NC}"

# Check Go
if ! command -v go &> /dev/null; then
    echo -e "${YELLOW}⚠ Go is not installed (required for HumanLayer daemon)${NC}"
else
    echo -e "${GREEN}✓ Go $(go version | awk '{print $3}')${NC}"
fi

# Check Redis
if ! command -v redis-cli &> /dev/null; then
    echo -e "${YELLOW}⚠ Redis is not installed (can use Docker instead)${NC}"
else
    echo -e "${GREEN}✓ Redis installed${NC}"
fi

# Check Docker
if ! command -v docker &> /dev/null; then
    echo -e "${YELLOW}⚠ Docker is not installed (optional)${NC}"
else
    echo -e "${GREEN}✓ Docker $(docker --version | awk '{print $3}' | tr -d ',')${NC}"
fi

# Install backend dependencies
echo -e "\n${YELLOW}Installing backend dependencies...${NC}"
cd backend
npm install
echo -e "${GREEN}✓ Backend dependencies installed${NC}"

# Setup environment file
echo -e "\n${YELLOW}Setting up environment file...${NC}"
if [ ! -f .env ]; then
    cp env.example .env
    echo -e "${GREEN}✓ Created .env file${NC}"
    echo -e "${YELLOW}⚠ Please edit backend/.env with your credentials${NC}"
else
    echo -e "${GREEN}✓ .env file already exists${NC}"
fi

# Create logs directory
mkdir -p logs
echo -e "${GREEN}✓ Created logs directory${NC}"

cd ..

# Build HumanLayer daemon (if Go is available)
if command -v go &> /dev/null; then
    echo -e "\n${YELLOW}Building HumanLayer daemon...${NC}"
    cd humanlayer/hld
    go mod download
    go build -o hld ./cmd/hld
    echo -e "${GREEN}✓ HumanLayer daemon built${NC}"
    cd ../..
fi

echo -e "\n${GREEN}✅ Setup complete!${NC}"
echo -e "\n${YELLOW}Next steps:${NC}"
echo -e "1. Edit backend/.env with your credentials"
echo -e "2. Start Redis: ${GREEN}redis-server${NC}"
echo -e "3. Start HumanLayer: ${GREEN}cd humanlayer/hld && ./hld start${NC}"
echo -e "4. Start Backend: ${GREEN}cd backend && npm run dev${NC}"
echo -e "\nOr use Docker Compose: ${GREEN}docker-compose up${NC}"

