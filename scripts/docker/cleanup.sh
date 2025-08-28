#!/bin/bash

# Docker Cleanup Script for PairPortfolio ETF Backtesting Application
# This script cleans up Docker resources and data

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

echo "🧹 PairPortfolio Docker Cleanup"
echo "This script will stop and remove Docker containers, images, and volumes."
echo ""

# Get cleanup level from argument or prompt user
CLEANUP_LEVEL=${1:-""}

if [ -z "$CLEANUP_LEVEL" ]; then
    echo "Select cleanup level:"
    echo "1) Soft cleanup (stop containers only)"
    echo "2) Medium cleanup (remove containers and networks)"
    echo "3) Hard cleanup (remove everything including volumes and images)"
    echo ""
    read -p "Enter your choice (1-3): " CLEANUP_LEVEL
fi

case $CLEANUP_LEVEL in
    1|soft)
        print_status "Performing soft cleanup - stopping containers only..."
        docker-compose down
        print_success "Containers stopped"
        ;;
    
    2|medium)
        print_status "Performing medium cleanup - removing containers and networks..."
        docker-compose down --remove-orphans
        docker network prune -f
        print_success "Containers and networks removed"
        ;;
        
    3|hard)
        print_warning "Performing hard cleanup - this will remove ALL data!"
        read -p "Are you sure? This will delete all database data and cached files. (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            print_status "Stopping and removing all containers..."
            docker-compose down --volumes --remove-orphans
            
            print_status "Removing Docker images..."
            docker image rm pairportfolio-app 2>/dev/null || true
            docker image rm $(docker images -q --filter "reference=pairportfolio*") 2>/dev/null || true
            
            print_status "Removing Docker volumes..."
            docker volume rm pairportfolio_postgres_data 2>/dev/null || true
            docker volume rm pairportfolio_redis_data 2>/dev/null || true
            
            print_status "Cleaning up unused resources..."
            docker system prune -f
            docker volume prune -f
            
            print_success "Hard cleanup completed - all data removed"
        else
            print_status "Hard cleanup cancelled"
        fi
        ;;
        
    *)
        print_error "Invalid cleanup level. Use 1 (soft), 2 (medium), or 3 (hard)"
        exit 1
        ;;
esac

# Show remaining Docker resources
echo ""
print_status "Remaining Docker resources:"
echo ""

if [ "$(docker ps -aq -f name=pairportfolio)" ]; then
    echo "🐳 Containers:"
    docker ps -a -f name=pairportfolio --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
else
    echo "🐳 No PairPortfolio containers found"
fi

echo ""

if [ "$(docker images -q --filter 'reference=pairportfolio*')" ]; then
    echo "📦 Images:"
    docker images --filter "reference=pairportfolio*" --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}"
else
    echo "📦 No PairPortfolio images found"
fi

echo ""

if [ "$(docker volume ls -q -f name=pairportfolio)" ]; then
    echo "💾 Volumes:"
    docker volume ls -f name=pairportfolio --format "table {{.Name}}\t{{.Driver}}"
else
    echo "💾 No PairPortfolio volumes found"
fi

echo ""
print_success "Cleanup completed!"

if [ "$CLEANUP_LEVEL" = "3" ] || [ "$CLEANUP_LEVEL" = "hard" ]; then
    echo ""
    print_status "To start fresh, run: ./scripts/docker/setup.sh"
fi