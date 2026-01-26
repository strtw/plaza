#!/bin/bash

# Open Prisma Studio for local Docker database
# This will open a browser window to view/edit the database

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$BACKEND_DIR"

# Set local database URL
export DATABASE_URL="postgresql://plaza_user:plaza_dev_password@localhost:5432/plaza_dev?schema=public"

# Check if database is running
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
if ! docker compose -f "$PROJECT_ROOT/docker-compose.yml" ps postgres | grep -q "Up"; then
  echo "❌ Database is not running. Start it with: ./scripts/docker-db.sh start"
  exit 1
fi

echo "🎨 Opening Prisma Studio for local database..."
echo "📦 Database: $DATABASE_URL"
echo ""
echo "💡 Prisma Studio will open in your browser at http://localhost:5555"
echo "   Press Ctrl+C to stop Prisma Studio"
echo ""

npx prisma studio
