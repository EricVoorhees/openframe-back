# Backend API

Express.js backend for Open Frame AI Website Designer.

## Quick Start

```bash
# Install dependencies
npm install

# Copy environment file
cp env.example .env

# Edit .env with your credentials
nano .env

# Run in development mode
npm run dev

# Build for production
npm run build

# Run production build
npm start
```

## Project Structure

```
backend/
├── src/
│   ├── config/          # Configuration and env validation
│   ├── middleware/      # Express middleware (auth, rate limit, errors)
│   ├── routes/          # API route handlers
│   ├── services/        # Business logic (HumanLayer, Backblaze, Queue, Audit)
│   ├── types/           # TypeScript type definitions
│   ├── utils/           # Utility functions (logger, etc.)
│   └── index.ts         # Application entry point
├── logs/                # Application logs
├── Dockerfile           # Docker configuration
├── package.json         # Dependencies and scripts
└── tsconfig.json        # TypeScript configuration
```

## API Routes

### Health
- `GET /health` - Basic health check
- `GET /health/detailed` - Detailed health with service status

### Agent Tasks
- `POST /api/agent/tasks` - Create agent task
- `GET /api/agent/tasks/:taskId` - Get task status
- `DELETE /api/agent/tasks/:taskId` - Cancel task
- `POST /api/agent/tasks/:taskId/accept` - Accept patch
- `POST /api/agent/tasks/:taskId/reject` - Reject patch
- `GET /api/agent/stats` - Get user statistics

### Projects
- `POST /api/projects/save` - Save project to Backblaze
- `GET /api/projects/:projectId` - Load project from Backblaze
- `GET /api/projects/:projectId/files` - List project files

## Environment Variables

See `env.example` for all required variables.

## Development

```bash
# Watch mode with auto-reload
npm run dev

# Lint code
npm run lint

# Format code
npm run format

# Run tests
npm test
```

## Production

```bash
# Build
npm run build

# Start
npm start
```

## Docker

```bash
# Build image
docker build -t open-frame-backend .

# Run container
docker run -p 3001:3001 --env-file .env open-frame-backend
```

