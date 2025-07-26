#!/bin/bash

echo "Setting up Python Backtest Engine..."

# Create Python virtual environment
echo "Creating Python virtual environment..."
python3 -m venv python/venv

# Activate virtual environment
source python/venv/bin/activate

# Install dependencies
echo "Installing Python dependencies..."
pip install -r python/requirements.txt

# Check if Redis is installed
if ! command -v redis-server &> /dev/null; then
    echo "Redis is not installed. Please install Redis:"
    echo "  macOS: brew install redis"
    echo "  Ubuntu: sudo apt-get install redis-server"
    echo "  Then run: redis-server"
else
    echo "Redis is installed ✓"
fi

# Make scripts executable
chmod +x python/backtest_runner.py
chmod +x python/api_server.py

echo ""
echo "Setup complete! 🎉"
echo ""
echo "To use the Python backtest engine:"
echo ""
echo "Option 1: Child Process (Simple)"
echo "  - Already configured, just run your Next.js app"
echo "  - Test: curl -X POST http://localhost:3000/api/python-backtest -H 'Content-Type: application/json' -d '{...}'"
echo ""
echo "Option 2: Python API Server (Production)"
echo "  1. Start Redis: redis-server"
echo "  2. Start Python API: python python/api_server.py"
echo "  3. The API will be available at http://localhost:8000"
echo ""
echo "Option 3: Test Python script directly:"
echo "  echo '{\"strategy\":\"buy_hold\",\"holdings\":[{\"symbol\":\"SPY\",\"allocation\":1}],\"start_date\":\"2023-01-01\",\"end_date\":\"2023-12-31\"}' | python3 python/backtest_runner.py"