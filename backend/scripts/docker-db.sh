#!/bin/bash

# Docker-based database management script
# Usage: ./docker-db.sh [start|stop|reset|status|logs]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

cd "$PROJECT_ROOT"

case "${1:-start}" in
  start)
    echo "🚀 Starting PostgreSQL container..."
    docker-compose up -d postgres
    echo "⏳ Waiting for database to be ready..."
    sleep 3
    until docker-compose exec -T postgres pg_isready -U plaza_user -d plaza_dev > /dev/null 2>&1; do
      echo "   Waiting for database..."
      sleep 1
    done
    echo "✅ PostgreSQL is ready!"
    echo ""
    echo "📝 Local DATABASE_URL:"
    echo "   postgresql://plaza_user:plaza_dev_password@localhost:5432/plaza_dev?schema=public"
    ;;
    
  stop)
    echo "🛑 Stopping PostgreSQL container..."
    docker-compose stop postgres
    echo "✅ PostgreSQL stopped"
    ;;
    
  reset)
    read -p "⚠️  This will DELETE all data. Continue? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
      echo "Cancelled."
      exit 1
    fi
    echo "🗑️  Resetting database..."
    docker-compose down -v postgres
    docker-compose up -d postgres
    echo "⏳ Waiting for database to be ready..."
    sleep 3
    until docker-compose exec -T postgres pg_isready -U plaza_user -d plaza_dev > /dev/null 2>&1; do
      echo "   Waiting for database..."
      sleep 1
    done
    echo "✅ Database reset complete!"
    echo "📦 Run migrations: cd backend && ./scripts/test-migration.sh"
    ;;
    
  status)
    echo "📊 Database Status:"
    docker-compose ps postgres
    echo ""
    if docker-compose ps postgres | grep -q "Up"; then
      echo "✅ Database is running"
      docker-compose exec -T postgres pg_isready -U plaza_user -d plaza_dev && echo "✅ Database is ready"
    else
      echo "❌ Database is not running"
    fi
    ;;
    
  logs)
    docker-compose logs -f postgres
    ;;
    
  *)
    echo "Usage: $0 [start|stop|reset|status|logs]"
    echo ""
    echo "Commands:"
    echo "  start   - Start PostgreSQL container"
    echo "  stop    - Stop PostgreSQL container"
    echo "  reset   - Reset database (deletes all data)"
    echo "  status  - Check database status"
    echo "  logs    - View database logs"
    exit 1
    ;;
esac
