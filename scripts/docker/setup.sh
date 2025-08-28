#!/bin/bash

# Docker Setup Script for PairPortfolio ETF Backtesting Application
# This script sets up the Docker environment and runs initial setup

set -e

echo "🐳 Setting up PairPortfolio Docker environment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Docker and Docker Compose are installed
print_status "Checking Docker installation..."
if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed. Please install Docker first."
    exit 1
fi

if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    print_error "Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

print_success "Docker and Docker Compose are installed"

# Copy environment file if it doesn't exist
if [ ! -f .env.local ]; then
    print_status "Creating .env.local from .env.docker..."
    cp .env.docker .env.local
    print_success ".env.local created"
else
    print_warning ".env.local already exists, skipping copy"
fi

# Stop any running containers
print_status "Stopping any existing containers..."
docker-compose down --remove-orphans 2>/dev/null || true

# Pull latest images
print_status "Pulling latest Docker images..."
docker-compose pull postgres redis

# Build application image
print_status "Building application Docker image..."
docker-compose build app

# Start services
print_status "Starting Docker services..."
docker-compose up -d postgres redis

# Wait for PostgreSQL to be ready
print_status "Waiting for PostgreSQL to be ready..."
timeout=60
count=0
while ! docker-compose exec -T postgres pg_isready -U postgres -d pairportfolio &> /dev/null; do
    if [ $count -ge $timeout ]; then
        print_error "PostgreSQL failed to start within $timeout seconds"
        exit 1
    fi
    sleep 1
    count=$((count + 1))
done

print_success "PostgreSQL is ready"

# Wait for Redis to be ready
print_status "Waiting for Redis to be ready..."
timeout=30
count=0
while ! docker-compose exec -T redis redis-cli ping &> /dev/null; do
    if [ $count -ge $timeout ]; then
        print_error "Redis failed to start within $timeout seconds"
        exit 1
    fi
    sleep 1
    count=$((count + 1))
done

print_success "Redis is ready"

# Run database migrations
print_status "Running Prisma database migrations..."
docker-compose run --rm app npx prisma migrate dev --name initial_migration

# Generate Prisma client
print_status "Generating Prisma client..."
docker-compose run --rm app npx prisma generate

# Seed database (if seed script exists)
if [ -f "prisma/seed.js" ] || [ -f "prisma/seed.ts" ]; then
    print_status "Seeding database..."
    docker-compose run --rm app npm run db:seed
fi

# Start the application
print_status "Starting the application..."
docker-compose up -d app

# Wait for application to be ready
print_status "Waiting for application to be ready..."
timeout=60
count=0
while ! curl -f http://localhost:3001/api/health &> /dev/null; do
    if [ $count -ge $timeout ]; then
        print_error "Application failed to start within $timeout seconds"
        docker-compose logs app
        exit 1
    fi
    sleep 2
    count=$((count + 2))
done

print_success "Application is ready!"

# Print status
echo ""
echo "🎉 PairPortfolio Docker setup completed successfully!"
echo ""
echo "📊 Services running:"
echo "   - Application:  http://localhost:3001"
echo "   - PostgreSQL:   localhost:5432"
echo "   - Redis:        localhost:6379"
echo ""
echo "🛠️  Useful commands:"
echo "   - View logs:           docker-compose logs -f"
echo "   - Stop services:       docker-compose down"
echo "   - Restart app:         docker-compose restart app"
echo "   - Database shell:      docker-compose exec postgres psql -U postgres -d pairportfolio"
echo "   - Redis CLI:           docker-compose exec redis redis-cli"
echo ""
echo "🔍 Check application health: curl http://localhost:3001/api/health"