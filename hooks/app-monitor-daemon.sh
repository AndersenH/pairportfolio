#!/bin/bash

# Daemon script to continuously monitor and restart the Next.js application
# This runs in the background and checks the app every 30 seconds

PORT=3000
APP_DIR="/Users/halldorandersen/Dropbox/pairportfolio"
LOG_FILE="$APP_DIR/logs/daemon.log"
PID_FILE="$APP_DIR/.monitor-daemon.pid"
CHECK_INTERVAL=30  # Check every 30 seconds

# Ensure logs directory exists
mkdir -p "$APP_DIR/logs"

# Function to log messages
log_message() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

# Function to check if monitor is already running
is_monitor_running() {
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        if ps -p "$PID" > /dev/null 2>&1; then
            return 0
        fi
    fi
    return 1
}

# Function to start monitoring
start_monitoring() {
    if is_monitor_running; then
        echo "Monitor is already running (PID: $(cat $PID_FILE))"
        exit 0
    fi
    
    echo "Starting application monitor daemon..."
    
    # Run the monitoring loop in the background
    (
        trap 'log_message "Monitor daemon stopped"; rm -f $PID_FILE; exit' SIGTERM SIGINT
        
        log_message "=== Monitor Daemon Started (PID: $$) ==="
        echo $$ > "$PID_FILE"
        
        while true; do
            # Run the ensure-app-running script
            "$APP_DIR/hooks/ensure-app-running.sh" > /dev/null 2>&1
            
            # Sleep before next check
            sleep $CHECK_INTERVAL
        done
    ) &
    
    DAEMON_PID=$!
    echo $DAEMON_PID > "$PID_FILE"
    echo "Monitor daemon started (PID: $DAEMON_PID)"
    echo "Check logs at: $LOG_FILE"
}

# Function to stop monitoring
stop_monitoring() {
    if ! is_monitor_running; then
        echo "Monitor is not running"
        exit 0
    fi
    
    PID=$(cat "$PID_FILE")
    echo "Stopping monitor daemon (PID: $PID)..."
    kill "$PID" 2>/dev/null
    rm -f "$PID_FILE"
    echo "Monitor daemon stopped"
}

# Function to show status
show_status() {
    if is_monitor_running; then
        PID=$(cat "$PID_FILE")
        echo "✅ Monitor daemon is running (PID: $PID)"
        
        # Check app status
        if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
            APP_PID=$(lsof -Pi :$PORT -sTCP:LISTEN -t 2>/dev/null | head -1)
            echo "✅ Next.js app is running on port $PORT (PID: $APP_PID)"
        else
            echo "❌ Next.js app is not running on port $PORT"
        fi
        
        # Show recent log entries
        echo ""
        echo "Recent monitor activity:"
        tail -5 "$LOG_FILE" 2>/dev/null | sed 's/^/  /'
    else
        echo "❌ Monitor daemon is not running"
        echo "Start it with: $0 start"
    fi
}

# Main command handling
case "$1" in
    start)
        start_monitoring
        ;;
    stop)
        stop_monitoring
        ;;
    restart)
        stop_monitoring
        sleep 2
        start_monitoring
        ;;
    status)
        show_status
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|status}"
        echo ""
        echo "This daemon monitors the Next.js application and automatically"
        echo "restarts it if it crashes or becomes unresponsive."
        echo ""
        echo "Commands:"
        echo "  start   - Start the monitor daemon"
        echo "  stop    - Stop the monitor daemon"
        echo "  restart - Restart the monitor daemon"
        echo "  status  - Show current status"
        exit 1
        ;;
esac