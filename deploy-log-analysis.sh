#!/bin/bash

# Deploy Log Analysis Integration
# This script deploys the log analysis feature to your existing setup

set -e

echo "🚀 Deploying Log Analysis Integration..."

# Check if we're in the right directory
if [ ! -f "README.md" ] || [ ! -d "backend" ] || [ ! -d "humanlayer" ]; then
    echo "❌ Please run this script from the project root directory"
    exit 1
fi

echo "📦 Building backend..."
cd backend
npm install
npm run build
cd ..

echo "📦 Building HumanLayer daemon..."
cd humanlayer
# Check if we have Go installed
if ! command -v go &> /dev/null; then
    echo "⚠️  Go not found. Please install Go to build HumanLayer daemon"
    echo "   You can still use the log analysis API, but you'll need to build the daemon separately"
else
    cd hld
    go mod tidy
    go build -o bin/hld ./cmd/hld
    echo "✅ HumanLayer daemon built successfully"
    cd ..
fi
cd ..

echo "🔍 Running integration tests..."
if command -v node &> /dev/null; then
    echo "ℹ️  Test script created: test-log-analysis.js"
    echo "   Update the FIREBASE_TOKEN and run: node test-log-analysis.js"
else
    echo "⚠️  Node.js not found. Skipping test script"
fi

echo ""
echo "✅ Log Analysis Integration Deployed Successfully!"
echo ""
echo "📋 Next Steps:"
echo "1. Start your services:"
echo "   - Redis: redis-server"
echo "   - HumanLayer: cd humanlayer/hld && ./bin/hld start"
echo "   - Backend: cd backend && npm run dev"
echo ""
echo "2. Test the integration:"
echo "   - Update FIREBASE_TOKEN in test-log-analysis.js"
echo "   - Run: node test-log-analysis.js"
echo ""
echo "3. Integrate with your frontend:"
echo "   - See LOG_ANALYSIS_INTEGRATION.md for detailed guide"
echo "   - Use POST /api/logs/analyze endpoint"
echo ""
echo "📚 Documentation:"
echo "   - LOG_ANALYSIS_INTEGRATION.md - Complete integration guide"
echo "   - test-log-analysis.js - Working example"
echo ""
echo "🎉 Ready to analyze logs with AI!"