#!/bin/bash

# 
ROOT_DIR="/home/z/my-project/mini-services"

main() {
    echo "🚀 Install dependencies..."
    
    #  rootdir 
    if [ ! -d "$ROOT_DIR" ]; then
        echo "ℹ️  directory $ROOT_DIR does not exist，Skipping"
        return
    fi
    
    # 
    success_count=0
    fail_count=0
    failed_projects=""
    
    #  mini-services directory
    for dir in "$ROOT_DIR"/*; do
        # directory package.json
        if [ -d "$dir" ] && [ -f "$dir/package.json" ]; then
            project_name=$(basename "$dir")
            echo ""
            echo "📦 Install dependencies: $project_name..."
            
            # directory bun install
            if (cd "$dir" && bun install); then
                echo "✅ $project_name dependency install succeeded"
                success_count=$((success_count + 1))
            else
                echo "❌ $project_name dependency install failed"
                fail_count=$((fail_count + 1))
                if [ -z "$failed_projects" ]; then
                    failed_projects="$project_name"
                else
                    failed_projects="$failed_projects $project_name"
                fi
            fi
        fi
    done
    
    # 
    echo ""
    echo "=================================================="
    if [ $success_count -gt 0 ] || [ $fail_count -gt 0 ]; then
        echo "🎉 Install complete!"
        echo "✅ Succeeded: $success_count "
        if [ $fail_count -gt 0 ]; then
            echo "❌ Failed: $fail_count "
            echo ""
            echo "Failed projects:"
            for project in $failed_projects; do
                echo "  - $project"
            done
        fi
    else
        echo "ℹ️  Found package.json "
    fi
    echo "=================================================="
}

main

