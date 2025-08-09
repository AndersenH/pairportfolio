#!/bin/bash

# ETF Portfolio E2E Test Setup Script
# This script sets up the complete testing environment

set -e  # Exit on any error

echo "<� Setting up Playwright E2E Testing Environment..."

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

# Check if Node.js is installed
check_node() {
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed. Please install Node.js 18+ first."
        exit 1
    fi
    
    NODE_VERSION=$(node -v | sed 's/v//')
    MAJOR_VERSION=$(echo $NODE_VERSION | cut -d. -f1)
    
    if [ "$MAJOR_VERSION" -lt 18 ]; then
        print_error "Node.js version $NODE_VERSION is not supported. Please use Node.js 18+ for this project."
        exit 1
    fi
    
    print_success "Node.js $NODE_VERSION detected"
}

# Check if npm is available
check_npm() {
    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed. Please install npm first."
        exit 1
    fi
    print_success "npm is available"
}

# Install dependencies
install_dependencies() {
    print_status "Installing project dependencies..."
    if npm ci; then
        print_success "Dependencies installed successfully"
    else
        print_error "Failed to install dependencies"
        exit 1
    fi
}

# Install Playwright browsers
install_browsers() {
    print_status "Installing Playwright browsers..."
    if npx playwright install; then
        print_success "Playwright browsers installed successfully"
    else
        print_error "Failed to install Playwright browsers"
        exit 1
    fi
    
    # Install system dependencies for browsers
    print_status "Installing system dependencies for browsers..."
    if npx playwright install-deps; then
        print_success "System dependencies installed successfully"
    else
        print_warning "Failed to install system dependencies (may not be supported on this OS)"
    fi
}

# Setup test environment file
setup_test_env() {
    print_status "Setting up test environment configuration..."
    
    if [ ! -f ".env.test" ]; then
        print_error ".env.test file not found. Please ensure it exists."
        exit 1
    fi
    
    # Copy test environment for local testing
    if [ ! -f ".env.local" ]; then
        cp .env.test .env.local
        print_success "Created .env.local from .env.test"
    else
        print_warning ".env.local already exists. You may want to review test configuration."
    fi
}

# Verify environment variables
verify_env_vars() {
    print_status "Verifying required environment variables..."
    
    # Source the test environment
    if [ -f ".env.test" ]; then
        set -o allexport
        source .env.test
        set +o allexport
    fi
    
    REQUIRED_VARS=(
        "NEXT_PUBLIC_SUPABASE_URL"
        "NEXT_PUBLIC_SUPABASE_ANON_KEY"
        "SUPABASE_SERVICE_KEY"
        "FMP_API_KEY"
    )
    
    MISSING_VARS=()
    
    for var in "${REQUIRED_VARS[@]}"; do
        if [ -z "${!var}" ]; then
            MISSING_VARS+=("$var")
        fi
    done
    
    if [ ${#MISSING_VARS[@]} -ne 0 ]; then
        print_error "Missing required environment variables:"
        for var in "${MISSING_VARS[@]}"; do
            echo "  - $var"
        done
        print_warning "Please update your .env.test file with the correct values."
        exit 1
    fi
    
    print_success "All required environment variables are set"
}

# Test Playwright installation
test_playwright() {
    print_status "Testing Playwright installation..."
    
    if npx playwright --version > /dev/null 2>&1; then
        VERSION=$(npx playwright --version)
        print_success "Playwright is working: $VERSION"
    else
        print_error "Playwright installation test failed"
        exit 1
    fi
}

# Create test data directory if it doesn't exist
setup_test_data() {
    print_status "Setting up test data directories..."
    
    # Ensure test results directory exists
    mkdir -p test-results/html-report
    mkdir -p test-results/artifacts
    
    print_success "Test directories created"
}

# Validate test files exist
validate_test_files() {
    print_status "Validating test file structure..."
    
    REQUIRED_FILES=(
        "playwright.config.ts"
        "tests/e2e/global-setup.ts"
        "tests/e2e/global-teardown.ts"
        "tests/e2e/smoke.spec.ts"
        "tests/e2e/auth.spec.ts"
        "tests/e2e/fixtures/test-data.ts"
    )
    
    MISSING_FILES=()
    
    for file in "${REQUIRED_FILES[@]}"; do
        if [ ! -f "$file" ]; then
            MISSING_FILES+=("$file")
        fi
    done
    
    if [ ${#MISSING_FILES[@]} -ne 0 ]; then
        print_error "Missing required test files:"
        for file in "${MISSING_FILES[@]}"; do
            echo "  - $file"
        done
        exit 1
    fi
    
    print_success "All required test files are present"
}

# Run a quick health check
health_check() {
    print_status "Running health check..."
    
    # Test that we can list available tests
    if npx playwright test --list > /dev/null 2>&1; then
        TEST_COUNT=$(npx playwright test --list 2>/dev/null | grep -c ":")
        print_success "Found $TEST_COUNT test cases"
    else
        print_error "Failed to list test cases"
        exit 1
    fi
}

# Provide usage instructions
show_usage() {
    echo
    echo "<� Test Setup Complete!"
    echo
    echo "Available test commands:"
    echo "  npm run test:e2e              # Run all E2E tests"
    echo "  npm run test:e2e:headed       # Run tests with browser UI"
    echo "  npm run test:e2e:debug        # Run tests in debug mode"
    echo "  npm run test:e2e:smoke        # Run only smoke tests (@smoke)"
    echo "  npm run test:e2e:chrome       # Run tests in Chrome only"
    echo "  npm run test:e2e:mobile       # Run mobile tests"
    echo "  npm run test:e2e:ui           # Open Playwright UI"
    echo "  npm run test:e2e:report       # View last test report"
    echo
    echo "Test configuration:"
    echo "  " Tests run on http://localhost:3000 by default"
    echo "  " Make sure your app is running before running tests"
    echo "  " Use .env.test for test-specific configuration"
    echo "  " Test results are saved in test-results/"
    echo
    echo "Quick start:"
    echo "  1. Start your app: npm run dev"
    echo "  2. Run smoke tests: npm run test:e2e:smoke"
    echo
}

# Main execution
main() {
    echo "=� ETF Portfolio E2E Test Setup"
    echo "==============================="
    echo
    
    check_node
    check_npm
    install_dependencies
    install_browsers
    setup_test_env
    verify_env_vars
    test_playwright
    setup_test_data
    validate_test_files
    health_check
    
    print_success "Test environment setup completed successfully!"
    show_usage
}

# Handle script arguments
case "${1:-}" in
    --help|-h)
        echo "Usage: $0 [options]"
        echo
        echo "Options:"
        echo "  --help, -h     Show this help message"
        echo "  --quick, -q    Quick setup (skip browser installation)"
        echo "  --verify, -v   Verify setup only"
        echo
        exit 0
        ;;
    --quick|-q)
        print_status "Running quick setup (skipping browser installation)..."
        check_node
        check_npm
        install_dependencies
        setup_test_env
        verify_env_vars
        test_playwright
        setup_test_data
        validate_test_files
        print_success "Quick setup completed!"
        ;;
    --verify|-v)
        print_status "Verifying test setup..."
        check_node
        check_npm
        verify_env_vars
        test_playwright
        validate_test_files
        health_check
        print_success "Test setup verification completed!"
        ;;
    *)
        main
        ;;
esac