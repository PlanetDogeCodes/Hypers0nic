#!/bin/bash

# Redirect stderr to stdout to avoid execute_command errors from stderr output
exec 2>&1

set -e

# Get the script directory (.scripts directory, i.e. workspace-agent/.scripts)
# Use $0 to get script path (compatible with sh and bash)
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Next.js project path
NEXTJS_PROJECT_DIR="/home/z/my-project"

# Check if Next.js project directory exists
if [ ! -d "$NEXTJS_PROJECT_DIR" ]; then
    echo "❌ Error: Next.js project directory does not exist: $NEXTJS_PROJECT_DIR"
    exit 1
fi

echo "🚀 Starting Next.js app and mini-services build..."
echo "📁 Next.js project path: $NEXTJS_PROJECT_DIR"

# Switch to Next.js project directory
cd "$NEXTJS_PROJECT_DIR" || exit 1

# Set environment variables
export NEXT_TELEMETRY_DISABLED=1

BUILD_DIR="/tmp/build_fullstack_$BUILD_ID"
echo "📁 Clean and create build directory: $BUILD_DIR"
mkdir -p "$BUILD_DIR"

# Install dependencies
echo "📦 Install dependencies..."
bun install

# Build Next.js app
echo "🔨 Build Next.js app..."
bun run build

# Verify standalone server entry is generated (deployment success guard).
# Next only produces .next/standalone/server.js when next.config contains output:"standalone".
# If user/AI edits the project and removes this config, bun run build still succeeds (static
# output, exit code 0), but standalone is missing - the package has no server.js, deploying to FC
# start.sh cannot find next-service-dist/server.js -> Next not started -> Caddy:81 proxies empty
# 3000 -> FC health check 120s timeout failure (main cause of warmup_412 / FunctionNotStarted).
# Self-heal: only when missing, add output:"standalone" back to next.config and rebuild.
# Normal projects (server.js already generated) skip this entirely, no user files read/written.
if [ ! -f ".next/standalone/server.js" ]; then
    echo "⚠️  Build did not produce .next/standalone/server.js，Starting self-heal of next.config output setting..."
    NEXT_CONFIG_FILE="$(ls next.config.ts next.config.js next.config.mjs next.config.cjs 2>/dev/null | head -1)"

    if [ -z "$NEXT_CONFIG_FILE" ]; then
        echo "❌ Build failed: next.config.* not found, cannot generate standalone deployment artifact."
        exit 1
    fi

    if grep -Eq "output\s*:\s*['\"]standalone['\"]" "$NEXT_CONFIG_FILE"; then
        # Already declared standalone but still no server.js, meaning config is not missing (build may have
        # actually failed, custom distDir, etc.). Do not modify user config, fail directly with reason.
        echo "❌ Build failed:$NEXT_CONFIG_FILE  output:\"standalone\"， .next/standalone/server.js。"
        echo "   Please check build log errors above or custom build configuration."
        exit 1
    fi

    if grep -Eq "output\s*:\s*['\"]" "$NEXT_CONFIG_FILE"; then
        # Already explicitly declared other output (e.g. "export" static export / values other than "standalone").
        # "export" is incompatible with this deployment model (standalone + custom server) - cannot inject a second
        # output to override user intent (JS object duplicate key, injection is ineffective). Explicitly fail.
        echo "❌ Build failed:$NEXT_CONFIG_FILE  standalone  output（ \"export\" ），Current。"
        echo "   Current output:\"standalone\"。 standalone，。"
        exit 1
    fi

    echo "🔧 Detected $NEXT_CONFIG_FILE  output:\"standalone\"，..."
    cp "$NEXT_CONFIG_FILE" "${NEXT_CONFIG_FILE}.zbak"
    # Insert output:"standalone" after the first config object literal opening brace,
    # covering common scaffold patterns: const nextConfig...= {  /  export default {  /  module.exports = {
    perl -0pi -e 's/((?:const\s+\w+[^=]*=|export\s+default|module\.exports\s*=)\s*\{)/$1\n  output: "standalone",/' "$NEXT_CONFIG_FILE"

    if ! grep -Eq "output\s*:\s*['\"]standalone['\"]" "$NEXT_CONFIG_FILE"; then
        echo "❌ ，next.config ， output:\"standalone\"。"
        echo "   Current $NEXT_CONFIG_FILE content:"
        cat "$NEXT_CONFIG_FILE"
        mv "${NEXT_CONFIG_FILE}.zbak" "$NEXT_CONFIG_FILE"
        exit 1
    fi

    echo "🔨  output:\"standalone\"，..."
    bun run build

    if [ ! -f ".next/standalone/server.js" ]; then
        echo "❌  output:\"standalone\" ， .next/standalone/server.js。"
        exit 1
    fi
    echo "✅ Self-heal succeeded: standalone server entry generated."
fi

# Build mini-services
# Check if mini-services directory exists under Next.js project directory
if [ -d "$NEXTJS_PROJECT_DIR/mini-services" ]; then
    echo "🔨 Build mini-services..."
    # Use mini-services scripts from workspace-agent directory
    sh "$SCRIPT_DIR/mini-services-install.sh"
    sh "$SCRIPT_DIR/mini-services-build.sh"

    # Copy mini-services-start.sh to mini-services-dist directory
    echo "  - Copy mini-services-start.sh to $BUILD_DIR"
    cp "$SCRIPT_DIR/mini-services-start.sh" "$BUILD_DIR/mini-services-start.sh"
    chmod +x "$BUILD_DIR/mini-services-start.sh"
else
    echo "ℹ️  mini-services directory does not exist, skipping"
fi

# directory
echo "📦 Collecting build artifacts to $BUILD_DIR..."

#  Next.js standalone 
if [ -d ".next/standalone" ]; then
    echo "  - Copy .next/standalone"
    cp -r .next/standalone "$BUILD_DIR/next-service-dist/"
fi

#  Next.js 
if [ -d ".next/static" ]; then
    echo "  - Copy .next/static"
    mkdir -p "$BUILD_DIR/next-service-dist/.next"
    cp -r .next/static "$BUILD_DIR/next-service-dist/.next/"
fi

# Copy public directory
if [ -d "public" ]; then
    echo "  - Copy public"
    cp -r public "$BUILD_DIR/next-service-dist/"
fi

# Python  workspace-agent  /home/z/.venv。 Python 
# ，， Python 。
PROJECT_DIR="$NEXTJS_PROJECT_DIR" BUILD_DIR="$BUILD_DIR" \
    bash "$SCRIPT_DIR/python-runtime-build.sh"

#  Preview ；。
#  db/custom.db， dev.sh  Deploy 。
PROJECT_DIR="$NEXTJS_PROJECT_DIR" BUILD_DIR="$BUILD_DIR" \
    bash "$SCRIPT_DIR/database-runtime-build.sh"

# Copy Caddyfile（）
if [ -f "Caddyfile" ]; then
    echo "  - Copy Caddyfile"
    cp Caddyfile "$BUILD_DIR/"
else
    echo "ℹ️  Caddyfile does not exist, skipping"
fi

#  start.sh 
echo "  - Copy start.sh to $BUILD_DIR"
cp "$SCRIPT_DIR/start.sh" "$BUILD_DIR/start.sh"
chmod +x "$BUILD_DIR/start.sh"

#  $BUILD_DIR.tar.gz
PACKAGE_FILE="${BUILD_DIR}.tar.gz"
echo ""
echo "📦 Package build artifacts to $PACKAGE_FILE..."
cd "$BUILD_DIR" || exit 1
tar -czf "$PACKAGE_FILE" .
cd - > /dev/null || exit 1

# # directory
# rm -rf "$BUILD_DIR"

echo ""
echo "✅ Build complete! All artifacts packaged to $PACKAGE_FILE"
echo "📊 Package file size:"
ls -lh "$PACKAGE_FILE"
