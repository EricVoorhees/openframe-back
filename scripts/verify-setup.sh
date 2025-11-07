#!/bin/bash
# Verification script for HumanLayer deployment setup
# Run this to ensure all deployment files are in place

set -e

echo "🔍 HumanLayer Deployment Setup Verification"
echo "==========================================="
echo ""

# Color codes for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Counters
PASSED=0
FAILED=0
WARNINGS=0

# Function to check if file exists
check_file() {
    local file=$1
    local description=$2
    
    if [ -f "$file" ]; then
        echo -e "${GREEN}✓${NC} $description: $file"
        ((PASSED++))
        return 0
    else
        echo -e "${RED}✗${NC} $description: $file (MISSING)"
        ((FAILED++))
        return 1
    fi
}

# Function to check if directory exists
check_dir() {
    local dir=$1
    local description=$2
    
    if [ -d "$dir" ]; then
        echo -e "${GREEN}✓${NC} $description: $dir"
        ((PASSED++))
        return 0
    else
        echo -e "${RED}✗${NC} $description: $dir (MISSING)"
        ((FAILED++))
        return 1
    fi
}

# Function to check file content
check_content() {
    local file=$1
    local pattern=$2
    local description=$3
    
    if [ -f "$file" ] && grep -q "$pattern" "$file"; then
        echo -e "${GREEN}✓${NC} $description"
        ((PASSED++))
        return 0
    else
        echo -e "${YELLOW}⚠${NC} $description (WARNING)"
        ((WARNINGS++))
        return 1
    fi
}

echo "📦 Checking Core Deployment Files..."
echo "-----------------------------------"
check_file "Dockerfile" "Production Dockerfile"
check_file "render.yaml" "Render Blueprint"
check_file "docker-compose.prod.yml" "Production Docker Compose"
check_file ".dockerignore" "Docker ignore file"
check_file "scripts/start-production.sh" "Production startup script"
check_file "env.example" "Environment variables example"
echo ""

echo "📚 Checking Documentation..."
echo "----------------------------"
check_file "DEPLOYMENT.md" "Deployment Guide"
check_file "QUICKSTART-RENDER.md" "Quick Start Guide"
check_file "RENDER-SETUP.md" "Render Setup Overview"
check_file "DEPLOYMENT-SUMMARY.md" "Deployment Summary"
echo ""

echo "🔧 Checking CI/CD Configuration..."
echo "-----------------------------------"
check_dir ".github/workflows" "GitHub workflows directory"
check_file ".github/workflows/deploy-render.yml" "Deploy workflow"
echo ""

echo "🏗️  Checking Project Structure..."
echo "---------------------------------"
check_dir "hld" "HLD daemon directory"
check_dir "hlyr" "HLYR CLI directory"
check_dir "scripts" "Scripts directory"
check_file "hld/go.mod" "Go module file"
check_file "hld/Makefile" "HLD Makefile"
check_file "package.json" "Root package.json"
echo ""

echo "📋 Checking File Contents..."
echo "----------------------------"
check_content "Dockerfile" "FROM golang:1.24" "Dockerfile uses Go 1.24"
check_content "Dockerfile" "HEALTHCHECK" "Dockerfile includes health check"
check_content "render.yaml" "type: web" "Render config defines web service"
check_content "render.yaml" "healthCheckPath: /api/v1/health" "Render config has health check"
check_content "scripts/start-production.sh" "#!/bin/sh" "Startup script is valid shell"
check_content "docker-compose.prod.yml" "humanlayer-daemon" "Docker Compose defines daemon service"
echo ""

echo "🔐 Checking Security Configuration..."
echo "------------------------------------"
if [ -f "env.example" ]; then
    if grep -q "ANTHROPIC_API_KEY" env.example; then
        echo -e "${GREEN}✓${NC} Environment example includes API key placeholder"
        ((PASSED++))
    fi
    if ! grep -q "sk-ant-.*[^x]" env.example; then
        echo -e "${GREEN}✓${NC} Environment example doesn't contain real secrets"
        ((PASSED++))
    else
        echo -e "${RED}✗${NC} Environment example may contain real secrets"
        ((FAILED++))
    fi
fi
echo ""

echo "📊 Verification Summary"
echo "======================="
echo -e "Passed:   ${GREEN}$PASSED${NC}"
echo -e "Failed:   ${RED}$FAILED${NC}"
echo -e "Warnings: ${YELLOW}$WARNINGS${NC}"
echo ""

# Final result
if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ All critical checks passed!${NC}"
    echo ""
    echo "🚀 Your deployment setup is complete and ready!"
    echo ""
    echo "Next steps:"
    echo "  1. Read QUICKSTART-RENDER.md for deployment instructions"
    echo "  2. Copy env.example and configure your environment variables"
    echo "  3. Test locally: docker-compose -f docker-compose.prod.yml up"
    echo "  4. Deploy to Render: Follow QUICKSTART-RENDER.md"
    echo ""
    exit 0
else
    echo -e "${RED}❌ Some checks failed!${NC}"
    echo ""
    echo "Please ensure all required files are present before deploying."
    echo "Run this script again after fixing the issues."
    echo ""
    exit 1
fi

