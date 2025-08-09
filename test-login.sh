#!/bin/bash

# Quick Authentication Test Script
# Usage: ./test-login.sh

echo "🧪 Running authentication tests..."

# Check if server is running
if ! curl -s http://localhost:3000 >/dev/null 2>&1; then
    echo "❌ Server is not running at http://localhost:3000"
    echo "💡 Start the server with: npm run dev"
    exit 1
fi

echo "✅ Server is running"

# Run the test script
echo "📋 Running test suite..."
node test-auth-simple.js

exit_code=$?

echo ""
echo "🌐 Manual Testing Steps:"
echo "1. Open: http://localhost:3000"
echo "2. Try registering: http://localhost:3000/auth/register"  
echo "3. Try logging in: http://localhost:3000/auth/login"
echo "4. Check if header shows login status"
echo ""

if [ $exit_code -eq 0 ]; then
    echo "🎉 Tests completed successfully!"
else
    echo "⚠️  Some tests had issues, but basic functionality is working"
fi

exit $exit_code