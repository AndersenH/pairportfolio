#!/bin/bash

# Docker Development Helper Script for PairPortfolio ETF Backtesting Application
# This script provides common development tasks

set -e

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

# Function to show usage
show_usage() {
    echo "🛠️  PairPortfolio Docker Development Helper"
    echo ""
    echo "Usage: $0 [command]"
    echo ""
    echo "Commands:"
    echo "  start          Start all services"
    echo "  stop           Stop all services"
    echo "  restart        Restart all services"
    echo "  logs           Show application logs"
    echo "  logs-all       Show all service logs"
    echo "  shell          Open shell in app container"
    echo "  db-shell       Open PostgreSQL shell"
    echo "  redis-cli      Open Redis CLI"
    echo "  migrate        Run database migrations"
    echo "  seed           Seed the database"
    echo "  reset-db       Reset database (destructive!)"
    echo "  build          Rebuild application image"
    echo "  status         Show service status"
    echo "  health         Check application health"
    echo "  test           Run tests in container"
    echo "  lint           Run linting in container"
    echo "  typecheck      Run TypeScript type checking"
    echo ""
}

# Get command from argument
COMMAND=${1:-""}

if [ -z "$COMMAND" ]; then
    show_usage
    exit 0
fi

case $COMMAND in
    start)
        print_status "Starting all services..."
        docker-compose up -d
        print_success "Services started"
        
        print_status "Waiting for services to be ready..."
        sleep 5
        
        # Check health
        if curl -f http://localhost:3001/api/health &> /dev/null; then
            print_success "Application is healthy: http://localhost:3001"
        else
            print_warning "Application may still be starting up"
        fi
        ;;
        
    stop)
        print_status "Stopping all services..."
        docker-compose down
        print_success "Services stopped"
        ;;
        
    restart)
        print_status "Restarting all services..."
        docker-compose restart
        print_success "Services restarted"
        ;;
        
    logs)
        print_status "Showing application logs (Ctrl+C to exit)..."
        docker-compose logs -f app
        ;;
        
    logs-all)
        print_status "Showing all service logs (Ctrl+C to exit)..."
        docker-compose logs -f
        ;;
        
    shell)
        print_status "Opening shell in application container..."
        docker-compose exec app sh
        ;;
        
    db-shell)
        print_status "Opening PostgreSQL shell..."
        docker-compose exec postgres psql -U postgres -d pairportfolio
        ;;
        
    redis-cli)
        print_status "Opening Redis CLI..."
        docker-compose exec redis redis-cli
        ;;
        
    migrate)
        print_status "Running database migrations..."
        docker-compose exec app npx prisma migrate dev
        print_success "Migrations completed"
        ;;
        
    seed)
        print_status "Seeding database..."
        docker-compose exec app npm run db:seed
        print_success "Database seeded"
        ;;
        
    reset-db)
        print_warning "This will reset the database and lose all data!"
        read -p "Are you sure? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            print_status "Resetting database..."
            docker-compose exec app npx prisma migrate reset --force
            print_success "Database reset"
        else
            print_status "Database reset cancelled"
        fi
        ;;
        
    build)
        print_status "Rebuilding application image..."
        docker-compose build --no-cache app
        print_success "Image rebuilt"
        ;;
        
    status)
        print_status "Service status:"
        echo ""
        docker-compose ps
        echo ""
        
        print_status "Resource usage:"
        docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}"
        ;;
        
    health)
        print_status "Checking application health..."
        
        # Check PostgreSQL
        if docker-compose exec -T postgres pg_isready -U postgres -d pairportfolio &> /dev/null; then
            print_success "PostgreSQL: Healthy"
        else
            print_error "PostgreSQL: Unhealthy"
        fi
        
        # Check Redis
        if docker-compose exec -T redis redis-cli ping &> /dev/null; then
            print_success "Redis: Healthy"
        else
            print_error "Redis: Unhealthy"
        fi
        
        # Check Application
        if curl -f http://localhost:3001/api/health &> /dev/null; then
            print_success "Application: Healthy (http://localhost:3001)"
        else
            print_error "Application: Unhealthy"
        fi
        ;;
        
    test)
        print_status "Running tests..."
        docker-compose exec app npm run test
        ;;
        
    lint)
        print_status "Running linter..."
        docker-compose exec app npm run lint
        ;;
        
    typecheck)
        print_status "Running TypeScript type checking..."
        docker-compose exec app npm run type-check
        ;;
        
    *)
        print_error "Unknown command: $COMMAND"
        echo ""
        show_usage
        exit 1
        ;;
esac