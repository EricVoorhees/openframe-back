# Dockerfile for React Web UI - Connects to HumanLayer Backend
# Optimized production build for Render.com deployment

FROM oven/bun:1.2.23-alpine AS builder

WORKDIR /app

# Copy workspace files
COPY package.json bun.lock* ./
COPY apps/react/package.json ./apps/react/
COPY packages/database/package.json ./packages/database/

# Install dependencies
RUN bun install --frozen-lockfile

# Copy source code
COPY apps/react ./apps/react
COPY packages/database ./packages/database

# Build the application
WORKDIR /app/apps/react
RUN bun run build

# Production stage
FROM oven/bun:1.2.23-alpine

# Install curl for health checks
RUN apk add --no-cache curl

WORKDIR /app

# Copy built application
COPY --from=builder /app/apps/react/dist ./dist
COPY --from=builder /app/apps/react/package.json ./
COPY --from=builder /app/apps/react/src/index.tsx ./src/

# Create non-root user
RUN addgroup -g 1000 humanlayer && \
    adduser -D -u 1000 -G humanlayer humanlayer && \
    chown -R humanlayer:humanlayer /app

USER humanlayer

# Environment variables
ENV NODE_ENV=production \
    PORT=4000 \
    VITE_API_URL=http://localhost:7777

# Expose port
EXPOSE 4000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:4000/ || exit 1

# Start the application
CMD ["bun", "start"]

