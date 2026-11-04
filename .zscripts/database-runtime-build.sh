#!/bin/bash

set -euo pipefail

PROJECT_DIR="${PROJECT_DIR:-/home/z/my-project}"
BUILD_DIR="${BUILD_DIR:?BUILD_DIR is required}"
SOURCE_DB_DIR="$PROJECT_DIR/db"
SOURCE_DB_PATH="$SOURCE_DB_DIR/custom.db"
TARGET_DB_DIR="$BUILD_DIR/db"
TARGET_DB_PATH="$TARGET_DB_DIR/custom.db"

mkdir -p "$TARGET_DB_DIR"

if [ -f "$SOURCE_DB_PATH" ]; then
    echo "🗄️  Copying Preview database to build artifacts..."
    cp -a "$SOURCE_DB_DIR/." "$TARGET_DB_DIR/"
else
    echo "ℹ️  Preview database db/custom.db not found, initializing empty production database"
fi

echo "🗄️  Syncing database schema in build artifacts..."
(
    cd "$PROJECT_DIR"
    DATABASE_URL="file:$TARGET_DB_PATH" bun run db:push
)

if [ ! -f "$TARGET_DB_PATH" ]; then
    echo "❌ Database initialization command succeeded, but $TARGET_DB_PATH was not generated"
    exit 1
fi

echo "✅ Build artifact database is ready"
ls -lah "$TARGET_DB_DIR"
