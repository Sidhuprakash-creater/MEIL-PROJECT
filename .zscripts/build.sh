#!/bin/bash

# Redirect stderr to stdout to prevent execute_command from failing on stderr output
exec 2>&1

set -e

# Get script directory (.zscripts)
# Use $0 to get script path (compatible with sh and bash)
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Next.js project path
NEXTJS_PROJECT_DIR="/home/z/my-project"

# Check if Next.js project directory exists
if [ ! -d "$NEXTJS_PROJECT_DIR" ]; then
    echo "❌ Error: Next.js project directory does not exist: $NEXTJS_PROJECT_DIR"
    exit 1
fi

echo "🚀 Starting build of Next.js app and mini-services..."
echo "📁 Next.js project path: $NEXTJS_PROJECT_DIR"

# Change to Next.js project directory
cd "$NEXTJS_PROJECT_DIR" || exit 1

# Set environment variables
export NEXT_TELEMETRY_DISABLED=1

BUILD_DIR="/tmp/build_fullstack_$BUILD_ID"
echo "📁 Creating build directory: $BUILD_DIR"
mkdir -p "$BUILD_DIR"

# Install dependencies
echo "📦 Installing dependencies..."
bun install

# Build Next.js application
echo "🔨 Building Next.js application..."
bun run build

# Validate whether standalone server entry is generated (deployment guard).
# Next only produces .next/standalone/server.js when next.config contains output: "standalone".
# If edited/removed, bun run build may still exit 0, but standalone will be missing.
# Here we perform self-healing: only when missing, inject output: "standalone" into next.config and rebuild.
# Normal projects (server.js already generated) skip this block completely.
if [ ! -f ".next/standalone/server.js" ]; then
    echo "⚠️  Build did not produce .next/standalone/server.js, self-healing output configuration in next.config..."
    NEXT_CONFIG_FILE="$(ls next.config.ts next.config.js next.config.mjs next.config.cjs 2>/dev/null | head -1)"

    if [ -z "$NEXT_CONFIG_FILE" ]; then
        echo "❌ Build failed: next.config.* not found, unable to generate standalone deployment artifact."
        exit 1
    fi

    if grep -Eq "output\s*:\s*['\"]standalone['\"]" "$NEXT_CONFIG_FILE"; then
        # Standalone was declared but server.js was still not produced.
        echo "❌ Build failed: $NEXT_CONFIG_FILE contains output:\"standalone\", but .next/standalone/server.js was not generated."
        echo "   Please check errors in build log above or custom project build configuration."
        exit 1
    fi

    if grep -Eq "output\s*:\s*['\"]" "$NEXT_CONFIG_FILE"; then
        # Non-standalone output explicitly declared (e.g. static export). Incompatible with standalone server model.
        echo "❌ Build failed: $NEXT_CONFIG_FILE declared non-standalone output, which is incompatible with current deployment model."
        echo "   Deployment requires output:\"standalone\". Please update next.config."
        exit 1
    fi

    echo "🔧 Detected $NEXT_CONFIG_FILE missing output:\"standalone\", auto-injecting and rebuilding..."
    cp "$NEXT_CONFIG_FILE" "${NEXT_CONFIG_FILE}.zbak"
    # Insert output:"standalone" after opening { of config object
    perl -0pi -e 's/((?:const\s+\w+[^=]*=|export\s+default|module\.exports\s*=)\s*\{)/$1\n  output: "standalone",/' "$NEXT_CONFIG_FILE"

    if ! grep -Eq "output\s*:\s*['\"]standalone['\"]" "$NEXT_CONFIG_FILE"; then
        echo "❌ Could not match configurable object in next.config; manual addition of output:\"standalone\" required."
        echo "   Current contents of $NEXT_CONFIG_FILE:"
        cat "$NEXT_CONFIG_FILE"
        mv "${NEXT_CONFIG_FILE}.zbak" "$NEXT_CONFIG_FILE"
        exit 1
    fi

    echo "🔨 Injected output:\"standalone\", rebuilding..."
    bun run build

    if [ ! -f ".next/standalone/server.js" ]; then
        echo "❌ Rebuild with output:\"standalone\" still failed to generate .next/standalone/server.js."
        exit 1
    fi
    echo "✅ Self-healing succeeded: standalone server entry generated."
fi

# Build mini-services
# Check if mini-services directory exists under Next.js project
if [ -d "$NEXTJS_PROJECT_DIR/mini-services" ]; then
    echo "🔨 Building mini-services..."
    # Use mini-services scripts from .zscripts directory
    sh "$SCRIPT_DIR/mini-services-install.sh"
    sh "$SCRIPT_DIR/mini-services-build.sh"

    # Copy mini-services-start.sh to build directory
    echo "  - Copying mini-services-start.sh to $BUILD_DIR"
    cp "$SCRIPT_DIR/mini-services-start.sh" "$BUILD_DIR/mini-services-start.sh"
    chmod +x "$BUILD_DIR/mini-services-start.sh"
else
    echo "ℹ️  mini-services directory does not exist, skipping"
fi

# Collect all build artifacts into temporary build directory
echo "📦 Collecting build artifacts into $BUILD_DIR..."

# Copy Next.js standalone build output
if [ -d ".next/standalone" ]; then
    echo "  - Copying .next/standalone"
    cp -r .next/standalone "$BUILD_DIR/next-service-dist/"
fi

# Copy Next.js static files
if [ -d ".next/static" ]; then
    echo "  - Copying .next/static"
    mkdir -p "$BUILD_DIR/next-service-dist/.next"
    cp -r .next/static "$BUILD_DIR/next-service-dist/.next/"
fi

# Copy public directory
if [ -d "public" ]; then
    echo "  - Copying public"
    cp -r public "$BUILD_DIR/next-service-dist/"
fi

# Python does not inherit /home/z/.venv. If project contains Python sources or manifests, freeze production dependencies into artifacts.
PROJECT_DIR="$NEXTJS_PROJECT_DIR" BUILD_DIR="$BUILD_DIR" \
    bash "$SCRIPT_DIR/python-runtime-build.sh"

# Copy existing Preview database if present; otherwise initialize an empty db in deployment output.
PROJECT_DIR="$NEXTJS_PROJECT_DIR" BUILD_DIR="$BUILD_DIR" \
    bash "$SCRIPT_DIR/database-runtime-build.sh"

# Copy Caddyfile (if present)
if [ -f "Caddyfile" ]; then
    echo "  - Copying Caddyfile"
    cp Caddyfile "$BUILD_DIR/"
else
    echo "ℹ️  Caddyfile does not exist, skipping"
fi

# Copy start.sh script
echo "  - Copying start.sh to $BUILD_DIR"
cp "$SCRIPT_DIR/start.sh" "$BUILD_DIR/start.sh"
chmod +x "$BUILD_DIR/start.sh"

# Package into $BUILD_DIR.tar.gz
PACKAGE_FILE="${BUILD_DIR}.tar.gz"
echo ""
echo "📦 Packaging build artifacts into $PACKAGE_FILE..."
cd "$BUILD_DIR" || exit 1
tar -czf "$PACKAGE_FILE" .
cd - > /dev/null || exit 1

# # Clean temporary directory
# rm -rf "$BUILD_DIR"

echo ""
echo "✅ Build completed! All artifacts packaged into $PACKAGE_FILE"
echo "📊 Package file size:"
ls -lh "$PACKAGE_FILE"
