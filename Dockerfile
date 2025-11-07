# Simplified Dockerfile for HumanLayer Backend API Only
# Builds only the Go daemon (hld) without Node.js components

# Stage 1: Build Go backend
FROM golang:1.24-alpine AS builder

# Install build dependencies
RUN apk add --no-cache git gcc musl-dev sqlite-dev

WORKDIR /build

# Copy go modules files first for better caching
COPY go.work ./
COPY hld/go.mod hld/go.sum ./hld/
COPY claudecode-go/go.mod claudecode-go/go.sum ./claudecode-go/

# Download dependencies
WORKDIR /build/hld
RUN go mod download

# Copy source code
WORKDIR /build
COPY hld ./hld
COPY claudecode-go ./claudecode-go

# Build the daemon binary
WORKDIR /build/hld
RUN CGO_ENABLED=1 GOOS=linux go build \
    -ldflags="-w -s" \
    -o hld ./cmd/hld

# Stage 2: Production runtime
FROM alpine:3.19

# Install runtime dependencies
RUN apk add --no-cache \
    ca-certificates \
    sqlite-libs \
    curl \
    tzdata \
    && addgroup -g 1000 humanlayer \
    && adduser -D -u 1000 -G humanlayer humanlayer

# Set working directory
WORKDIR /app

# Copy built binary from builder
COPY --from=builder /build/hld/hld /app/hld

# Create necessary directories
RUN mkdir -p /app/data /app/logs \
    && chown -R humanlayer:humanlayer /app

# Switch to non-root user
USER humanlayer

# Environment variables
ENV HUMANLAYER_DATABASE_PATH=/app/data/daemon.db \
    HUMANLAYER_DAEMON_HTTP_PORT=7777 \
    HUMANLAYER_DAEMON_HTTP_HOST=0.0.0.0 \
    PORT=7777

# Expose HTTP port
EXPOSE 7777

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:7777/api/v1/health || exit 1

# Start the daemon
CMD ["/app/hld"]

