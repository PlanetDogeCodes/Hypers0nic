#!/bin/sh

# 
DIST_DIR="./mini-services-dist"

#  PID
pids=""

# ：
cleanup() {
    echo ""
    echo "🛑 Shutting down all services..."
    
    #  SIGTERM 
    for pid in $pids; do
        if kill -0 "$pid" 2>/dev/null; then
            service_name=$(ps -p "$pid" -o comm= 2>/dev/null || echo "unknown")
            echo "   Stopping process $pid ($service_name)..."
            kill -TERM "$pid" 2>/dev/null
        fi
    done
    
    # （ 5 ）
    sleep 1
    for pid in $pids; do
        if kill -0 "$pid" 2>/dev/null; then
            # ， 4 
            timeout=4
            while [ $timeout -gt 0 ] && kill -0 "$pid" 2>/dev/null; do
                sleep 1
                timeout=$((timeout - 1))
            done
            # ，
            if kill -0 "$pid" 2>/dev/null; then
                echo "   Stopping process $pid..."
                kill -KILL "$pid" 2>/dev/null
            fi
        fi
    done
    
    echo "✅ All services stopped"
}

main() {
    echo "🚀 Starting all mini services..."
    
    #  dist directory
    if [ ! -d "$DIST_DIR" ]; then
        echo "ℹ️  directory $DIST_DIR does not exist"
        return
    fi
    
    #  mini-service-*.js 
    service_files=""
    for file in "$DIST_DIR"/mini-service-*.js; do
        if [ -f "$file" ]; then
            if [ -z "$service_files" ]; then
                service_files="$file"
            else
                service_files="$service_files $file"
            fi
        fi
    done
    
    # 
    service_count=0
    for file in $service_files; do
        service_count=$((service_count + 1))
    done
    
    if [ $service_count -eq 0 ]; then
        echo "ℹ️  No mini service files found"
        return
    fi
    
    echo "📦 Found $service_count service(s), starting..."
    echo ""
    
    # 
    for file in $service_files; do
        service_name=$(basename "$file" .js | sed 's/mini-service-//')
        echo "▶️  Starting service: $service_name..."
        
        #  bun （）
        bun "$file" &
        pid=$!
        if [ -z "$pids" ]; then
            pids="$pid"
        else
            pids="$pids $pid"
        fi
        
        # 
        sleep 0.5
        if ! kill -0 "$pid" 2>/dev/null; then
            echo "❌ $service_name failed to start"
            #  PID
            pids=$(echo "$pids" | sed "s/\b$pid\b//" | sed 's/  */ /g' | sed 's/^ *//' | sed 's/ *$//')
        else
            echo "✅ $service_name started (PID: $pid)"
        fi
    done
    
    # 
    running_count=0
    for pid in $pids; do
        if kill -0 "$pid" 2>/dev/null; then
            running_count=$((running_count + 1))
        fi
    done
    
    echo ""
    echo "🎉 started！ $running_count service(s) running"
    echo ""
    echo "💡 Press Ctrl+C to stop all services"
    echo ""
    
    # 
    wait
}

main

