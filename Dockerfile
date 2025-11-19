FROM node:20-alpine AS builder

WORKDIR /app/backend

COPY backend/package*.json ./
COPY backend/tsconfig.json ./

RUN npm ci

COPY backend/src ./src

RUN npm run build

FROM node:20-alpine

WORKDIR /app

COPY backend/package*.json ./

RUN npm ci --omit=dev

COPY --from=builder /app/backend/dist ./dist

RUN mkdir -p logs

RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

RUN chown -R nodejs:nodejs /app

USER nodejs

EXPOSE 3001

CMD ["node", "dist/index.js"]
