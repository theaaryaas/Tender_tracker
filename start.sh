#!/usr/bin/env bash

set -e

echo "============================================================"
echo "  BITVIVID TENDER INTELLIGENCE & TRACKING SYSTEM"
echo "============================================================"
echo ""

cd "$(dirname "$0")"

# 1. Check Python
if command -v python3 &>/dev/null; then
    PY_CMD="python3"
elif command -v python &>/dev/null; then
    PY_CMD="python"
else
    echo "[ERROR] Python 3.10+ is required but not found in PATH."
    exit 1
fi

# 2. Check Node
if ! command -v npm &>/dev/null; then
    echo "[ERROR] Node.js / npm is required but not found in PATH."
    exit 1
fi

# 3. Setup backend dependencies
echo "Installing backend dependencies..."
$PY_CMD -m pip install -r backend/requirements.txt --quiet

# 4. Setup frontend dependencies
echo "Setting up frontend dependencies..."
cd frontend
if [ ! -d "node_modules" ]; then
    npm install
fi
cd ..

# 5. Launch
echo "Starting Backend & Frontend..."
$PY_CMD -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 &
BACKEND_PID=$!

cd frontend
npm run dev &
FRONTEND_PID=$!

echo "Backend running on PID $BACKEND_PID"
echo "Frontend running on PID $FRONTEND_PID"
echo "Open http://localhost:5173 in your browser"

wait

