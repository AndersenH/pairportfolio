# Docker Setup Guide for PairPortfolio ETF Backtesting

This guide covers the complete Docker setup for the PairPortfolio ETF backtesting application, migrated from Supabase to a local stack with PostgreSQL, Redis, and NextAuth.js.

## 🐳 Architecture Overview

The Docker setup includes:
- **PostgreSQL 15**: Primary database for user data, portfolios, and backtests
- **Redis 7**: Session storage and caching layer
- **Next.js App**: Main application with NextAuth.js authentication
- **Docker Networking**: Internal communication between services

## 📋 Prerequisites

- Docker Desktop (or Docker Engine + Docker Compose)
- Git
- 8GB+ RAM recommended
- Ports 3001, 5432, 6379 available on localhost

## 🚀 Quick Start

### 1. Setup Environment

```bash
# Clone the repository (if not already done)
git clone <repository-url>
cd pairportfolio

# Copy Docker environment file
cp .env.docker .env.local

# Make setup script executable (Linux/macOS)
chmod +x scripts/docker/setup.sh
```

### 2. Full Setup (Recommended for first run)

```bash
# Run complete setup script
npm run docker:setup

# This script will:
# - Stop any existing containers
# - Pull latest images
# - Build application image
# - Start PostgreSQL and Redis
# - Wait for services to be ready
# - Run database migrations
# - Generate Prisma client
# - Seed database
# - Start the application
```

### 3. Manual Setup (Alternative)

```bash
# Start infrastructure services
docker-compose up -d postgres redis

# Wait for services to be ready
npm run docker:dev health

# Build and start application
docker-compose up -d app

# Check application health
npm run docker:dev health
```

## 🛠️ Development Commands

### Docker Management

```bash
# Start all services
npm run docker:start

# Stop all services
npm run docker:stop

# Restart all services
npm run docker:restart

# View application logs
npm run docker:logs

# View all service logs
npm run docker:dev logs-all

# Open shell in app container
npm run docker:shell

# Open PostgreSQL shell
npm run docker:db-shell

# Open Redis CLI
npm run docker:dev redis-cli
```

### Database Operations

```bash
# Run database migrations
npm run docker:dev migrate

# Seed database
npm run docker:dev seed

# Reset database (⚠️ destructive!)
npm run docker:dev reset-db

# Generate Prisma client
docker-compose exec app npx prisma generate

# View database with Prisma Studio
docker-compose exec app npx prisma studio
```

### Application Development

```bash
# Rebuild application image
npm run docker:dev build

# Check service status
npm run docker:dev status

# Check health of all services
npm run docker:dev health

# Run tests inside container
npm run docker:dev test

# Run linting
npm run docker:dev lint

# TypeScript type checking
npm run docker:dev typecheck
```

## 🌐 Service Access

When running via Docker:

| Service | URL | Description |
|---------|-----|-------------|
| Application | http://localhost:3001 | Main Next.js application |
| PostgreSQL | localhost:5432 | Database (postgres/postgres123) |
| Redis | localhost:6379 | Cache and session storage |
| Health Check | http://localhost:3001/api/health | Service status |

## 📁 Directory Structure

```
pairportfolio/
├── docker-compose.yml          # Main orchestration file
├── Dockerfile                  # Multi-stage app container
├── .dockerignore              # Files excluded from build
├── .env.docker                # Docker environment template
├── .env.docker.test           # Docker test environment
├── docker/
│   └── postgres/
│       └── init.sql           # Database initialization
└── scripts/
    └── docker/
        ├── setup.sh           # Complete setup script
        ├── dev.sh             # Development helper
        └── cleanup.sh         # Cleanup script
```

## 🔧 Configuration

### Environment Files

- `.env.docker` - Template for Docker environment
- `.env.local` - Local development overrides
- `.env.docker.test` - Test environment (Docker internal network)
- `.env.test` - Test environment (host network)

### Key Environment Variables

```bash
# Database
DATABASE_URL="postgresql://postgres:postgres123@postgres:5432/pairportfolio"

# Authentication
NEXTAUTH_URL="http://localhost:3001"
NEXTAUTH_SECRET="your-secret-key"

# Cache
REDIS_URL="redis://redis:6379"

# APIs
FMP_API_KEY="Ejh2emZcJzogsHafpis8ogaXO7nPZDPI"
```

## 🧪 Testing

### E2E Testing with Playwright

The application includes comprehensive E2E tests that work with the Docker setup:

```bash
# Setup test environment
cp .env.docker.test .env.test

# Run E2E tests (requires app to be running)
npm run test:e2e

# Run tests in Docker
docker-compose -f docker-compose.test.yml up --build

# Run specific test files
npm run test:e2e tests/e2e/backtest-creation.spec.ts
```

### Test Configuration

Tests are configured to work with:
- Local PostgreSQL database (separate test schema)
- NextAuth.js authentication
- Real financial data APIs
- Docker networking (internal container communication)

## 🔄 Migration from Supabase

This setup replaces the previous Supabase-based architecture:

| Component | Before (Supabase) | After (Docker) |
|-----------|------------------|----------------|
| Database | Supabase PostgreSQL | Local PostgreSQL 15 |
| Authentication | Supabase Auth | NextAuth.js |
| Session Storage | Supabase | Redis |
| Environment | Cloud | Local Docker |

### Migration Steps Completed

1. ✅ Docker infrastructure setup
2. ✅ PostgreSQL database with initialization
3. ✅ Redis cache and session storage
4. ✅ NextAuth.js authentication migration
5. ✅ Removed Supabase dependencies
6. ✅ Updated test configuration
7. ✅ Environment configuration updates

## 🚨 Troubleshooting

### Common Issues

**Port Conflicts**
```bash
# Check which processes are using ports
lsof -i :3001
lsof -i :5432
lsof -i :6379

# Stop conflicting services
brew services stop postgresql  # macOS
sudo service postgresql stop   # Linux
```

**Database Connection Issues**
```bash
# Check PostgreSQL logs
docker-compose logs postgres

# Verify database is ready
npm run docker:dev health

# Reset database if needed
npm run docker:dev reset-db
```

**Application Won't Start**
```bash
# Check application logs
npm run docker:logs

# Rebuild application image
npm run docker:dev build

# Check disk space
docker system df
docker system prune  # Clean up if needed
```

**Permission Issues (Linux/macOS)**
```bash
# Make scripts executable
chmod +x scripts/docker/*.sh

# Fix Docker permissions
sudo usermod -aG docker $USER
# Then logout and login
```

### Health Checks

```bash
# Comprehensive health check
npm run docker:dev health

# Manual health checks
curl http://localhost:3001/api/health
docker-compose exec postgres pg_isready -U postgres
docker-compose exec redis redis-cli ping
```

## 🧹 Cleanup

### Development Cleanup

```bash
# Soft cleanup (stop containers)
npm run docker:cleanup soft

# Medium cleanup (remove containers/networks)
npm run docker:cleanup medium

# Hard cleanup (remove everything including data)
npm run docker:cleanup hard
```

### Manual Cleanup

```bash
# Stop and remove containers
docker-compose down --volumes

# Remove images
docker image rm pairportfolio-app

# Clean up Docker system
docker system prune -a
docker volume prune
```

## 📊 Monitoring & Logs

### Log Management

```bash
# Follow application logs
npm run docker:logs

# Follow all service logs
docker-compose logs -f

# View specific service logs
docker-compose logs postgres
docker-compose logs redis
```

### Resource Monitoring

```bash
# Check container resource usage
docker stats

# Check service status
npm run docker:dev status

# Disk usage
docker system df
```

## 🔒 Security Considerations

- Default passwords are for development only
- Change secrets in production
- PostgreSQL and Redis are not exposed externally by default
- Use proper environment variable management
- Regularly update base images
- Enable authentication in production Redis

## 🚀 Production Deployment

For production deployment:

1. Use production-optimized Docker images
2. Set up proper secrets management
3. Configure SSL/TLS
4. Set up monitoring and logging
5. Implement backup strategies
6. Use orchestration platforms (Kubernetes, Docker Swarm)

## 📖 Additional Resources

- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [PostgreSQL Docker Image](https://hub.docker.com/_/postgres)
- [Redis Docker Image](https://hub.docker.com/_/redis)
- [Next.js Docker Documentation](https://nextjs.org/docs/deployment#docker-image)
- [NextAuth.js Documentation](https://next-auth.js.org/)

This Docker setup provides a complete, self-contained development environment that's consistent across different machines and operating systems.