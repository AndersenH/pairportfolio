#!/bin/bash

# Check and restart development server on port 3000
PORT=3000
URL="http://localhost:$PORT"

echo "Checking if application is running on port $PORT..."

# Check if port is in use
if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null ; then
    echo "✅ Application is already running on port $PORT"
    
    # Verify it's responding
    if curl -s "$URL" > /dev/null; then
        echo "✅ Application is responding correctly"
        exit 0
    else
        echo "⚠️  Port $PORT is occupied but not responding, restarting..."
        lsof -ti:$PORT | xargs kill -9
    fi
else
    echo "❌ No application running on port $PORT, starting..."
fi

# Start the development server
echo "🚀 Starting development server on port $PORT..."
PORT=$PORT npm run dev &

# Wait a moment for startup
sleep 3

# Verify it started successfully
if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null ; then
    echo "✅ Application successfully started on $URL"
else
    echo "❌ Failed to start application on port $PORT"
    exit 1
fi