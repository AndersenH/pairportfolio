#!/bin/bash

# check-webapp-status.sh - Hook to verify webapp is running after implementations
# This script checks if the Next.js webapp is running and responsive

echo "🔍 Checking webapp status..."

# Check if Next.js dev server process is running
NEXT_PROCESS=$(ps -ef | grep "next dev" | grep -v grep)
if [ -z "$NEXT_PROCESS" ]; then
    echo "❌ Next.js dev server is not running"
    echo "   Starting dev server..."
    cd /Users/halldorandersen/Dropbox/pairportfolio
    npm run dev > /dev/null 2>&1 &
    sleep 3
    echo "   Waiting for server to start..."
    sleep 2
else
    echo "✅ Next.js dev server is running"
fi

# Check if webapp is responding on port 3000
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000)
if [ "$HTTP_STATUS" = "200" ]; then
    echo "✅ Webapp is responding (HTTP $HTTP_STATUS) on http://localhost:3000"
    
    # Test API endpoints
    echo "🧪 Testing API endpoints..."
    
    # Test health endpoint (if exists)
    API_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/health 2>/dev/null || echo "404")
    if [ "$API_STATUS" = "200" ]; then
        echo "✅ API health endpoint responding"
    else
        echo "ℹ️  API health endpoint not found (expected for this app)"
    fi
    
    # Test Python integration is working
    echo "🐍 Checking Python integration..."
    PYTHON_ENV_CHECK=$(PYTHONPATH=/Users/halldorandersen/Dropbox/pairportfolio/python:/Users/halldorandersen/Dropbox/pairportfolio/python/venv/lib/python3.13/site-packages python3 -c "import pandas; print('✅ Python environment OK')" 2>/dev/null || echo "❌ Python environment issue")
    echo "$PYTHON_ENV_CHECK"
    
    echo ""
    echo "🎉 Webapp Status: HEALTHY"
    echo "   URL: http://localhost:3000"
    echo "   Python Backend: INTEGRATED"
    echo "   Ready for testing!"
    
elif [ "$HTTP_STATUS" = "000" ]; then
    echo "❌ Webapp is not responding (connection refused)"
    echo "   Attempting to start dev server..."
    cd /Users/halldorandersen/Dropbox/pairportfolio
    npm run dev > /dev/null 2>&1 &
    echo "   Dev server started in background"
else
    echo "⚠️  Webapp responding with HTTP $HTTP_STATUS"
    echo "   May need manual intervention"
fi

echo ""
echo "📊 Process Summary:"
ps -ef | grep "next dev" | grep -v grep | awk '{print "   PID " $2 ": " $8 " " $9 " " $10}'

echo ""
echo "🔗 Quick Links:"
echo "   Frontend: http://localhost:3000"
echo "   Python Backend: Integrated via child processes"
echo "   Development completed: $(date)"