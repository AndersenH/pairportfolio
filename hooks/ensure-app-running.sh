#!/bin/bash

# Hook to ensure the Next.js application is always running on port 3000
# This script checks if the app is running and restarts it if necessary

PORT=3000
APP_DIR="/Users/halldorandersen/Dropbox/pairportfolio"
LOG_FILE="$APP_DIR/logs/app-monitor.log"
PID_FILE="$APP_DIR/.next-app.pid"

# Create logs directory if it doesn't exist
mkdir -p "$APP_DIR/logs"

# Function to log messages with timestamp
log_message() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

# Function to check if app is running
is_app_running() {
    if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

# Function to get the PID of the app
get_app_pid() {
    lsof -Pi :$PORT -sTCP:LISTEN -t 2>/dev/null | head -1
}

# Function to start the application
start_app() {
    log_message "Starting Next.js application on port $PORT..."
    
    cd "$APP_DIR" || exit 1
    
    # Kill any orphaned processes first
    if [ -f "$PID_FILE" ]; then
        OLD_PID=$(cat "$PID_FILE")
        if ps -p "$OLD_PID" > /dev/null 2>&1; then
            log_message "Killing orphaned process $OLD_PID"
            kill -9 "$OLD_PID" 2>/dev/null
        fi
        rm -f "$PID_FILE"
    fi
    
    # Start the application in the background
    export PORT=$PORT
    nohup npm run dev > "$APP_DIR/logs/app.log" 2>&1 &
    NEW_PID=$!
    
    # Save the PID
    echo $NEW_PID > "$PID_FILE"
    
    # Wait a bit for the app to start
    sleep 10
    
    # Check if it started successfully
    if is_app_running; then
        ACTUAL_PID=$(get_app_pid)
        log_message "✅ Application started successfully (PID: $ACTUAL_PID)"
        return 0
    else
        log_message "❌ Failed to start application"
        return 1
    fi
}

# Function to restart the application
restart_app() {
    log_message "Restarting application..."
    
    # Kill existing process
    if is_app_running; then
        PID=$(get_app_pid)
        log_message "Stopping existing process (PID: $PID)"
        kill -9 "$PID" 2>/dev/null
        sleep 3
    fi
    
    # Start the app
    start_app
}

# Main monitoring logic
main() {
    log_message "=== Application Monitor Started ==="
    
    if is_app_running; then
        PID=$(get_app_pid)
        log_message "✅ Application is running (PID: $PID)"
        
        # Check if the app is responsive by making a simple request
        if curl -f -s --connect-timeout 5 "http://localhost:$PORT/" > /dev/null 2>&1; then
            log_message "✅ Application is responsive (homepage accessible)"
        else
            log_message "⚠️  Application is not responsive, attempting restart..."
            restart_app
        fi
    else
        log_message "❌ Application is not running, starting it now..."
        start_app
    fi
    
    log_message "=== Monitor Check Complete ==="
    echo "" >> "$LOG_FILE"  # Add blank line for readability
}

# Execute main function
main

# Exit with appropriate status
if is_app_running; then
    exit 0
else
    exit 1
fi