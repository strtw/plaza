#!/bin/bash

# Test migration script
# This runs migrations against the local Docker database

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$BACKEND_DIR"

# Set local database URL
export DATABASE_URL="postgresql://plaza_user:plaza_dev_password@localhost:5432/plaza_dev?schema=public"

echo "🧪 Testing migrations against local database..."
echo "📦 Database: $DATABASE_URL"
echo ""

# Check if database is running
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
if ! docker compose -f "$PROJECT_ROOT/docker-compose.yml" ps postgres | grep -q "Up"; then
  echo "❌ Database is not running. Start it with: ./scripts/docker-db.sh start"
  exit 1
fi

# Generate Prisma client
echo "📦 Generating Prisma client..."
npx prisma generate

# Run migrations
echo "🔄 Running migrations..."
npx prisma migrate deploy

echo ""
echo "✅ Migrations completed successfully!"
echo ""
echo "🔍 Check migration status:"
npx prisma migrate status
