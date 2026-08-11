#!/bin/bash

# 
ROOT_DIR="/home/z/my-project/mini-services"
DIST_DIR="/tmp/build_fullstack_$BUILD_ID/mini-services-dist"

main() {
    echo "🚀 Starting batch build..."
    
    #  rootdir 
    if [ ! -d "$ROOT_DIR" ]; then
        echo "ℹ️  directory $ROOT_DIR does not exist，Skipping"
        return
    fi
    
    # directory（does not exist）
    mkdir -p "$DIST_DIR"
    
    # 
    success_count=0
    fail_count=0
    
    #  mini-services directory
    for dir in "$ROOT_DIR"/*; do
        # directory package.json
        if [ -d "$dir" ] && [ -f "$dir/package.json" ]; then
            project_name=$(basename "$dir")
            
            #  ()
            entry_path=""
            for entry in "src/index.ts" "index.ts" "src/index.js" "index.js"; do
                if [ -f "$dir/$entry" ]; then
                    entry_path="$dir/$entry"
                    break
                fi
            done
            
            if [ -z "$entry_path" ]; then
                echo "⚠️  Skipping $project_name: Found (index.ts/js)"
                continue
            fi
            
            echo ""
            echo "📦 Building: $project_name..."
            
            #  bun build CLI 
            output_file="$DIST_DIR/mini-service-$project_name.js"
            
            if bun build "$entry_path" \
                --outfile "$output_file" \
                --target bun \
                --minify; then
                echo "✅ $project_name build succeeded -> $output_file"
                success_count=$((success_count + 1))
            else
                echo "❌ $project_name build failed"
                fail_count=$((fail_count + 1))
            fi
        fi
    done
    
    if [ -f ./.scripts/mini-services-start.sh ]; then
        cp ./.scripts/mini-services-start.sh "$DIST_DIR/mini-services-start.sh"
        chmod +x "$DIST_DIR/mini-services-start.sh"
    fi
    
    echo ""
    echo "🎉 All tasks complete!"
    if [ $success_count -gt 0 ] || [ $fail_count -gt 0 ]; then
        echo "✅ Succeeded: $success_count "
        if [ $fail_count -gt 0 ]; then
            echo "❌ Failed: $fail_count "
        fi
    fi
}

main

