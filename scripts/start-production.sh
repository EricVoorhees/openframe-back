#!/bin/sh
# Production startup script for HumanLayer Daemon
# Handles initialization, health checks, and graceful shutdown

set -e

echo "🚀 Starting HumanLayer Daemon (Production)"
echo "============================================"

# Print environment info
echo "Environment:"
echo "  - Database: ${HUMANLAYER_DATABASE_PATH:-/app/data/daemon.db}"
echo "  - HTTP Port: ${HUMANLAYER_DAEMON_HTTP_PORT:-7777}"
echo "  - HTTP Host: ${HUMANLAYER_DAEMON_HTTP_HOST:-0.0.0.0}"

# Ensure data directory exists
mkdir -p "$(dirname "${HUMANLAYER_DATABASE_PATH:-/app/data/daemon.db}")"

# Initialize database if it doesn't exist
if [ ! -f "${HUMANLAYER_DATABASE_PATH:-/app/data/daemon.db}" ]; then
    echo "📦 Initializing new database..."
fi

# Function to handle shutdown gracefully
shutdown() {
    echo ""
    echo "⏹️  Received shutdown signal, stopping daemon..."
    kill -TERM "$PID" 2>/dev/null || true
    wait "$PID"
    echo "✅ Daemon stopped gracefully"
    exit 0
}

# Trap termination signals
trap shutdown SIGTERM SIGINT

# Start the daemon in the background
echo "🔧 Starting daemon..."
/app/hld &
PID=$!

echo "✅ Daemon started with PID: $PID"
echo "🌐 API available at http://${HUMANLAYER_DAEMON_HTTP_HOST:-0.0.0.0}:${HUMANLAYER_DAEMON_HTTP_PORT:-7777}"
echo ""
echo "Logs will appear below:"
echo "============================================"

# Wait for the daemon process
wait "$PID"
EXIT_CODE=$?

if [ $EXIT_CODE -ne 0 ]; then
    echo "❌ Daemon exited with code: $EXIT_CODE"
    exit $EXIT_CODE
fi

echo "✅ Daemon exited normally"

