#!/usr/bin/env bash
#
# Full dev startup: DB → backend → update mobile-app API URL → Expo.
# Run from project root: ./scripts/start-dev.sh
#
# Backend runs in the background. When you Ctrl+C, only Expo stops.
# To stop the backend: kill the "nest start" process or close the terminal.
#
set -e

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "=== 1. Starting PostgreSQL ==="
docker compose up -d postgres
echo "Waiting for database to be ready..."
sleep 2
until docker compose exec -T postgres pg_isready -U plaza_user -d plaza_dev > /dev/null 2>&1; do
  echo "   Waiting for database..."
  sleep 1
done
echo "✅ Database ready"
echo ""

echo "=== 2. Starting backend (background) ==="
# Free port 3000 if something is already listening (e.g. previous backend)
if command -v lsof >/dev/null 2>&1; then
  PIDS=$(lsof -ti:3000 2>/dev/null) || true
  if [ -n "$PIDS" ]; then
    echo "Killing process(es) on port 3000: $PIDS"
    echo "$PIDS" | xargs kill -9 2>/dev/null || true
    sleep 1
  fi
fi
cd "$ROOT/backend"
npm run start:dev &
BACKEND_PID=$!
cd "$ROOT"
# Give backend time to bind to port
echo "Waiting for backend to start..."
for i in {1..30}; do
  if curl -s -o /dev/null --connect-timeout 1 http://localhost:3000 2>/dev/null; then
    echo "✅ Backend responding on http://localhost:3000"
    break
  fi
  if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
    echo "❌ Backend process exited"
    exit 1
  fi
  sleep 1
done
if ! curl -s -o /dev/null --connect-timeout 1 http://localhost:3000 2>/dev/null; then
  echo "⚠️  Backend may still be starting; continuing..."
fi
echo ""

# Use Node 20+ for mobile-app (Expo/Metro need it for e.g. Array.prototype.toReversed)
use_node_20() {
  local nvm_dir="${NVM_DIR:-$HOME/.nvm}"
  if [ -s "$nvm_dir/nvm.sh" ]; then
    . "$nvm_dir/nvm.sh"
    nvm use 2>/dev/null || true
  fi
}

echo "=== 3. Updating mobile-app API URL (local IP for device) ==="
cd "$ROOT/mobile-app"
use_node_20
npm run update-ip
cd "$ROOT"
echo ""

echo "=== 4. Starting Expo (in new terminal so you can see the QR code) ==="
# Open a new Terminal window running Expo so you can keep it visible to scan the QR code
NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
EXPO_CMD="cd $(printf '%q' "$ROOT/mobile-app") && [ -s $(printf '%q' "$NVM_DIR/nvm.sh") ] && . $(printf '%q' "$NVM_DIR/nvm.sh") && nvm use 2>/dev/null; npx expo start"
if [ "$(uname)" = "Darwin" ] && command -v osascript >/dev/null 2>&1; then
  EXPO_CMD_ESC=$(printf '%s' "$EXPO_CMD" | sed 's/"/\\"/g')
  osascript -e "tell application \"Terminal\" to do script \"$EXPO_CMD_ESC\""
  echo "✅ Expo starting in a new Terminal window — use that window to scan the QR code."
else
  echo "Run Expo in a new terminal: cd $ROOT/mobile-app && nvm use && npx expo start"
fi
