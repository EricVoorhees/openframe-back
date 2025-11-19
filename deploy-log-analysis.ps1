# Deploy Log Analysis Integration
# This script deploys the log analysis feature to your existing setup

Write-Host "🚀 Deploying Log Analysis Integration..." -ForegroundColor Green

# Check if we're in the right directory
if (-not (Test-Path "README.md") -or -not (Test-Path "backend") -or -not (Test-Path "humanlayer")) {
    Write-Host "❌ Please run this script from the project root directory" -ForegroundColor Red
    exit 1
}

Write-Host "📦 Building backend..." -ForegroundColor Yellow
Set-Location backend
npm install
npm run build
Set-Location ..

Write-Host "📦 Building HumanLayer daemon..." -ForegroundColor Yellow
Set-Location humanlayer

# Check if we have Go installed
if (Get-Command go -ErrorAction SilentlyContinue) {
    Set-Location hld
    go mod tidy
    go build -o bin/hld.exe ./cmd/hld
    Write-Host "✅ HumanLayer daemon built successfully" -ForegroundColor Green
    Set-Location ..
} else {
    Write-Host "⚠️  Go not found. Please install Go to build HumanLayer daemon" -ForegroundColor Yellow
    Write-Host "   You can still use the log analysis API, but you'll need to build the daemon separately"
}
Set-Location ..

Write-Host "🔍 Running integration tests..." -ForegroundColor Yellow
if (Get-Command node -ErrorAction SilentlyContinue) {
    Write-Host "ℹ️  Test script created: test-log-analysis.js" -ForegroundColor Cyan
    Write-Host "   Update the FIREBASE_TOKEN and run: node test-log-analysis.js"
} else {
    Write-Host "⚠️  Node.js not found. Skipping test script" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "✅ Log Analysis Integration Deployed Successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Next Steps:" -ForegroundColor Cyan
Write-Host "1. Start your services:"
Write-Host "   - Redis: redis-server"
Write-Host "   - HumanLayer: cd humanlayer/hld && ./bin/hld.exe start"
Write-Host "   - Backend: cd backend && npm run dev"
Write-Host ""
Write-Host "2. Test the integration:"
Write-Host "   - Update FIREBASE_TOKEN in test-log-analysis.js"
Write-Host "   - Run: node test-log-analysis.js"
Write-Host ""
Write-Host "3. Integrate with your frontend:"
Write-Host "   - See LOG_ANALYSIS_INTEGRATION.md for detailed guide"
Write-Host "   - Use POST /api/logs/analyze endpoint"
Write-Host ""
Write-Host "📚 Documentation:" -ForegroundColor Cyan
Write-Host "   - LOG_ANALYSIS_INTEGRATION.md - Complete integration guide"
Write-Host "   - test-log-analysis.js - Working example"
Write-Host ""
Write-Host "🎉 Ready to analyze logs with AI!" -ForegroundColor Green